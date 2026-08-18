const OpenAI = require('openai');
const https = require('https');

// 自签证书网关 (如内网 nginx LLM 网关) node fetch 默认拒绝，customFetch 跳过TLS校验。
// 须保留可读 body 流：SDK 流式 (stream:true) 依赖 resp.body 迭代读取 SSE 分块，
// 仅缓冲到响应结束会收到 "Attempted to iterate over a response with no body" 错误。
// 复用 agent：保持到网关的 TLS 连接，避免每次请求新建连接被上游限流/慢启动
const selfSignedAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true, maxSockets: 16 });

function selfSignedFetch(url, init = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = init.body ? Buffer.from(init.body) : null;
    const headers = {};
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => { headers[k] = v; });
    } else {
      Object.assign(headers, init.headers);
    }
    if (body) headers['Content-Length'] = String(body.byteLength);
    const req = https.request(
      {
        hostname: u.hostname, port: u.port, path: u.pathname + u.search,
        method: init.method || 'GET', headers,
        rejectUnauthorized: false,
        agent: selfSignedAgent,
      },
      (res) => {
        // 缓冲 + 真实流双模式：json/text 用缓冲（非流式路径），body 暴露可读流（流式路径）。
        // res.resume() 强制流动：流式路径依赖 body 迭代，非流式路径依赖 chunk 缓冲，
        // 若等 start() 才流动，SDK 非流式不读 body → 永不结束。
        // 单一 data handler：chunk 同时入缓冲 + 转发给流 controller（含回放，保证顺序）
        const chunks = [];
        let done = false;
        let waiters = [];
        let controllerRef = null;
        const notify = () => { done = true; waiters.forEach(w => w()); waiters = []; };
        const waitDone = () => (done ? Promise.resolve() : new Promise(r => waiters.push(r)));

        const stream = new ReadableStream({
          start(controller) {
            controllerRef = controller;
            for (const c of chunks) controller.enqueue(c); // 回放在 handler 已收部分，保证流式不丢头
          },
          cancel() { controllerRef = null; }, // SDK 提前读完 body 时停止后续 enqueue
        });
        res.on('data', c => {
          chunks.push(c);
          if (controllerRef) controllerRef.enqueue(c);
        });
        res.on('end', () => {
          notify();
          if (controllerRef) { controllerRef.close(); controllerRef = null; }
        });
        res.on('error', e => {
          notify();
          if (controllerRef) { controllerRef.error(e); controllerRef = null; }
        });
        res.resume();
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode, statusText: res.statusMessage,
          headers: new Headers(res.headers),
          body: stream,
          json: async () => JSON.parse(await waitDone().then(() => Buffer.concat(chunks).toString())),
          text: async () => waitDone().then(() => Buffer.concat(chunks).toString()),
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

let client = null;

/**
 * 获取 OpenAI 兼容客户端
 * 配置读取优先级：
 *   OPENAI_BASE_URL / OPENAI_API_KEY  → OpenAI 兼容接口（首选）
 *   ANTHROPIC_BASE_URL / ANTHROPIC_API_KEY → Anthropic 兼容接口（兼容旧配置）
 */
function getClient() {
  if (!client) {
    const baseURL = process.env.OPENAI_BASE_URL || process.env.ANTHROPIC_BASE_URL;
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    client = new OpenAI({
      apiKey: apiKey || 'sk-placeholder',
      baseURL: baseURL || undefined,
      fetch: selfSignedFetch,
    });
  }
  return client;
}

/**
 * 模型列表（主模型在前，备用在后，用于热切换）
 * 优先级：
 *   OPENAI_MODELS   → 逗号分隔，第一个为主模型
 *   OPENAI_MODEL    → 单模型
 *   ANTHROPIC_MODEL → 兼容旧配置
 *   默认            → claude-sonnet-4-6
 */
function getModels() {
  const list = (process.env.OPENAI_MODELS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (list.length > 0) return list;

  const single =
    process.env.OPENAI_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    'claude-sonnet-4-6';
  return [single];
}

module.exports = { getClient, getModels };
