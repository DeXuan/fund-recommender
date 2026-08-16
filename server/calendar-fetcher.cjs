/**
 * 实时财经/市场事件日历抓取
 * 数据源：集思录 (jisilu.cn) 数据日历 — 新股申购/上市、A/H股分红、可转债、股指期货交割、期权到期
 * 缓存 30 分钟，静态 market-events.cjs 作为兜底基线
 */

const https = require('https');
const http = require('http');
const logger = require('./utils/logger.cjs');

let calendarCache = null;
let lastFetchTime = null;
const TTL_MS = 30 * 60 * 1000; // 30分钟

// qtype -> 内部 category/影响/标题前缀
const QTYPE_CONFIG = {
  newstock_onlist: { category: 'event', impact: 'high', prefix: '新股上市', label: '新股发行' },
  newstock_apply:   { category: 'event', impact: 'medium', prefix: '新股申购', label: '新股发行' },
  newbond_onlist:   { category: 'event', impact: 'medium', prefix: '可转债上市', label: '可转债' },
  newbond_apply:    { category: 'event', impact: 'medium', prefix: '可转债申购', label: '可转债' },
  CNV:              { category: 'event', impact: 'medium', prefix: '可转债', label: '可转债' },
  diva:             { category: 'earnings', impact: 'medium', prefix: 'A股分红', label: '分红送配' },
  divhk:            { category: 'earnings', impact: 'medium', prefix: 'H股分红', label: '分红送配' },
  idxfut:           { category: 'event', impact: 'high', prefix: '股指期货', label: '期货交割' },
  idxopt:           { category: 'event', impact: 'medium', prefix: '期权', label: '期权到期' },
};

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://www.jisilu.cn/data/calendar/' },
      timeout: 10000,
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        // jisilu 返回 gbk 时转 utf8
        if (res.headers['content-type'] && /gbk/i.test(res.headers['content-type'])) {
          try {
            const { TextDecoder } = require('util');
            d = new TextDecoder('gbk').decode(Buffer.from(d, 'binary'));
          } catch {}
        }
        resolve(d);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchCalendar() {
  const qtypes = Object.keys(QTYPE_CONFIG);
  const events = [];

  // 并发抓取各类型
  const results = await Promise.all(qtypes.map(async (qtype) => {
    try {
      const raw = await httpGet(`https://www.jisilu.cn/data/calendar/get_calendar_data/?qtype=${qtype}`);
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.map(item => ({
        qtype,
        id: String(item.id),
        code: item.code || '',
        title: item.title || '',
        start: item.start || '',
        description: item.description ? item.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '',
        url: item.url ? 'https://www.jisilu.cn' + item.url : '',
      }));
    } catch (e) {
      logger.warn(`[日历] ${qtype} 抓取失败: ${e.message}`);
      return [];
    }
  }));

  for (const list of results) {
    for (const ev of list) {
      const cfg = QTYPE_CONFIG[ev.qtype];
      const m = ev.start.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) continue;
      const [, y, mo, d] = m;
      const month = parseInt(mo);
      // 标题：保留原始 title，前缀掉【..】避免重复
      const cleanTitle = ev.title.replace(/^【[^】]*】/, '');
      events.push({
        id: `jisilu_${ev.id}`,
        month,
        category: cfg.category,
        impact: cfg.impact,
        title: cleanTitle || cfg.prefix,
        dateRange: `${parseInt(d)}日`,
        date: ev.start.slice(0, 10),
        description: ev.description || `${cfg.label}事件`,
        url: ev.url,
        relatedSectors: [],
        source: '集思录',
        investmentHint: '',
      });
    }
  }

  events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  calendarCache = events;
  lastFetchTime = new Date().toISOString();
  logger.info(`[日历] 抓取完成: ${events.length} 条实时事件`);
  return events;
}

async function getCachedCalendar() {
  if (calendarCache && lastFetchTime && (Date.now() - new Date(lastFetchTime).getTime() < TTL_MS)) {
    return calendarCache;
  }
  return await fetchCalendar();
}

function getLastFetchTime() { return lastFetchTime; }

module.exports = { fetchCalendar, getCachedCalendar, getLastFetchTime, QTYPE_CONFIG };
