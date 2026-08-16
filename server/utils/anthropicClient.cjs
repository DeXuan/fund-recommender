const OpenAI = require('openai');
const https = require('https');

// 自签证书网关 (如内网 nginx LLM 网关) node fetch 默认拒绝，customFetch 跳过TLS校验
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
        agent: new https.Agent({ rejectUnauthorized: false }),
      },
      (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode, statusText: res.statusMessage,
          headers: new Headers(res.headers), json: async () => JSON.parse(Buffer.concat(chunks).toString()),
          text: async () => Buffer.concat(chunks).toString(),
        }));
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
