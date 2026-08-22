const express = require('express');
const logger = require('../../utils/logger.cjs');
const { getPool } = require('../../db.cjs');
const { authMiddleware } = require('../../auth.cjs');

const router = express.Router();
router.use(authMiddleware);

const RISK_MODELS = {
  conservative: { 股票: 30, 债券: 50, 货币: 15, 其他: 5 },
  balanced: { 股票: 50, 债券: 35, 货币: 10, 其他: 5 },
  aggressive: { 股票: 70, 债券: 20, 货币: 5, 其他: 5 },
};

function classifyFund(industry, type) {
  const ind = (industry || '').toLowerCase();
  const t = (type || '').toLowerCase();
  if (ind.includes('债') || ind.includes('固收') || t.includes('债') || t.includes('固收')) return '债券';
  if (ind.includes('货币') || ind.includes('现金') || t.includes('货币')) return '货币';
  if (ind.includes('股票') || ind.includes('权益') || t.includes('股票') || t.includes('混合') || t.includes('指数')) return '股票';
  return '其他';
}

router.get('/allocation-advice', async (req, res) => {
  try {
    const pool = getPool();

    const holdingsRes = await pool.query(
      `SELECT fr.fund_code, fr.fund_name, fr.market_value, fr.pnl_percent
       FROM fund_records fr
       WHERE fr.user_id = $1 AND (fr.record_type IS NULL OR fr.record_type = 'buy') AND fr.shares > 0
       ORDER BY fr.market_value DESC NULLS LAST`,
      [req.user.id]
    );

    if (holdingsRes.rows.length === 0) {
      return res.json({ currentAllocation: [], suggestedAllocation: [], gaps: [], suggestions: ['暂无持仓，请先添加持仓记录'], riskType: null });
    }

    const codes = holdingsRes.rows.map(r => r.fund_code);
    const metaRes = await pool.query(
      'SELECT code, industry, type FROM funds WHERE code = ANY($1)',
      [codes]
    );
    const metaMap = {};
    for (const r of metaRes.rows) metaMap[r.code] = { industry: r.industry, type: r.type };

    const totalValue = holdingsRes.rows.reduce((s, r) => s + parseFloat(r.market_value || 0), 0);

    const categoryMap = {};
    for (const r of holdingsRes.rows) {
      const meta = metaMap[r.fund_code] || {};
      const category = classifyFund(meta.industry, meta.type);
      if (!categoryMap[category]) categoryMap[category] = { category, value: 0, funds: [] };
      categoryMap[category].value += parseFloat(r.market_value || 0);
      categoryMap[category].funds.push({ fund_code: r.fund_code, fund_name: r.fund_name, value: parseFloat(r.market_value || 0) });
    }

    const currentAllocation = Object.values(categoryMap).map(c => ({
      ...c,
      weight: totalValue > 0 ? Math.round(c.value / totalValue * 10000) / 100 : 0,
    })).sort((a, b) => b.weight - a.weight);

    let riskType = 'balanced';
    try {
      const rpRes = await pool.query(
        'SELECT risk_type FROM risk_profiles WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [req.user.id]
      );
      if (rpRes.rows.length > 0 && rpRes.rows[0].risk_type) {
        riskType = rpRes.rows[0].risk_type;
      }
    } catch { /* risk_profiles 表可能不存在 */ }

    const model = RISK_MODELS[riskType] || RISK_MODELS.balanced;
    const suggestedAllocation = Object.entries(model).map(([category, weight]) => ({ category, targetWeight: weight }));

    const allCategories = [...new Set([...currentAllocation.map(c => c.category), ...suggestedAllocation.map(c => c.category)])];
    const gaps = allCategories.map(cat => {
      const current = currentAllocation.find(c => c.category === cat);
      const suggested = suggestedAllocation.find(c => c.category === cat);
      const currentWeight = current?.weight || 0;
      const targetWeight = suggested?.targetWeight || 0;
      const diff = Math.round((currentWeight - targetWeight) * 100) / 100;
      return {
        category: cat,
        currentWeight,
        targetWeight,
        diff,
        action: diff > 5 ? '减仓' : diff < -5 ? '加仓' : '保持',
        value: current?.value || 0,
      };
    }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    const suggestions = [];
    const overWeight = gaps.filter(g => g.diff > 5);
    const underWeight = gaps.filter(g => g.diff < -5);
    if (overWeight.length > 0) suggestions.push(`${overWeight.map(g => `${g.category}(${g.currentWeight}%)`).join('、')}占比偏高，建议减仓至目标比例`);
    if (underWeight.length > 0) suggestions.push(`${underWeight.map(g => `${g.category}(${g.currentWeight}%)`).join('、')}占比偏低，建议加仓至目标比例`);
    if (gaps.every(g => Math.abs(g.diff) <= 5)) suggestions.push('当前配置与目标配置基本一致，保持即可');
    const stockWeight = currentAllocation.find(c => c.category === '股票')?.weight || 0;
    if (stockWeight > 70) suggestions.push('股票占比超过70%，组合波动较大，注意风险控制');
    if (stockWeight < 20 && riskType === 'aggressive') suggestions.push('作为进取型投资者，股票占比偏低，可适当增加权益类资产');

    res.json({
      currentAllocation,
      suggestedAllocation,
      gaps,
      suggestions,
      riskType,
      totalValue: Math.round(totalValue * 100) / 100,
    });
  } catch (error) {
    logger.error('资产配置建议失败:', error.message);
    res.status(500).json({ error: '资产配置建议失败' });
  }
});

module.exports = router;
