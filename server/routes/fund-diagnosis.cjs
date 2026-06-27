const express = require('express');
const logger = require('../utils/logger.cjs');
const router = express.Router();
const { getPool } = require('../db.cjs');
const fundService = require('../fund-service.cjs');

// 基金诊断报告
router.get('/api/fund-diagnosis/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const pool = getPool();

    // 获取基金基本信息
    const fundResult = await pool.query(
      `SELECT f.*, n.nav, n.total_nav, n.nav_date, n.return_1w, n.return_1m, n.return_3m, n.return_6m, n.return_1y
       FROM funds f LEFT JOIN LATERAL (
         SELECT nav, total_nav, nav_date, return_1w, return_1m, return_3m, return_6m, return_1y
         FROM fund_nav WHERE fund_code = f.code ORDER BY nav_date DESC LIMIT 1
       ) n ON true WHERE f.code = $1`,
      [code]
    );

    if (fundResult.rows.length === 0) {
      return res.status(404).json({ error: '基金不存在' });
    }

    const fund = fundResult.rows[0];
    const return1y = parseFloat(fund.return_1y) || 0;
    const return6m = parseFloat(fund.return_6m) || 0;
    const return3m = parseFloat(fund.return_3m) || 0;
    const return1m = parseFloat(fund.return_1m) || 0;
    const totalFee = parseFloat(fund.total_fee) || 0;
    const scale = parseFloat(fund.scale) || 0;
    const rating = fund.rating || 3;

    // 获取同类基金数据（用于对比）
    const peerResult = await pool.query(
      `SELECT f.code, n.return_1y, n.return_6m, f.total_fee, f.scale, f.rating
       FROM funds f LEFT JOIN LATERAL (
         SELECT return_1y, return_6m FROM fund_nav WHERE fund_code = f.code ORDER BY nav_date DESC LIMIT 1
       ) n ON true WHERE f.industry = $1 AND f.code != $2 AND n.return_1y IS NOT NULL`,
      [fund.industry, code]
    );
    const peers = peerResult.rows;

    // 计算各维度评分
    const scores = {
      // 盈利能力（30分）- 基于收益率排名
      profitability: calculateProfitabilityScore(return1y, return6m, peers),
      // 抗风险力（25分）- 基于收益稳定性
      riskResistance: calculateRiskResistanceScore(return1y, return6m, return3m, return1m),
      // 费率优势（15分）- 基于费率排名
      costEfficiency: calculateCostScore(totalFee, peers),
      // 规模稳定性（15分）- 基于规模
      scaleStability: calculateScaleScore(scale),
      // 经理能力（15分）- 基于评级
      managerAbility: calculateManagerScore(rating, return1y, peers),
    };

    const totalScore = Object.values(scores).reduce((sum, s) => sum + s.score, 0);

    // 生成诊断建议
    const diagnosis = generateDiagnosis(fund, scores, totalScore, peers);

    res.json({
      fund: {
        code: fund.code,
        name: fund.name,
        type: fund.type,
        industry: fund.industry,
        nav: fund.nav ? parseFloat(fund.nav) : null,
        return1y, return6m, return3m, return1m,
        totalFee, scale, rating,
        manager: fund.manager,
        buySuggestion: fund.buy_suggestion,
      },
      scores,
      totalScore,
      peerCount: peers.length,
      diagnosis,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('基金诊断失败:', error.message);
    res.status(500).json({ error: '基金诊断失败' });
  }
});

function calculateProfitabilityScore(return1y, return6m, peers) {
  if (!peers.length) return { score: 15, label: '中等', detail: '暂无同类对比数据' };

  const peerReturns = peers.map(p => parseFloat(p.return_1y) || 0).filter(r => r !== 0);
  if (!peerReturns.length) return { score: 15, label: '中等', detail: '暂无同类对比数据' };

  const betterCount = peerReturns.filter(r => return1y > r).length;
  const percentile = (betterCount / peerReturns.length) * 100;

  let score, label;
  if (percentile >= 80) { score = 28; label = '优秀'; }
  else if (percentile >= 60) { score = 24; label = '良好'; }
  else if (percentile >= 40) { score = 20; label = '中等'; }
  else if (percentile >= 20) { score = 15; label = '偏弱'; }
  else { score = 10; label = '较差'; }

  return { score, label, detail: `近1年收益 ${return1y.toFixed(2)}%，同类排名前 ${(100 - percentile).toFixed(0)}%`, percentile: Math.round(percentile) };
}

function calculateRiskResistanceScore(return1y, return6m, return3m, return1m) {
  // 收益稳定性 - 各期收益波动越小越好
  const returns = [return1y, return6m, return3m, return1m].filter(r => r !== 0);
  if (returns.length < 2) return { score: 12, label: '中等', detail: '数据不足' };

  const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - avg, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance);

  // 波动越小，抗风险能力越强
  let score, label;
  if (volatility < 5) { score = 23; label = '优秀'; }
  else if (volatility < 10) { score = 20; label = '良好'; }
  else if (volatility < 20) { score = 15; label = '中等'; }
  else if (volatility < 30) { score = 12; label = '偏弱'; }
  else { score = 8; label = '较差'; }

  return { score, label, detail: `收益波动 ${volatility.toFixed(1)}%，稳定性${label}` };
}

