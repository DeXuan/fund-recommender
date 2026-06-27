const express = require('express');
const router = express.Router();
const { getPool } = require('../db.cjs');
const { authMiddleware, subscriptionMiddleware } = require('../auth.cjs');
const logger = require('../utils/logger.cjs');

router.use(authMiddleware);
router.use(subscriptionMiddleware);

// GET /api/stock-picker/temperature — 指数估值温度计
router.get('/api/stock-picker/temperature', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT code, name, pe, pb, pe_percentile, pb_percentile, valuation, updated_at
       FROM market_indices WHERE pe_percentile IS NOT NULL AND pb_percentile IS NOT NULL`
    );

    const temperatures = result.rows.map(row => {
      const pePct = parseFloat(row.pe_percentile) || 50;
      const pbPct = parseFloat(row.pb_percentile) || 50;
      // 温度 = PE分位*60% + PB分位*40%，映射到0-100
      const temperature = Math.round((pePct * 0.6 + pbPct * 0.4) * 100) / 10;

      let signal, suggestion, color;
      if (temperature <= 20) {
        signal = 'frozen'; suggestion = '极度低估，适合大胆建仓'; color = '#1890ff';
      } else if (temperature <= 40) {
        signal = 'cold'; suggestion = '估值偏低，适合分批买入'; color = '#52c41a';
      } else if (temperature <= 60) {
        signal = 'neutral'; suggestion = '估值适中，持有观望'; color = '#faad14';
      } else if (temperature <= 80) {
        signal = 'warm'; suggestion = '估值偏高，谨慎追高'; color = '#fa8c16';
      } else {
        signal = 'hot'; suggestion = '极度高估，考虑止盈'; color = '#f5222d';
      }

      return {
        code: row.code,
        name: row.name,
        pe: parseFloat(row.pe) || null,
        pb: parseFloat(row.pb) || null,
        pe_percentile: pePct,
        pb_percentile: pbPct,
        temperature,
        signal,
        suggestion,
        color,
        valuation: row.valuation
      };
    });

    // 按温度排序
    temperatures.sort((a, b) => a.temperature - b.temperature);

    // 缓存到数据库
    for (const t of temperatures) {
      try {
        await pool.query(
          `INSERT INTO index_temperature (index_code, temperature, pe_percentile, pb_percentile, signal, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (index_code) DO UPDATE SET temperature = $2, pe_percentile = $3, pb_percentile = $4, signal = $5, updated_at = NOW()`,
          [t.code, t.temperature, t.pe_percentile, t.pb_percentile, t.signal]
        );
      } catch (e) { /* ignore cache errors */ }
    }

    res.json(temperatures);
  } catch (error) {
    logger.error(`获取指数温度失败: ${error.message}`);
    res.status(500).json({ error: '获取指数温度失败' });
  }
});

module.exports = router;
