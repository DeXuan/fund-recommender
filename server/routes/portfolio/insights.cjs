const express = require('express');
const logger = require('../../utils/logger.cjs');
const { getPool } = require('../../db.cjs');
const { authMiddleware, subscriptionMiddleware } = require('../../auth.cjs');
const { classifyAsset, generateSuggestions, fetchAndStoreHistoricalNav, resolveLatestNav } = require('../../utils/portfolio-helpers.cjs');

const router = express.Router();
router.use(authMiddleware);

// POST /api/portfolio/risk-profile — 保存风险评估结果
router.post('/risk-profile', async (req, res) => {
  try {
    const pool = getPool();
    const { age, investmentAmount, investmentPeriod, riskTolerance, lossTolerance, score, riskType, riskLevel, expectedReturn, allocation } = req.body;

    if (!riskType || !riskLevel || score == null) {
      return res.status(400).json({ error: '请提供完整的风险评估结果' });
    }

    // 每个用户只保留最新一条
    await pool.query('DELETE FROM risk_profiles WHERE user_id = $1', [req.user.id]);

    const result = await pool.query(
      `INSERT INTO risk_profiles (user_id, age, investment_amount, investment_period, risk_tolerance, loss_tolerance, score, risk_type, risk_level, expected_return, allocation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user.id, age || '', investmentAmount || '', investmentPeriod || '', riskTolerance || '', lossTolerance || '',
       score, riskType, riskLevel, expectedReturn || '', JSON.stringify(allocation || [])]
    );
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('保存风险评估失败:', error.message);
    res.status(500).json({ error: '保存失败' });
  }
});

// GET /api/portfolio/risk-profile — 获取最新风险评估结果
router.get('/risk-profile', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM risk_profiles WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.json(null);
    }
    const row = result.rows[0];
    res.json({
      ...row,
      allocation: typeof row.allocation === 'string' ? JSON.parse(row.allocation) : row.allocation,
    });
  } catch (error) {
    logger.error('获取风险评估失败:', error.message);
    res.status(500).json({ error: '获取失败' });
  }
});

// GET /api/portfolio/insights — 组合洞察数据
router.get('/insights', async (req, res) => {
  try {
    const pool = getPool();

    // 1. 获取用户持仓
    const recordsResult = await pool.query(
      `SELECT fr.*, f.industry, f.type FROM fund_records fr
       LEFT JOIN funds f ON fr.fund_code = f.code
       WHERE fr.user_id = $1 ORDER BY fr.buy_date`,
      [req.user.id]
    );
    if (recordsResult.rows.length === 0) {
      return res.json({ holdings: [], categories: [], market: [], riskProfile: null, suggestions: [] });
    }

    // 2. 按基金分组汇总
    const grouped = {};
    for (const r of recordsResult.rows) {
      const code = r.fund_code;
      if (!grouped[code]) {
        grouped[code] = {
          fund_code: code, fund_name: r.fund_name, industry: r.industry || '', type: r.type || '',
          total_shares: 0, total_cost: 0, market_value: 0, pnl: 0,
        };
      }
      const shares = parseFloat(r.shares);
      const cost = parseFloat(r.cost_price);
      const fee = parseFloat(r.buy_fee || 0);
      const nav = parseFloat(r.current_nav || cost);
      const mv = parseFloat(r.market_value || shares * cost);

      grouped[code].total_shares += shares;
      grouped[code].total_cost += shares * cost + fee;
      grouped[code].market_value += mv;
      grouped[code].pnl += parseFloat(r.pnl || 0);
    }

    const holdings = Object.values(grouped).map(h => ({
      ...h,
      total_cost: parseFloat(h.total_cost.toFixed(2)),
      market_value: parseFloat(h.market_value.toFixed(2)),
      pnl: parseFloat(h.pnl.toFixed(2)),
      pnl_percent: h.total_cost > 0 ? parseFloat(((h.pnl / h.total_cost) * 100).toFixed(2)) : 0,
      category: classifyAsset(h.fund_code, h.fund_name, h.industry, h.type),
    }));

    const totalValue = holdings.reduce((s, h) => s + h.market_value, 0);

    // 3. 按资产类别分组
    const categoryMap = {};
    for (const h of holdings) {
      if (!categoryMap[h.category]) {
        categoryMap[h.category] = { name: h.category, value: 0, cost: 0, pnl: 0, funds: [] };
      }
      categoryMap[h.category].value += h.market_value;
      categoryMap[h.category].cost += h.total_cost;
      categoryMap[h.category].pnl += h.pnl;
      categoryMap[h.category].funds.push({
        code: h.fund_code, name: h.fund_name, value: h.market_value, pnl: h.pnl, pnlPercent: h.pnl_percent,
      });
    }

    const categories = Object.values(categoryMap).map(c => ({
      ...c,
      value: parseFloat(c.value.toFixed(2)),
      cost: parseFloat(c.cost.toFixed(2)),
      pnl: parseFloat(c.pnl.toFixed(2)),
      pnlPercent: c.cost > 0 ? parseFloat(((c.pnl / c.cost) * 100).toFixed(2)) : 0,
      weight: totalValue > 0 ? parseFloat(((c.value / totalValue) * 100).toFixed(1)) : 0,
    }));

    // 4. 获取市场指数
    let market = [];
    try {
      const marketResult = await pool.query('SELECT * FROM market_indices ORDER BY code');
      market = marketResult.rows.map(r => ({
        code: r.code, name: r.name, price: parseFloat(r.price || 0), changePercent: parseFloat(r.change_percent || 0),
        pe: parseFloat(r.pe || 0), pePercentile: parseFloat(r.pe_percentile || 0), valuation: r.valuation || '', suggestion: r.suggestion || '',
      }));
    } catch (e) { /* ignore */ }

    // 5. 获取风险评估
    let riskProfile = null;
    try {
      const riskResult = await pool.query(
        'SELECT * FROM risk_profiles WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [req.user.id]
      );
      if (riskResult.rows.length > 0) {
        const row = riskResult.rows[0];
        riskProfile = {
          riskType: row.risk_type, riskLevel: row.risk_level, expectedReturn: row.expected_return,
          allocation: typeof row.allocation === 'string' ? JSON.parse(row.allocation) : row.allocation,
        };
      }
    } catch (e) { /* ignore */ }

    // 6. 生成智能建议
    const suggestions = generateSuggestions(holdings, categories, totalValue, market, riskProfile);

    res.json({ holdings, categories, market, riskProfile, suggestions, totalValue: parseFloat(totalValue.toFixed(2)) });
  } catch (error) {
    logger.error('获取组合洞察失败:', error.message);
    res.status(500).json({ error: '获取组合洞察失败' });
  }
});

// GET /api/portfolio/vip-insights — VIP 专属智能分析
router.get('/vip-insights', subscriptionMiddleware, async (req, res) => {
  try {
    const pool = getPool();

    // 1. 获取用户持仓（含预计算盈亏字段）
    const recordsResult = await pool.query(
      `SELECT fr.id, fr.user_id, fr.fund_code, fr.fund_name, fr.shares, fr.cost_price,
              fr.buy_date, fr.buy_fee, fr.notes,
              fr.current_nav, fr.market_value, fr.pnl, fr.pnl_percent, fr.nav_updated_at,
              f.industry, f.type
       FROM fund_records fr
       LEFT JOIN funds f ON fr.fund_code = f.code
       WHERE fr.user_id = $1 ORDER BY fr.buy_date`,
      [req.user.id]
    );
    if (recordsResult.rows.length === 0) {
      return res.json({
        healthScore: 0, healthLevel: '暂无数据', dataQuality: 'empty',
        metrics: { annualizedReturn: 0, maxDrawdown: 0, sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0, volatility: 0, winRate: 0, profitLossRatio: 0, avgHoldingDays: 0, drawdownRecoveryDays: 0 },
        totalCost: 0, totalValue: 0, totalPnl: 0, totalReturn: 0,
        attribution: [], monthlyReturns: [], riskMetrics: [], alerts: [], aiAdvice: [],
      });
    }

    const records = recordsResult.rows;

    // 2. 检查是否有预计算的盈亏数据（refresh-nav 执行过）
    const hasPrecomputed = records.some(r => r.current_nav && parseFloat(r.current_nav) > 0);

    // 如果没有预计算数据，尝试从 fund_nav 表获取最新净值补充
    if (!hasPrecomputed) {
      const fundCodes = [...new Set(records.map(r => r.fund_code))];
      const latestNavMap = await resolveLatestNav(pool, fundCodes);

      // 补充计算每条记录的 current_nav / market_value / pnl
      for (const r of records) {
        const nav = latestNavMap[r.fund_code];
        if (nav && nav.nav > 0) {
          r.current_nav = nav.nav;
          const shares = parseFloat(r.shares);
          const cost = parseFloat(r.cost_price);
          const fee = parseFloat(r.buy_fee || 0);
          r.market_value = parseFloat((shares * nav.nav).toFixed(2));
          r.pnl = parseFloat((r.market_value - (shares * cost + fee)).toFixed(2));
          r.pnl_percent = parseFloat(((r.pnl / (shares * cost + fee)) * 100).toFixed(2));
        }
      }
    }

    // 3. 按基金分组汇总
    const grouped = {};
    for (const r of records) {
      const code = r.fund_code;
      if (!grouped[code]) grouped[code] = { fund_code: code, fund_name: r.fund_name, records: [], industry: r.industry || '', type: r.type || '' };
      grouped[code].records.push(r);
    }

    let totalCost = 0, totalValue = 0, totalPnl = 0;
    const holdings = [];
    const categoryMap = {};

    for (const group of Object.values(grouped)) {
      let shares = 0, cost = 0, mv = 0, pnl = 0, currentNav = 0;
      for (const r of group.records) {
        const s = parseFloat(r.shares);
        const c = parseFloat(r.cost_price);
        const fee = parseFloat(r.buy_fee || 0);
        shares += s;
        cost += s * c + fee;

        const nav = parseFloat(r.current_nav || 0);
        if (nav > 0) {
          currentNav = nav;
          const recordMV = parseFloat(r.market_value || (s * nav));
          mv += recordMV;
          pnl += parseFloat(r.pnl || (recordMV - s * c - fee));
        } else {
          // 没有净值数据，用成本作为占位
          mv += s * c;
        }
      }
      totalCost += cost;
      totalValue += mv;
      totalPnl += pnl;

      const cat = classifyAsset(group.fund_code, group.fund_name, group.industry, group.type);
      const avgCostPrice = shares > 0 ? cost / shares : 0;
      holdings.push({
        fund_code: group.fund_code, fund_name: group.fund_name,
        total_shares: shares, avg_cost_price: parseFloat(avgCostPrice.toFixed(4)),
        total_cost: parseFloat(cost.toFixed(2)), current_nav: parseFloat(currentNav.toFixed(4)),
        market_value: parseFloat(mv.toFixed(2)), pnl: parseFloat(pnl.toFixed(2)),
        pnl_percent: cost > 0 ? parseFloat(((pnl / cost) * 100).toFixed(2)) : 0,
        category: cat, records: group.records,
      });

      if (!categoryMap[cat]) categoryMap[cat] = { category: cat, weight: 0, pnl: 0, cost: 0, value: 0, funds: [] };
      categoryMap[cat].weight += mv;
      categoryMap[cat].pnl += pnl;
      categoryMap[cat].cost += cost;
      categoryMap[cat].value += mv;
      categoryMap[cat].funds.push({ code: group.fund_code, name: group.fund_name, value: parseFloat(mv.toFixed(2)), pnl: parseFloat(pnl.toFixed(2)), pnlPercent: cost > 0 ? parseFloat(((pnl / cost) * 100).toFixed(2)) : 0 });
    }

    const totalReturn = totalCost > 0 ? parseFloat(((totalPnl / totalCost) * 100).toFixed(2)) : 0;

    // 4. 收益归因
    const attribution = Object.values(categoryMap).map(c => ({
      category: c.category,
      contribution: totalPnl !== 0 ? parseFloat(((c.pnl / totalPnl) * 100).toFixed(1)) : 0,
      weight: totalValue > 0 ? parseFloat(((c.value / totalValue) * 100).toFixed(1)) : 0,
      pnl: parseFloat(c.pnl.toFixed(2)),
      value: parseFloat(c.value.toFixed(2)),
      funds: c.funds,
    })).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    // 5. 获取历史净值，自动补充缺失数据
    const fundCodes = Object.keys(grouped);

    // 从最早的买入日期开始算（而非固定1年）
    const earliestBuyDate = records.reduce((min, r) => {
      const d = r.buy_date instanceof Date ? r.buy_date : new Date(r.buy_date);
      return d < min ? d : min;
    }, new Date());
    const startDate = earliestBuyDate.toISOString().slice(0, 10);

    // 检查每只基金从买入日起有多少历史净值
    const navCountResult = await pool.query(
      `SELECT fund_code, COUNT(*) as cnt FROM fund_nav
       WHERE fund_code = ANY($1) AND nav_date >= $2
       GROUP BY fund_code`,
      [fundCodes, startDate]
    );
    const navCountMap = {};
    for (const row of navCountResult.rows) {
      navCountMap[row.fund_code] = parseInt(row.cnt);
    }

    // 对数据不足的基金自动获取历史净值（API返回最近365天，每只基金调一次即可）
    const fundsToFetch = fundCodes.filter(code => (navCountMap[code] || 0) < 10);
    if (fundsToFetch.length > 0) {
      logger.info(`[VIP分析] 自动获取 ${fundsToFetch.length} 只基金的历史净值`);
      for (const code of fundsToFetch) {
        try {
          const fundName = grouped[code].fund_name;
          await fetchAndStoreHistoricalNav(pool, code, fundName, new Date().getFullYear());
        } catch (e) {
          logger.warn(`[VIP分析] 获取 ${code} 历史净值失败:`, e.message);
        }
      }
    }

    // 重新查询历史净值
    const navResult = await pool.query(
      `SELECT fund_code, nav, nav_date FROM fund_nav
       WHERE fund_code = ANY($1) AND nav_date >= $2
       ORDER BY nav_date`,
      [fundCodes, startDate]
    );

    // 按日期分组
    const navByDate = {};
    for (const row of navResult.rows) {
      const dateStr = row.nav_date instanceof Date ? row.nav_date.toISOString().slice(0, 10) : String(row.nav_date);
      if (!navByDate[dateStr]) navByDate[dateStr] = {};
      navByDate[dateStr][row.fund_code] = parseFloat(row.nav);
    }

    const tradingDates = Object.keys(navByDate).sort();

    // 计算组合每日市值
    // 只从最后一笔买入之后开始计算，避免建仓过程被误算为收益
    const latestBuyDate = records.reduce((max, r) => {
      const d = r.buy_date instanceof Date ? r.buy_date : new Date(r.buy_date);
      return d > max ? d : max;
    }, new Date(0));
    const portfolioStartDate = latestBuyDate.toISOString().slice(0, 10);

    const dailyValues = [];
    for (const dateStr of tradingDates) {
      if (dateStr < portfolioStartDate) continue; // 跳过建仓期
      let dayValue = 0;
      for (const group of Object.values(grouped)) {
        const nav = navByDate[dateStr]?.[group.fund_code];
        if (!nav) continue;
        let shares = 0;
        for (const r of group.records) {
          const buyDate = r.buy_date instanceof Date ? r.buy_date.toISOString().slice(0, 10) : String(r.buy_date);
          if (buyDate <= dateStr) shares += parseFloat(r.shares);
        }
        if (shares > 0) dayValue += shares * nav;
      }
      if (dayValue > 0) dailyValues.push({ date: dateStr, value: dayValue });
    }

    // 6. 计算高级指标
    let annualizedReturn = 0, maxDrawdown = 0, sharpeRatio = 0, calmarRatio = 0;
    let volatility = 0, winRate = 0, profitLossRatio = 0;
    let returnPeriod = ''; // 标记收益计算区间
    const dailyReturns = [];

    if (dailyValues.length >= 2) {
      for (let i = 1; i < dailyValues.length; i++) {
        dailyReturns.push((dailyValues[i].value - dailyValues[i - 1].value) / dailyValues[i - 1].value);
      }

      const totalDays = dailyValues.length;
      const totalPeriodReturn = (dailyValues[dailyValues.length - 1].value - dailyValues[0].value) / dailyValues[0].value;
      const calendarDays = Math.round((new Date(dailyValues[dailyValues.length-1].date) - new Date(dailyValues[0].date)) / 86400000);

      // 年化收益率：只有数据跨>=200个交易日(~1年)才年化，否则显示期间收益率
      if (totalDays >= 200) {
        const rawAnnualized = (Math.pow(1 + totalPeriodReturn, 252 / totalDays) - 1) * 100;
        annualizedReturn = parseFloat(Math.max(-99, Math.min(500, rawAnnualized)).toFixed(2));
        returnPeriod = '年化';
      } else {
        // 数据不足1年，显示期间收益率（不年化，避免误导）
        annualizedReturn = parseFloat((totalPeriodReturn * 100).toFixed(2));
        returnPeriod = `${calendarDays}天`;
      }

      // 最大回撤
      let peak = dailyValues[0].value;
      for (const d of dailyValues) {
        if (d.value > peak) peak = d.value;
        const dd = (peak - d.value) / peak;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }
      maxDrawdown = parseFloat((maxDrawdown * 100).toFixed(2));

      // 波动率（年化）
      const avgReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
      volatility = parseFloat(Math.min(200, Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2));

      // 夏普比率（无风险利率2%）
      const riskFreeDaily = 0.02 / 252;
      const excessReturns = dailyReturns.map(r => r - riskFreeDaily);
      const avgExcess = excessReturns.reduce((s, r) => s + r, 0) / excessReturns.length;
      const stdExcess = Math.sqrt(excessReturns.reduce((s, r) => s + Math.pow(r - avgExcess, 2), 0) / excessReturns.length);
      const rawSharpe = stdExcess > 0 ? (avgExcess / stdExcess * Math.sqrt(252)) : 0;
      sharpeRatio = parseFloat(Math.max(-5, Math.min(10, rawSharpe)).toFixed(2));

      // 卡玛比率
      calmarRatio = maxDrawdown > 0 ? parseFloat(Math.max(-20, Math.min(20, annualizedReturn / maxDrawdown)).toFixed(2)) : 0;

      // 胜率
      const profitDays = dailyReturns.filter(r => r > 0).length;
      winRate = parseFloat(((profitDays / dailyReturns.length) * 100).toFixed(2));

      // 盈亏比
      const avgProfit = dailyReturns.filter(r => r > 0).reduce((s, r) => s + r, 0) / (profitDays || 1);
      const lossDays = dailyReturns.length - profitDays;
      const avgLoss = lossDays > 0 ? Math.abs(dailyReturns.filter(r => r < 0).reduce((s, r) => s + r, 0) / lossDays) : 0;
      profitLossRatio = avgLoss > 0 ? parseFloat(Math.min(20, avgProfit / avgLoss).toFixed(2)) : 0;
    }

    // 索提诺比率
    let sortinoRatio = 0;
    if (dailyReturns.length >= 20) {
      const riskFreeDaily = 0.02 / 252;
      const downSide = dailyReturns.filter(r => r < riskFreeDaily);
      const downVar = downSide.length > 0 ? downSide.reduce((s, r) => s + (r - riskFreeDaily) ** 2, 0) / downSide.length : 0;
      const downDev = Math.sqrt(downVar) * Math.sqrt(252);
      const annRet = (annualizedReturn || 0) / 100;
      sortinoRatio = downDev > 0 ? parseFloat(Math.max(-10, Math.min(20, (annRet - 0.02) / downDev)).toFixed(2)) : 0;
    }

    // 回撤恢复天数
    let drawdownRecoveryDays = 0;
    if (dailyValues.length >= 2) {
      let peak = dailyValues[0].value, peakIdx = 0, maxDD = 0, ddStartIdx = 0;
      for (let i = 0; i < dailyValues.length; i++) {
        if (dailyValues[i].value > peak) { peak = dailyValues[i].value; peakIdx = i; }
        const dd = (peak - dailyValues[i].value) / peak;
        if (dd > maxDD) { maxDD = dd; ddStartIdx = peakIdx; }
      }
      if (ddStartIdx < dailyValues.length - 1) {
        const peakVal = dailyValues[ddStartIdx].value;
        for (let i = ddStartIdx + 1; i < dailyValues.length; i++) {
          if (dailyValues[i].value >= peakVal) { drawdownRecoveryDays = i - ddStartIdx; break; }
        }
        if (drawdownRecoveryDays === 0) drawdownRecoveryDays = -1; // 未恢复
      }
    }

    // 平均持仓天数
    const now = new Date();
    const holdingDays = records.map(r => {
      const buyDate = r.buy_date instanceof Date ? r.buy_date : new Date(r.buy_date);
      return Math.floor((now.getTime() - buyDate.getTime()) / 86400000);
    });
    const avgHoldingDays = holdingDays.length > 0 ? Math.round(holdingDays.reduce((s, d) => s + d, 0) / holdingDays.length) : 0;

    // 7. 月度收益
    const monthlyReturns = [];
    const monthMap = {};
    for (const d of dailyValues) {
      const month = d.date.slice(0, 7);
      if (!monthMap[month]) monthMap[month] = { first: d.value, last: d.value, firstDate: d.date };
      monthMap[month].last = d.value;
    }
    for (const [month, vals] of Object.entries(monthMap).sort()) {
      const ret = vals.first > 0 ? ((vals.last - vals.first) / vals.first * 100) : 0;
      monthlyReturns.push({ month: month.slice(5) + '月', return: parseFloat(ret.toFixed(2)), value: vals.last });
    }

    // 8. 风险雷达（基于真实数据归一化到0-100）
    const riskMetrics = [
      { name: '收益能力', value: Math.round(Math.min(100, Math.max(0, (annualizedReturn + 10) * 3))), benchmark: 50, status: '' },
      { name: '风控能力', value: Math.round(Math.min(100, Math.max(0, 100 - maxDrawdown * 2))), benchmark: 60, status: '' },
      { name: '稳定性', value: Math.round(Math.min(100, Math.max(0, 100 - volatility * 1.5))), benchmark: 55, status: '' },
      { name: '择时能力', value: Math.round(Math.min(100, Math.max(0, winRate * 1.2))), benchmark: 50, status: '' },
      { name: '分散度', value: Math.round(Math.min(100, holdings.length * 18)), benchmark: 60, status: '' },
      { name: '持仓耐力', value: Math.round(Math.min(100, Math.max(0, avgHoldingDays / 2))), benchmark: 50, status: '' },
    ];
    for (const m of riskMetrics) {
      m.status = m.value >= m.benchmark ? 'good' : 'warning';
    }

    // 9. 组合健康评分
    const scoreComponents = [
      { score: Math.min(30, Math.max(0, (annualizedReturn + 5) * 1.5)), max: 30 },
      { score: Math.min(25, Math.max(0, 25 - maxDrawdown * 0.5)), max: 25 },
      { score: Math.min(20, Math.max(0, sharpeRatio * 8 + 4)), max: 20 },
      { score: Math.min(15, holdings.length * 3), max: 15 },
      { score: Math.min(10, winRate * 0.12), max: 10 },
    ];
    const healthScore = Math.round(scoreComponents.reduce((s, c) => s + c.score, 0));
    const healthLevel = healthScore >= 80 ? '优秀' : healthScore >= 60 ? '良好' : healthScore >= 40 ? '一般' : '需改善';

    // 10. 数据质量标记
    const dataQuality = dailyValues.length >= 200 ? 'excellent' : dailyValues.length >= 60 ? 'good' : dailyValues.length >= 10 ? 'fair' : 'poor';

    // 11. 智能预警
    const alerts = [];

    for (const h of holdings) {
      const weight = totalValue > 0 ? (h.market_value / totalValue) * 100 : 0;
      if (weight > 35) {
        alerts.push({ type: 'risk', level: 'warning', title: `持仓集中: ${h.fund_name}`, detail: `单只基金占比 ${weight.toFixed(1)}%，集中度过高，建议分散投资。`, action: '查看分散建议' });
      }
    }

    const bigLoss = holdings.filter(h => h.pnl_percent < -15);
    if (bigLoss.length > 0) {
      alerts.push({ type: 'warning', level: 'error', title: '大额亏损预警', detail: `${bigLoss.length}只基金亏损超过15%，最大跌幅 ${Math.min(...bigLoss.map(h => h.pnl_percent)).toFixed(1)}%。`, action: '查看止损建议' });
    }

    if (maxDrawdown > 20) {
      alerts.push({ type: 'risk', level: 'warning', title: '回撤偏大', detail: `最大回撤 ${maxDrawdown.toFixed(1)}%，超过20%警戒线。建议增配固收类资产降低波动。`, action: '查看调仓建议' });
    }

    const stockWeight = attribution.filter(a => a.category.includes('股')).reduce((s, a) => s + a.weight, 0);
    if (stockWeight > 85) {
      alerts.push({ type: 'risk', level: 'warning', title: '权益仓位过重', detail: `股票类资产占比 ${stockWeight.toFixed(0)}%，建议保留10-20%的固收或货币基金作为安全垫。`, action: '查看配置建议' });
    }

    if (holdings.length > 0) {
      const noNavFunds = holdings.filter(h => h.current_nav <= 0);
      if (noNavFunds.length > 0) {
        alerts.push({ type: 'info', level: 'info', title: '部分基金净值待更新', detail: `${noNavFunds.map(h => h.fund_name).join('、')} 暂无最新净值数据，点击"刷新净值"可更新。`, action: '刷新净值' });
      }
    }

    if (alerts.length === 0) {
      alerts.push({ type: 'success', level: 'info', title: '组合状态健康', detail: '当前各项指标正常，无风险预警。继续保持投资纪律！', action: '' });
    }

    // 12. AI 投资建议
    const aiAdvice = [];

    if (annualizedReturn < 5 && totalCost > 10000 && dailyValues.length >= 30) {
      aiAdvice.push({ priority: 'high', title: '收益率偏低', detail: `年化收益仅 ${annualizedReturn}%，低于货币基金。建议审视持仓结构，减少低效资产。`, impact: '预期提升年化收益2-5%' });
    }

    if (maxDrawdown > 15 && stockWeight > 60) {
      aiAdvice.push({ priority: 'high', title: '优化回撤控制', detail: `最大回撤 ${maxDrawdown.toFixed(1)}%，建议增配债券基金（10-20%）平滑波动。`, impact: '预期降低回撤5-10%' });
    }

    if (holdings.length < 4) {
      aiAdvice.push({ priority: 'medium', title: '建议增加分散度', detail: `当前仅持有 ${holdings.length} 只基金，建议配置4-6只不同风格的基金降低非系统性风险。`, impact: '降低单一基金风险暴露' });
    }

    if (holdings.length > 10) {
      aiAdvice.push({ priority: 'medium', title: '持仓数量偏多', detail: `当前持有 ${holdings.length} 只基金，管理成本高且可能过度分散。建议精选5-8只核心基金。`, impact: '降低管理复杂度，提升收益效率' });
    }

    if (sharpeRatio >= 1) {
      aiAdvice.push({ priority: 'low', title: '风险收益比优秀', detail: `夏普比率 ${sharpeRatio}，说明每承担1单位风险获得了较好的超额收益。可适当增加投入金额放大收益。`, impact: '放大收益的同时保持风险可控' });
    }

    const overseasWeight = attribution.find(a => a.category === '海外股')?.weight || 0;
    if (overseasWeight < 10 && stockWeight > 30) {
      aiAdvice.push({ priority: 'medium', title: '建议增配海外资产', detail: '海外资产占比偏低，配置纳斯达克100或标普500可提升地域分散度。', impact: '降低A股单一市场风险' });
    }

    if (avgHoldingDays < 30 && holdings.length > 0) {
      aiAdvice.push({ priority: 'medium', title: '持仓周期偏短', detail: `平均持仓仅 ${avgHoldingDays} 天，频繁交易会增加手续费损耗。建议坚持长期持有（至少6个月）。`, impact: '减少交易成本，提升实际收益' });
    }

    const bondWeight = (categoryMap['固收']?.weight || 0) + (categoryMap['货币基金']?.weight || 0);
    if (stockWeight > 70 && bondWeight < 10) {
      aiAdvice.push({ priority: 'high', title: '缺少安全垫资产', detail: `固收+货币仅占 ${bondWeight.toFixed(0)}%，建议至少配置10%的债券或货币基金作为安全垫。`, impact: '在市场大跌时减少回撤' });
    }

    if (aiAdvice.length === 0) {
      aiAdvice.push({ priority: 'low', title: '组合管理良好', detail: '当前配置均衡，风险可控。建议定期（每季度）检视一次组合适配性。', impact: '持续优化长期收益' });
    }

    // ========== 13. 持仓基金详细诊断 ==========
    const fundDetails = holdings.map(h => {
      const weight = totalValue > 0 ? (h.market_value / totalValue * 100) : 0;
      const profit = h.pnl >= 0;

      // 买入时机评估：对比买入后走势
      let timingGrade = '中性';
      let timingScore = 50;
      if (h.pnl_percent > 20) { timingGrade = '优秀'; timingScore = 90; }
      else if (h.pnl_percent > 10) { timingGrade = '良好'; timingScore = 75; }
      else if (h.pnl_percent > 0) { timingGrade = '及格'; timingScore = 60; }
      else if (h.pnl_percent > -10) { timingGrade = '偏弱'; timingScore = 40; }
      else { timingGrade = '较差'; timingScore = 20; }

      // 风险等级
      let riskLevel = '中等';
      if (h.fund_code.startsWith('518') || h.fund_name.includes('黄金')) riskLevel = '低风险';
      else if (h.fund_name.includes('债') || h.fund_name.includes('货币')) riskLevel = '低风险';
      else if (h.fund_name.includes('QDII') || h.fund_name.includes('全球') || h.fund_name.includes('纳斯达克')) riskLevel = '中高风险';
      else if (h.fund_name.includes('半导体') || h.fund_name.includes('芯片') || h.fund_name.includes('新能源') || h.fund_name.includes('光伏')) riskLevel = '高风险';

      // 诊断建议
      const diagnosis = [];
      if (weight > 30) diagnosis.push({ type: 'warning', text: `占比${weight.toFixed(1)}%过高，建议降至25%以内` });
      if (h.pnl_percent < -20) diagnosis.push({ type: 'danger', text: `亏损${Math.abs(h.pnl_percent).toFixed(1)}%，需评估是否止损或补仓摊薄成本` });
      if (h.pnl_percent < -10 && h.pnl_percent >= -20) diagnosis.push({ type: 'warning', text: `亏损${Math.abs(h.pnl_percent).toFixed(1)}%，关注基本面是否变化` });
      if (h.pnl_percent > 30) diagnosis.push({ type: 'success', text: `盈利${h.pnl_percent.toFixed(1)}%，可考虑分批止盈锁定收益` });
      if (h.pnl_percent > 15 && h.pnl_percent <= 30) diagnosis.push({ type: 'info', text: `盈利${h.pnl_percent.toFixed(1)}%，可设置回撤止盈线` });
      if (riskLevel === '高风险' && weight > 15) diagnosis.push({ type: 'warning', text: '高风险基金占比偏重，建议控制在10%以内' });

      return {
        fundCode: h.fund_code,
        fundName: h.fund_name,
        weight: parseFloat(weight.toFixed(2)),
        cost: h.total_cost,
        value: h.market_value,
        pnl: h.pnl,
        pnlPercent: h.pnl_percent,
        currentNav: h.current_nav,
        timingGrade,
        timingScore,
        riskLevel,
        category: h.category,
        diagnosis,
      };
    }).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));

    // ========== 14. 亏损诊断（痛点分析） ==========
    const losers = fundDetails.filter(f => f.pnl < 0).sort((a, b) => a.pnl - b.pnl);
    const lossDiagnosis = {
      totalLoss: parseFloat(losers.reduce((s, f) => s + f.pnl, 0).toFixed(2)),
      fundCount: losers.length,
      worstFund: losers[0] || null,
      analysis: [],
    };

    if (losers.length > 0) {
      // 亏损集中度
      const top3Loss = losers.slice(0, 3);
      const top3LossAmount = top3Loss.reduce((s, f) => s + f.pnl, 0);
      if (Math.abs(top3LossAmount) > Math.abs(lossDiagnosis.totalLoss) * 0.7) {
        lossDiagnosis.analysis.push({
          type: 'concentration',
          title: '亏损高度集中',
          detail: `前3只亏损基金占总亏损的${Math.round(Math.abs(top3LossAmount) / Math.abs(lossDiagnosis.totalLoss) * 100)}%，需重点关注`,
          funds: top3Loss.map(f => f.fundName),
        });
      }

      // 行业性亏损
      const lossByCategory = {};
      for (const f of losers) {
        if (!lossByCategory[f.category]) lossByCategory[f.category] = { loss: 0, count: 0 };
        lossByCategory[f.category].loss += f.pnl;
        lossByCategory[f.category].count++;
      }
      for (const [cat, info] of Object.entries(lossByCategory)) {
        if (info.count >= 2) {
          lossDiagnosis.analysis.push({
            type: 'sector',
            title: `${cat}板块整体亏损`,
            detail: `${cat}板块${info.count}只基金合计亏损¥${Math.abs(info.loss).toFixed(0)}，可能是行业周期下行`,
            funds: losers.filter(f => f.category === cat).map(f => f.fundName),
          });
        }
      }

      // 高位买入诊断
      const highBuyers = losers.filter(f => f.timingScore <= 40);
      if (highBuyers.length > 0) {
        lossDiagnosis.analysis.push({
          type: 'timing',
          title: '买入时机不佳',
          detail: `${highBuyers.map(f => f.fundName).join('、')}买入后持续下跌，可能存在追高行为`,
          funds: highBuyers.map(f => f.fundName),
        });
      }
    }

    // ========== 15. 盈利分析（成功经验） ==========
    const winners = fundDetails.filter(f => f.pnl > 0).sort((a, b) => b.pnl - a.pnl);
    const profitAnalysis = {
      totalProfit: parseFloat(winners.reduce((s, f) => s + f.pnl, 0).toFixed(2)),
      fundCount: winners.length,
      bestFund: winners[0] || null,
      analysis: [],
    };

    if (winners.length > 0) {
      // 盈利来源
      const profitByCategory = {};
      for (const f of winners) {
        if (!profitByCategory[f.category]) profitByCategory[f.category] = { profit: 0, count: 0 };
        profitByCategory[f.category].profit += f.pnl;
        profitByCategory[f.category].count++;
      }
      const sortedCategories = Object.entries(profitByCategory).sort((a, b) => b[1].profit - a[1].profit);
      if (sortedCategories.length > 0) {
        profitAnalysis.analysis.push({
          type: 'source',
          title: '主要盈利来源',
          detail: `${sortedCategories[0][0]}板块贡献盈利¥${sortedCategories[0][1].profit.toFixed(0)}，占比${profitAnalysis.totalProfit !== 0 ? Math.round(sortedCategories[0][1].profit / profitAnalysis.totalProfit * 100) : 0}%`,
          funds: winners.filter(f => f.category === sortedCategories[0][0]).map(f => f.fundName),
        });
      }

      // 优秀择时
      const goodTimers = winners.filter(f => f.timingScore >= 75);
      if (goodTimers.length > 0) {
        profitAnalysis.analysis.push({
          type: 'timing',
          title: '择时能力突出',
          detail: `${goodTimers.map(f => f.fundName).join('、')}买入时机优秀，收益超过15%`,
          funds: goodTimers.map(f => f.fundName),
        });
      }

      // 止盈建议
      const bigWinners = winners.filter(f => f.pnl_percent > 25);
      if (bigWinners.length > 0) {
        profitAnalysis.analysis.push({
          type: 'action',
          title: '止盈提醒',
          detail: `${bigWinners.map(f => `${f.fundName}(${f.pnlPercent.toFixed(1)}%)`).join('、')}盈利丰厚，建议设置回撤止盈线保护利润`,
          funds: bigWinners.map(f => f.fundName),
        });
      }
    }

    // ========== 16. 费用影响分析 ==========
    const totalBuyFees = records.reduce((s, r) => s + parseFloat(r.buy_fee || 0), 0);
    const feeImpact = {
      totalFees: parseFloat(totalBuyFees.toFixed(2)),
      feeRate: totalCost > 0 ? parseFloat((totalBuyFees / totalCost * 100).toFixed(3)) : 0,
      impactOnReturn: totalPnl !== 0 ? parseFloat((totalBuyFees / Math.abs(totalPnl) * 100).toFixed(1)) : 0,
      advice: totalBuyFees > totalCost * 0.005 ? '综合费率偏高，建议选择C类份额或费率更低的ETF联接基金' : '费率控制良好',
    };

    // ========== 17. 基准对比（vs 沪深300） ==========
    let benchmarkComparison = null;
    try {
      const hs300Nav = await pool.query(
        'SELECT nav, nav_date FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date DESC LIMIT 1',
        ['110020']
      );
      if (hs300Nav.rows.length > 0 && dailyValues.length >= 10) {
        const hs300Start = navByDate[dailyValues[0]?.date]?.['110020'];
        const hs300End = parseFloat(hs300Nav.rows[0].nav);
        if (hs300Start > 0 && hs300End > 0) {
          const hs300Return = ((hs300End - hs300Start) / hs300Start * 100);
          const portfolioReturn = totalReturn;
          const alpha = portfolioReturn - hs300Return;
          benchmarkComparison = {
            name: '沪深300',
            return: parseFloat(hs300Return.toFixed(2)),
            portfolioReturn,
            alpha: parseFloat(alpha.toFixed(2)),
            outperform: alpha > 0,
            detail: alpha > 0
              ? `您的组合跑赢沪深300 ${alpha.toFixed(2)}个百分点，投资能力优于市场`
              : `您的组合跑输沪深300 ${Math.abs(alpha).toFixed(2)}个百分点，建议增配宽基指数基金`,
          };
        }
      }
    } catch (e) { /* 基准对比失败不影响主流程 */ }

    // ========== 18. 增强AI建议（精准、可执行） ==========
    const enhancedAdvice = [...aiAdvice];

    // 亏损TOP1具体建议
    if (losers.length > 0 && losers[0].pnlPercent < -15) {
      const worst = losers[0];
      const actions = [];
      if (worst.pnlPercent < -30) {
        actions.push('深度亏损，建议评估基金基本面是否恶化');
        actions.push('如基本面未变，可考虑分3批补仓摊薄成本（每跌5%补一次）');
        actions.push('如基本面恶化，建议止损并将资金转入更优标的');
      } else {
        actions.push('中度亏损，不建议恐慌割肉');
        actions.push('可逢低少量补仓，或等待行业回暖');
        actions.push('设置-25%止损线，防止亏损扩大');
      }
      enhancedAdvice.unshift({
        priority: 'high',
        title: `重点关注：${worst.fundName} 亏损${Math.abs(worst.pnlPercent).toFixed(1)}%`,
        detail: actions.join('；'),
        impact: '及时处理可减少后续亏损扩大风险',
      });
    }

    // 盈利TOP1止盈建议
    if (winners.length > 0 && winners[0].pnlPercent > 20) {
      const best = winners[0];
      enhancedAdvice.unshift({
        priority: 'medium',
        title: `锁定利润：${best.fundName} 盈利${best.pnlPercent.toFixed(1)}%`,
        detail: `建议设置从最高点回撤8%的止盈线；或分3批卖出（当前卖1/3，再涨10%卖1/3，剩余长期持有）`,
        impact: '保护已有利润，避免坐过山车',
      });
    }

    // 个性化配置建议
    if (holdings.length > 0) {
      const catWeights = {};
      for (const f of fundDetails) {
        catWeights[f.category] = (catWeights[f.category] || 0) + f.weight;
      }
      const suggestions = [];
      if (!catWeights['固收'] && !catWeights['货币基金']) suggestions.push('缺少固收类资产（建议10-20%债券基金作为安全垫）');
      if (!catWeights['海外股'] && (catWeights['国内股(进攻)'] || 0) > 40) suggestions.push('缺少海外配置（建议10-15%纳斯达克/标普500对冲A股风险）');
      if ((catWeights['国内股(进攻)'] || 0) > 60) suggestions.push('进攻型资产过重（建议控制在50%以内，增配防御型资产）');
      if (suggestions.length > 0) {
        enhancedAdvice.push({
          priority: 'medium',
          title: '资产配置优化建议',
          detail: suggestions.join('；'),
          impact: '优化资产配置可降低组合波动，提升风险调整后收益',
        });
      }
    }

    res.json({
      healthScore, healthLevel, dataQuality,
      totalCost: parseFloat(totalCost.toFixed(2)),
      totalValue: parseFloat(totalValue.toFixed(2)),
      totalPnl: parseFloat(totalPnl.toFixed(2)),
      totalReturn,
      metrics: { annualizedReturn, maxDrawdown, sharpeRatio, sortinoRatio, calmarRatio, volatility, winRate, profitLossRatio, avgHoldingDays, drawdownRecoveryDays, returnPeriod },
      attribution,
      monthlyReturns: monthlyReturns.slice(-12),
      riskMetrics,
      alerts,
      aiAdvice: enhancedAdvice,
      // 新增：精准分析数据
      fundDetails,
      lossDiagnosis,
      profitAnalysis,
      feeImpact,
      benchmarkComparison,
    });
  } catch (error) {
    logger.error('VIP分析失败:', error.message, error.stack);
    res.status(500).json({ error: 'VIP分析失败，请稍后重试' });
  }
});

module.exports = router;
