/**
 * 工具路由 — 风险评估、定投计算器、基金对比
 */

const express = require('express');
const fundService = require('../fund-service.cjs');
const { getPool } = require('../db.cjs');
const { createHandler } = require('../utils/route-handler.cjs');

const router = express.Router();
const handler = createHandler('工具');

// 风险评估
router.post('/api/risk/profile', handler(async (req) => {
  const { age, investmentAmount, investmentPeriod, riskTolerance, lossTolerance } = req.body;
  if (!age || !investmentAmount || !investmentPeriod || !riskTolerance || !lossTolerance) {
    const err = new Error('请填写完整的风险评估信息');
    err.status = 400;
    throw err;
  }

  const ageScores = { '18-25岁': 4, '26-35岁': 3, '36-45岁': 2, '46-55岁': 1, '55岁以上': 0 };
  const amountScores = { '1万以下': 1, '1-5万': 2, '5-20万': 3, '20-50万': 4, '50万以上': 4 };
  const periodScores = { '3个月以内': 1, '3-6个月': 2, '6-12个月': 3, '1-3年': 4, '3年以上': 5 };
  const riskScores = { conservative: 1, balanced: 2, aggressive: 3 };
  const lossScores = { '5%以内': 1, '5-10%': 2, '10-20%': 3, '20-30%': 4, '30%以上': 4 };

  const score = (ageScores[age] || 2) + (amountScores[investmentAmount] || 2) +
                (periodScores[investmentPeriod] || 2) + (riskScores[riskTolerance] || 2) +
                (lossScores[lossTolerance] || 2);

  let type, description, allocation, expectedReturn, riskLevel;

  if (score <= 7) {
    type = '保守型';
    description = '您偏好低风险投资，建议以货币基金和债券基金为主，少量配置指数基金。';
    riskLevel = 'low';
    expectedReturn = '3%-6%';
    allocation = [
      { industry: '货币基金', percentage: 30, funds: ['天弘余额宝', '南方天天利'] },
      { industry: '债券基金', percentage: 40, funds: ['易方达稳健收益', '招商产业债券'] },
      { industry: '沪深300指数', percentage: 20, funds: ['易方达沪深300ETF联接A'] },
      { industry: '银行理财', percentage: 10, funds: ['招商银行朝朝宝'] },
    ];
  } else if (score <= 11) {
    type = '稳健型';
    description = '您能承受一定风险，建议均衡配置股票型和债券型基金，适当配置指数基金。';
    riskLevel = 'medium';
    expectedReturn = '6%-12%';
    allocation = [
      { industry: '沪深300指数', percentage: 30, funds: ['易方达沪深300ETF联接A', '华夏沪深300ETF联接A'] },
      { industry: '债券基金', percentage: 25, funds: ['易方达稳健收益', '招商产业债券'] },
      { industry: '医药行业', percentage: 15, funds: ['中欧医疗健康混合A'] },
      { industry: '消费行业', percentage: 15, funds: ['易方达消费行业'] },
      { industry: '货币基金', percentage: 15, funds: ['天弘余额宝'] },
    ];
  } else {
    type = '激进型';
    description = '您追求高收益，可配置较多股票型基金和行业主题基金，注意分散风险。';
    riskLevel = 'high';
    expectedReturn = '12%-25%';
    allocation = [
      { industry: '人工智能/AI', percentage: 25, funds: ['人工智能ETF联接A', '华夏中证人工智能ETF联接A'] },
      { industry: '半导体/芯片', percentage: 20, funds: ['半导体芯片ETF联接A'] },
      { industry: '纳斯达克100', percentage: 20, funds: ['广发纳斯达克100ETF联接A'] },
      { industry: '新能源', percentage: 15, funds: ['新能源ETF联接A', '光伏ETF联接A'] },
      { industry: '沪深300指数', percentage: 20, funds: ['易方达沪深300ETF联接A'] },
    ];
  }

  return { type, description, allocation, expectedReturn, riskLevel, score };
}));

