/**
 * 共享速率限制器（基于内存 Map，带 TTL 自动清理）
 */

const rateLimitMaps = new Map();
const cleanupIntervals = new Map();

function createRateLimit(windowMs, max, name = 'default') {
  if (!rateLimitMaps.has(name)) {
    rateLimitMaps.set(name, new Map());
  }
  const map = rateLimitMaps.get(name);

  // 定期清理过期条目
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of map) {
      if (now > record.resetTime + 60000) {
        map.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
  cleanupIntervals.set(name, cleanupInterval);

  // 允许外部清理定时器
  const limiter = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const record = map.get(ip) || { count: 0, resetTime: now + windowMs };
    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }
    record.count++;
    map.set(ip, record);
    if (record.count > max) {
      return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    }
    next();
  };

  limiter._cleanupInterval = cleanupInterval;
  limiter._map = map;
  limiter.destroy = () => {
    clearInterval(cleanupInterval);
    map.clear();
    rateLimitMaps.delete(name);
  };

  return limiter;
}

// 清理所有速率限制器
function destroyAll() {
  for (const interval of cleanupIntervals.values()) {
    clearInterval(interval);
  }
  cleanupIntervals.clear();
  for (const map of rateLimitMaps.values()) {
    map.clear();
  }
  rateLimitMaps.clear();
}

module.exports = { createRateLimit, destroyAll };