function calculateCostScore(totalFee, peers) {
  if (!peers.length) return { score: 8, label: '中等', detail: '暂无同类对比' };

  const peerFees = peers.map(p => parseFloat(p.total_fee) || 0).filter(f => f > 0);
  if (!peerFees.length) return { score: 8, label: '中等', detail: '暂无同类对比' };

  const cheaperCount = peerFees.filter(f => totalFee < f).length;
  const percentile = (cheaperCount / peerFees.length) * 100;

  let score, label;
  if (percentile >= 80) { score = 14; label = '优秀'; }
  else if (percentile >= 60) { score = 12; label = '良好'; }
  else if (percentile >= 40) { score = 10; label = '中等'; }
  else if (percentile >= 20) { score = 7; label = '偏高'; }
  else { score = 5; label = '较高'; }

  return { score, label, detail: `综合费率 ${totalFee.toFixed(2)}%，同类排名前 ${(100 - percentile).toFixed(0)}%` };
}

function calculateScaleScore(scale) {
  let score, label;
  if (scale >= 100) { score = 14; label = '优秀'; }
  else if (scale >= 50) { score = 12; label = '良好'; }
  else if (scale >= 10) { score = 10; label = '中等'; }
  else if (scale >= 2) { score = 7; label = '偏小'; }
  else { score = 5; label = '过小'; }

  return { score, label, detail: `基金规模 ${scale.toFixed(2)} 亿元` };
}

function calculateManagerScore(rating, return1y, peers) {
  // 基于评级和超额收益
  let score = rating * 2; // 基础分（评级1-5，对应2-10分）

  if (peers.length > 0) {
    const peerAvgReturn = peers.reduce((s, p) => s + (parseFloat(p.return_1y) || 0), 0) / peers.length;
    const alpha = return1y - peerAvgReturn;
    if (alpha > 10) score += 5;
    else if (alpha > 5) score += 3;
    else if (alpha > 0) score += 1;
  }

  score = Math.min(15, Math.max(5, score));
  const label = score >= 13 ? '优秀' : score >= 10 ? '良好' : score >= 8 ? '中等' : '偏弱';

  return { score, label, detail: `基金评级 ${'★'.repeat(rating)}，经理能力${label}` };
}

function generateDiagnosis(fund, scores, totalScore, peers) {
  const advantages = [];
  const risks = [];
  let level, summary;

  // 评分等级
  if (totalScore >= 85) { level = 'A+'; summary = '综合表现优秀，值得配置'; }
  else if (totalScore >= 75) { level = 'A'; summary = '综合表现良好，适合投资'; }
  else if (totalScore >= 65) { level = 'B+'; summary = '综合表现中等偏上'; }
  else if (totalScore >= 55) { level = 'B'; summary = '综合表现中等'; }
  else if (totalScore >= 45) { level = 'C'; summary = '综合表现偏弱，需谨慎'; }
  else { level = 'D'; summary = '综合表现较差，不推荐'; }

  // 优势分析
  if (scores.profitability.score >= 24) advantages.push('盈利能力突出，收益排名靠前');
  if (scores.riskResistance.score >= 20) advantages.push('收益稳定性好，抗风险能力强');
  if (scores.costEfficiency.score >= 12) advantages.push('费率优势明显，成本较低');
  if (scores.scaleStability.score >= 12) advantages.push('规模适中，运作稳定');
  if (scores.managerAbility.score >= 12) advantages.push('基金经理能力强，超额收益明显');

  // 风险提示
  if (scores.profitability.score < 15) risks.push('盈利能力偏弱，收益排名靠后');
  if (scores.riskResistance.score < 12) risks.push('收益波动较大，抗风险能力不足');
  if (scores.costEfficiency.score < 7) risks.push('费率偏高，侵蚀收益');
  if (scores.scaleStability.score < 7) risks.push('规模偏小，存在清盘风险');
  if (fund.totalFee > 1.5) risks.push('综合费率超过1.5%，成本较高');

  // 建议
  let suggestion = '';
  if (totalScore >= 75) {
    suggestion = '该基金综合表现优秀，可作为核心配置。建议采用定投方式分批建仓，降低择时风险。';
  } else if (totalScore >= 55) {
    suggestion = '该基金综合表现中等，可作为辅助配置。建议关注费率和规模变化，适当控制仓位。';
  } else {
    suggestion = '该基金综合表现偏弱，建议谨慎投资。可考虑同类中评分更高的替代基金。';
  }

  return { level, summary, advantages, risks, suggestion };
}

module.exports = router;