// 定投计算器
router.post('/api/tools/dca', handler(async (req) => {
  const { monthlyAmount, period, expectedReturn } = req.body;
  if (typeof monthlyAmount !== 'number' || monthlyAmount <= 0 ||
      typeof period !== 'number' || period <= 0 || period > 1200 ||
      typeof expectedReturn !== 'number' || expectedReturn < -50 || expectedReturn > 100) {
    const err = new Error('参数格式不正确');
    err.status = 400;
    throw err;
  }

  const monthlyRate = expectedReturn / 100 / 12;
  const totalInvestment = monthlyAmount * period;
  let totalValue = 0;
  const monthlyDetails = [];

  for (let i = 0; i < period; i++) {
    totalValue = (totalValue + monthlyAmount) * (1 + monthlyRate);
    const cumulativeInvestment = monthlyAmount * (i + 1);
    monthlyDetails.push({
      month: i + 1, investment: monthlyAmount, cumulativeInvestment,
      value: parseFloat(totalValue.toFixed(2)),
      return: parseFloat((((totalValue - cumulativeInvestment) / cumulativeInvestment) * 100).toFixed(2)),
    });
  }

  const totalProfit = totalValue - totalInvestment;
  const totalReturnPercent = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
  const years = period / 12;
  const annualizedReturn = years > 0
    ? parseFloat((Math.pow(totalValue / totalInvestment, 1 / years) - 1) * 100)
    : 0;

  return {
    totalInvestment,
    totalValue: parseFloat(totalValue.toFixed(2)),
    totalReturn: parseFloat(totalReturnPercent.toFixed(2)),
    annualizedReturn: parseFloat(annualizedReturn.toFixed(2)),
    monthlyDetails,
  };
}));

// 基金对比
router.post('/api/tools/compare', handler(async (req) => {
  const { codes } = req.body;
  if (!Array.isArray(codes) || codes.length === 0 || codes.length > 20) {
    const err = new Error('基金代码列表无效');
    err.status = 400;
    throw err;
  }
  if (!codes.every(c => typeof c === 'string' && /^\d{6}$/.test(c))) {
    const err = new Error('基金代码格式不正确');
    err.status = 400;
    throw err;
  }

  const funds = [];
  for (const code of codes) {
    const result = await fundService.getAllFundsWithNav({ search: code, pageSize: 5 });
    const list = result.data || result;
    const fund = list.find(f => f.code === code);
    if (fund) {
      const pool = getPool();
      const navRes = await pool.query(
        `SELECT nav, nav_date FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date DESC LIMIT 180`,
        [fund.code]
      );
      const navs = navRes.rows.reverse();
      const monthly = {};
      navs.forEach(r => {
        const month = r.nav_date.toISOString().slice(0, 7);
        if (!monthly[month]) monthly[month] = { start: parseFloat(r.nav), end: parseFloat(r.nav) };
        monthly[month].end = parseFloat(r.nav);
      });
      const performanceHistory = Object.entries(monthly).map(([date, data]) => ({
        date, nav: parseFloat(data.end.toFixed(4)),
        return: parseFloat(((data.end - data.start) / data.start * 100).toFixed(2)),
      })).slice(-6);
      funds.push({ ...fund, performanceHistory });
    }
  }
  return funds;
}));

// 基金对比净值历史
router.post('/api/tools/compare-nav', handler(async (req) => {
  const { codes } = req.body;
  if (!Array.isArray(codes) || codes.length < 1 || codes.length > 10) {
    const err = new Error('请提供1-10个基金代码');
    err.status = 400;
    throw err;
  }
  const pool = getPool();
  const result = await pool.query(
    `SELECT fund_code, nav, nav_date FROM fund_nav
     WHERE fund_code = ANY($1) AND nav_date >= NOW() - INTERVAL '6 months'
     ORDER BY fund_code, nav_date ASC`,
    [codes]
  );
  const grouped = {};
  result.rows.forEach(r => {
    if (!grouped[r.fund_code]) grouped[r.fund_code] = [];
    grouped[r.fund_code].push({ date: r.nav_date, nav: parseFloat(r.nav) });
  });
  const chartData = {};
  Object.entries(grouped).forEach(([code, data]) => {
    const baseNav = data[0].nav;
    chartData[code] = data.map(d => ({
      date: typeof d.date === 'string' ? d.date.slice(0, 10) : d.date.toISOString().slice(0, 10),
      nav: d.nav,
      return_pct: ((d.nav - baseNav) / baseNav * 100).toFixed(2),
    }));
  });
  return chartData;
}));

// 沪深300基准数据
router.get('/api/benchmark/hs300', handler(async () => {
  const pool = getPool();
  const result = await pool.query(
    `SELECT nav, nav_date FROM fund_nav
     WHERE fund_code = '110020' AND nav_date >= NOW() - INTERVAL '1 year'
     ORDER BY nav_date ASC`
  );
  if (result.rows.length === 0) return [];
  const baseNav = parseFloat(result.rows[0].nav);
  return result.rows.map(r => ({
    date: r.nav_date.toISOString().slice(0, 10),
    nav: parseFloat(r.nav),
    return_pct: ((parseFloat(r.nav) - baseNav) / baseNav * 100).toFixed(2),
  }));
}));

module.exports = { router };
