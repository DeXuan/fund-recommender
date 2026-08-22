const express = require('express');
const logger = require('../../utils/logger.cjs');
const { getPool } = require('../../db.cjs');
const { authMiddleware } = require('../../auth.cjs');

const router = express.Router();
router.use(authMiddleware);

function clampScore(v) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// GET /api/portfolio/health-score
router.get('/health-score', async (req, res) => {
  try {
    const pool = getPool();

    // 获取持仓
    const holdingsResult = await pool.query(
      `SELECT fr.fund_code, fr.fund_name, fr.shares, fr.cost_price, fr.buy_fee,
              fr.current_nav, fr.market_value, fr.pnl, fr.pnl_percent
       FROM fund_records fr
       WHERE fr.user_id = $1 AND (fr.record_type IS NULL OR fr.record_type = 'buy') AND fr.shares > 0
       ORDER BY fr.market_value DESC NULLS LAST`,
      [req.user.id]
    );

    if (holdingsResult.rows.length === 0) {
      return res.json({ score: 0, dimensions: {}, suggestions: ['暂无持仓，请先添加基金'] });
    }

    // 获取基金元数据（行业、费率、规模）
    const fundCodes = [...new Set(holdingsResult.rows.map(r => r.fund_code))];
    const metaResult = await pool.query(
      `SELECT code, industry, total_fee, scale, type FROM funds WHERE code = ANY($1)`,
      [fundCodes]
    );
    const metaMap = {};
    for (const r of metaResult.rows) {
      metaMap[r.code] = { industry: r.industry, total_fee: parseFloat(r.total_fee || 0), scale: parseFloat(r.scale || 0), type: r.type };
    }

    const holdings = holdingsResult.rows.map(r => ({
      fund_code: r.fund_code,
      fund_name: r.fund_name,
      market_value: parseFloat(r.market_value || 0),
      pnl_percent: parseFloat(r.pnl_percent || 0),
      ...metaMap[r.fund_code] || {},
    }));

    const totalValue = holdings.reduce((s, h) => s + h.market_value, 0);
    if (totalValue === 0) {
      return res.json({ score: 0, dimensions: {}, suggestions: ['持仓市值为0，无法评估'] });
    }

    // ── 1. 集中度评分（HHI 指数） ──
    const weights = holdings.map(h => h.market_value / totalValue);
    const hhi = weights.reduce((sum, w) => sum + w * w, 0);
    // HHI: 1/N（完全分散）到 1（完全集中）
    const n = holdings.length;
    const minHHI = 1 / n;
    const concentrationScore = clampScore(100 * (1 - (hhi - minHHI) / (1 - minHHI)));

    // ── 2. 分散度评分（数量 + 行业分散） ──
    const industries = [...new Set(holdings.map(h => h.industry).filter(Boolean))];
    const typeCount = Math.min(n, 10);
    const industryCount = Math.min(industries.length, 8);
    const diversificationScore = clampScore(typeCount * 7 + industryCount * 3);

    // ── 3. 费率评分 ──
    const fees = holdings.map(h => h.total_fee).filter(f => f > 0);
    const avgFee = fees.length > 0 ? fees.reduce((s, f) => s + f, 0) / fees.length : 0;
    // 费率 0% → 100分，0.5% → 80分，1% → 60分，1.5% → 40分，2%+ → 20分
    const feeScore = clampScore(100 - avgFee * 40);

    // ── 4. 收益风险评分 ──
    const avgPnlPercent = holdings.reduce((s, h) => s + h.pnl_percent * (h.market_value / totalValue), 0);
    const pnlStdDev = Math.sqrt(
      holdings.reduce((s, h) => s + Math.pow(h.pnl_percent - avgPnlPercent, 2) * (h.market_value / totalValue), 0)
    );
    // 收益贡献：+20% → 满分，-20% → 0分
    const returnPart = clampScore(50 + avgPnlPercent * 2.5);
    // 波动惩罚：标准差越大分数越低
    const volatilityPart = clampScore(100 - pnlStdDev * 2);
    const riskScore = clampScore(returnPart * 0.6 + volatilityPart * 0.4);

    // ── 5. 规模评分 ──
    const scales = holdings.map(h => h.scale).filter(s => s > 0);
    const avgScale = scales.length > 0 ? scales.reduce((s, v) => s + v, 0) / scales.length : 0;
    // 规模 10亿+ → 满分，1亿 → 60分，<0.5亿 → 30分
    let scaleScore;
    if (avgScale >= 100) scaleScore = 100;
    else if (avgScale >= 10) scaleScore = 80 + (avgScale - 10) * 0.2;
    else if (avgScale >= 1) scaleScore = 60 + (avgScale - 1) * 2.2;
    else scaleScore = 30 + avgScale * 30;
    scaleScore = clampScore(scaleScore);

    // ── 综合评分 ──
    const totalScore = clampScore(
      concentrationScore * 0.25 +
      diversificationScore * 0.20 +
      feeScore * 0.15 +
      riskScore * 0.30 +
      scaleScore * 0.10
    );

    // ── 建议 ──
    const suggestions = [];
    if (concentrationScore < 60) suggestions.push('持仓过于集中，建议增加基金数量分散风险');
    if (diversificationScore < 50) suggestions.push('行业分散度不足，建议配置不同行业的基金');
    if (feeScore < 60) suggestions.push(`平均费率 ${avgFee.toFixed(2)}% 偏高，可考虑低费率指数基金`);
    if (riskScore < 50) suggestions.push('组合波动较大，可增加债券型或货币型基金平衡风险');
    if (scaleScore < 60) suggestions.push('部分基金规模偏小，存在清盘风险，建议选择规模10亿以上的基金');
    if (suggestions.length === 0) suggestions.push('持仓组合健康度良好，继续保持');

    res.json({
      score: totalScore,
      dimensions: {
        concentration: { score: concentrationScore, label: '集中度', detail: `HHI=${hhi.toFixed(3)}` },
        diversification: { score: diversificationScore, label: '分散度', detail: `${n}只基金，${industries.length}个行业` },
        fee: { score: feeScore, label: '费率', detail: `平均${avgFee.toFixed(2)}%` },
        risk: { score: riskScore, label: '收益风险', detail: `收益${avgPnlPercent.toFixed(1)}%，波动${pnlStdDev.toFixed(1)}%` },
        scale: { score: scaleScore, label: '规模', detail: `平均${avgScale.toFixed(1)}亿` },
      },
      suggestions,
    });
  } catch (error) {
    logger.error('健康度评分失败:', error.message);
    res.status(500).json({ error: '健康度评分失败' });
  }
});

module.exports = router;
