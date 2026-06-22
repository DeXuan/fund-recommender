const express = require('express');
const router = express.Router();
const { getPool } = require('../db.cjs');
const { authMiddleware } = require('../auth.cjs');

// 持仓重叠分析
router.get('/api/portfolio/overlap', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const pool = getPool();

    // 获取用户持仓
    const holdingsResult = await pool.query(
      `SELECT fund_code, shares, cost_price FROM fund_records WHERE user_id = $1 AND shares > 0`,
      [userId]
    );
    const holdings = holdingsResult.rows;

    if (holdings.length < 2) {
      return res.json({ message: '需要至少2只持仓基金才能进行重叠分析', overlapPairs: [], summary: null });
    }

    const fundCodes = holdings.map(h => h.fund_code);

    // 获取基金信息
    const fundsResult = await pool.query(
      `SELECT code, name, industry, type FROM funds WHERE code = ANY($1)`,
      [fundCodes]
    );
    const fundMap = {};
    fundsResult.rows.forEach(f => { fundMap[f.code] = f; });

    // 行业重叠分析
    const industryMap = {};
    holdings.forEach(h => {
      const fund = fundMap[h.fund_code];
      if (fund) {
        if (!industryMap[fund.industry]) industryMap[fund.industry] = [];
        industryMap[fund.industry].push({ code: h.fund_code, name: fund.name, shares: parseFloat(h.shares) });
      }
    });

    // 计算行业集中度
    const totalShares = holdings.reduce((sum, h) => sum + parseFloat(h.shares), 0);
    const industryAllocation = Object.entries(industryMap).map(([industry, funds]) => ({
      industry,
      funds: funds,
      fundCount: funds.length,
      weight: funds.reduce((sum, f) => sum + f.shares, 0) / totalShares * 100,
    })).sort((a, b) => b.weight - a.weight);

    // 找出重叠的行业对（2只以上基金在同一行业）
    const overlapPairs = industryAllocation.filter(ia => ia.fundCount >= 2).map(ia => ({
      industry: ia.industry,
      funds: ia.funds,
      fundCount: ia.fundCount,
      weight: ia.weight,
      riskLevel: ia.weight > 40 ? 'high' : ia.weight > 25 ? 'medium' : 'low',
    }));

    // 基金类型分布
    const typeMap = {};
    holdings.forEach(h => {
      const fund = fundMap[h.fund_code];
      if (fund) {
        if (!typeMap[fund.type]) typeMap[fund.type] = 0;
        typeMap[fund.type] += parseFloat(h.shares);
      }
    });
    const typeDistribution = Object.entries(typeMap).map(([type, shares]) => ({
      type,
      weight: shares / totalShares * 100,
    })).sort((a, b) => b.weight - a.weight);

    // 集中度评估
    const hhi = industryAllocation.reduce((sum, ia) => sum + Math.pow(ia.weight, 2), 0);
    let concentrationLevel, concentrationAdvice;
    if (hhi > 2500) {
      concentrationLevel = '高度集中';
      concentrationAdvice = '行业集中度过高，建议分散投资以降低风险';
    } else if (hhi > 1500) {
      concentrationLevel = '中度集中';
      concentrationAdvice = '行业集中度适中，建议适当增加其他行业配置';
    } else {
      concentrationLevel = '分散';
      concentrationAdvice = '行业分布较为分散，风险控制良好';
    }

    res.json({
      overlapPairs,
      industryAllocation,
      typeDistribution,
      summary: {
        totalFunds: holdings.length,
        industryCount: Object.keys(industryMap).length,
        typeCount: Object.keys(typeMap).length,
        hhi: Math.round(hhi),
        concentrationLevel,
        concentrationAdvice,
        topIndustry: industryAllocation[0]?.industry || '-',
        topIndustryWeight: industryAllocation[0]?.weight?.toFixed(1) || '0',
      },
    });
  } catch (error) {
    console.error('持仓重叠分析失败:', error.message);
    res.status(500).json({ error: '分析失败' });
  }
});

// 目标投资规划（不需要登录）
router.post('/api/goal-planning', async (req, res) => {
  try {
    const { targetAmount, currentAmount, monthlyContribution, expectedReturn, years } = req.body;

    if (!targetAmount || !years) {
      return res.status(400).json({ error: '请填写目标金额和投资年限' });
    }
    if (targetAmount <= 0) {
      return res.status(400).json({ error: '目标金额必须大于0' });
    }
    if (years > 50 || years < 1) {
      return res.status(400).json({ error: '投资年限必须在1-50年之间' });
    }
    if (currentAmount < 0 || monthlyContribution < 0) {
      return res.status(400).json({ error: '当前金额和每月定投不能为负数' });
    }

    const rate = Math.min(Math.max((expectedReturn || 8), 0), 30) / 100;
    const months = years * 12;
    const monthlyRate = rate / 12;
    const current = currentAmount || 0;
    const monthly = monthlyContribution || 0;

    // 计算能否达成目标
    let futureValue = current;
    const monthData = [];
    for (let m = 1; m <= months; m++) {
      futureValue = futureValue * (1 + monthlyRate) + monthly;
      if (m % 12 === 0) {
        monthData.push({
          year: m / 12,
          value: Math.round(futureValue),
          invested: current + monthly * m,
          profit: Math.round(futureValue - current - monthly * m),
        });
      }
    }

    const totalInvested = current + monthly * months;
    const totalProfit = futureValue - totalInvested;
    const canReach = futureValue >= targetAmount;

    // 如果不能达成，计算需要的月供
    let requiredMonthly = 0;
    if (!canReach) {
      // 反推月供: FV = PV*(1+r)^n + PMT*((1+r)^n-1)/r
      const factor = (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
      requiredMonthly = Math.ceil((targetAmount - current * Math.pow(1 + monthlyRate, months)) / factor);
    }

    // 达成时间预测
    let monthsToGoal = 0;
    let tempValue = current;
    while (tempValue < targetAmount && monthsToGoal < 600) {
      monthsToGoal++;
      tempValue = tempValue * (1 + monthlyRate) + monthly;
    }

    res.json({
      targetAmount,
      currentAmount: current,
      monthlyContribution: monthly,
      expectedReturn: expectedReturn || 8,
      years,
      projection: {
        futureValue: Math.round(futureValue),
        totalInvested: Math.round(totalInvested),
        totalProfit: Math.round(totalProfit),
        returnRate: ((futureValue / totalInvested - 1) * 100).toFixed(2),
      },
      canReach,
      requiredMonthly: canReach ? null : requiredMonthly,
      monthsToGoal: monthsToGoal <= 600 ? monthsToGoal : null,
      yearsToGoal: monthsToGoal <= 600 ? (monthsToGoal / 12).toFixed(1) : null,
      yearlyData: monthData,
    });
  } catch (error) {
    console.error('目标规划计算失败:', error.message);
    res.status(500).json({ error: '计算失败' });
  }
});

module.exports = router;
