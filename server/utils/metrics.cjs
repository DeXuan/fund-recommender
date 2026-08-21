const logger = require('./logger.cjs');
const { getPool } = require('../db.cjs');

const state = {
  requestCount: 0,
  slowQueryCount: 0,
  startTime: Date.now(),
  apiStatsBuffer: new Map(),
};

function resetQpsCounter() { state.requestCount = 0; }
function incrementRequestCount() { state.requestCount++; }
function incrementSlowQueryCount() { state.slowQueryCount++; }

function recordApiStat(method, endpoint, statusCode, responseTimeMs) {
  const key = `${method}:${endpoint}`;
  if (!state.apiStatsBuffer.has(key)) {
    state.apiStatsBuffer.set(key, { count: 0, errors: 0, totalTime: 0, maxTime: 0, times: [] });
  }
  const stat = state.apiStatsBuffer.get(key);
  stat.count++;
  if (statusCode >= 400) stat.errors++;
  stat.totalTime += responseTimeMs;
  stat.maxTime = Math.max(stat.maxTime, responseTimeMs);
  stat.times.push(responseTimeMs);
  if (stat.times.length > 1000) stat.times = stat.times.slice(-1000);
}

async function flushApiStats() {
  if (state.apiStatsBuffer.size === 0) return;
  try {
    const pool = getPool();
    const hourStart = new Date();
    hourStart.setMinutes(0, 0, 0);
    for (const [key, stat] of state.apiStatsBuffer.entries()) {
      const [method, endpoint] = key.split(':');
      const sorted = [...stat.times].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
      const avg = stat.count > 0 ? stat.totalTime / stat.count : 0;
      await pool.query(
        `INSERT INTO api_stats (hour_start, endpoint, method, request_count, error_count, avg_response_ms, max_response_ms, p95_response_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (hour_start, endpoint, method) DO UPDATE SET
           request_count = api_stats.request_count + $4,
           error_count = api_stats.error_count + $5,
           avg_response_ms = (api_stats.avg_response_ms + $6) / 2,
           max_response_ms = GREATEST(api_stats.max_response_ms, $7),
           p95_response_ms = GREATEST(api_stats.p95_response_ms, $8)`,
        [hourStart, endpoint, method, stat.count, stat.errors, avg, stat.maxTime, p95]
      );
    }
    state.apiStatsBuffer.clear();
  } catch (e) {
    logger.error(`Flush API stats failed: ${e.message}`);
  }
}
setInterval(flushApiStats, 5 * 60 * 1000);

module.exports = {
  state,
  resetQpsCounter,
  incrementRequestCount,
  incrementSlowQueryCount,
  recordApiStat,
};
