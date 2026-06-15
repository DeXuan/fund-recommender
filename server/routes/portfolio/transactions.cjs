const express = require('express');
const { getPool } = require('../../db.cjs');
const { authMiddleware } = require('../../auth.cjs');

const router = express.Router();
router.use(authMiddleware);

// POST /api/portfolio/sell — 记录卖出/赎回
router.post('/sell', async (req, res) => {
  try {
    const { fund_code, shares, sell_price, sell_date, sell_fee, notes } = req.body;
    if (!fund_code || !shares || !sell_price || !sell_date) {
      return res.status(400).json({ error: '请填写完整的卖出信息' });
    }
    if (shares <= 0 || sell_price <= 0) {
      return res.status(400).json({ error: '份额和卖出价必须大于0' });
    }
    const pool = getPool();

    // 查询该用户该基金的所有买入记录（FIFO）
    const buyRecords = await pool.query(
      `SELECT * FROM fund_records WHERE user_id = $1 AND fund_code = $2 AND record_type IS DISTINCT FROM 'sell'
       ORDER BY buy_date ASC`,
      [req.user.id, fund_code]
    );
    const totalShares = buyRecords.rows.reduce((s, r) => s + parseFloat(r.shares), 0);
    if (shares > totalShares + 0.0001) {
      return res.status(400).json({ error: `赎回份额(${shares})超过持有份额(${totalShares.toFixed(4)})` });
    }

    // 计算加权平均成本
    const totalCost = buyRecords.rows.reduce((s, r) => s + parseFloat(r.shares) * parseFloat(r.cost_price), 0);
    const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
    const pnl = (sell_price - avgCost) * shares - (sell_fee || 0);
    const pnlPercent = avgCost > 0 ? ((sell_price - avgCost) / avgCost * 100) : 0;
    const fundName = buyRecords.rows[0]?.fund_name || fund_code;

    // 插入卖出记录
    const result = await pool.query(
      `INSERT INTO fund_records (user_id, fund_code, fund_name, shares, cost_price, buy_date, buy_fee, notes, record_type,
        sell_price, sell_date, sell_fee, realized_pnl)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'sell',$9,$10,$11,$12) RETURNING *`,
      [req.user.id, fund_code, fundName, -Math.abs(shares), avgCost, sell_date, 0,
       notes || `赎回${shares}份`, sell_price, sell_date, sell_fee || 0, pnl]
    );

    res.json({
      record: result.rows[0],
      summary: {
        sellShares: shares,
        avgCost: Math.round(avgCost * 10000) / 10000,
        sellPrice: sell_price,
        realizedPnl: Math.round(pnl * 100) / 100,
        returnRate: Math.round(pnlPercent * 100) / 100,
        remainingShares: Math.round((totalShares - shares) * 10000) / 10000,
      },
    });
  } catch (error) {
    console.error('卖出记录失败:', error.message);
    res.status(500).json({ error: '卖出记录失败' });
  }
});

// GET /api/portfolio/transactions — 交易流水（按时间排序）
router.get('/transactions', async (req, res) => {
  try {
    const pool = getPool();
    const { fund_code, type, page = 1, pageSize = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = Math.min(parseInt(pageSize), 100);

    let sql = 'SELECT * FROM fund_records WHERE user_id = $1';
    const params = [req.user.id];
    let idx = 1;

    if (fund_code) { params.push(fund_code); sql += ` AND fund_code = $${++idx}`; }
    if (type === 'buy') { sql += " AND (record_type IS NULL OR record_type = 'buy')"; }
    else if (type === 'sell') { sql += " AND record_type = 'sell'"; }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*)');
    const countRes = await pool.query(countSql, params);
    const total = parseInt(countRes.rows[0].count);

    sql += ` ORDER BY buy_date DESC, created_at DESC LIMIT $${++idx} OFFSET $${++idx}`;
    params.push(limit, offset);

    const result = await pool.query(sql, params);

    // 汇总统计
    const statsSql = `SELECT
      COUNT(*) FILTER (WHERE record_type IS NULL OR record_type = 'buy') as buy_count,
      COUNT(*) FILTER (WHERE record_type = 'sell') as sell_count,
      COALESCE(SUM(buy_fee), 0) as total_buy_fees,
      COALESCE(SUM(sell_fee), 0) as total_sell_fees,
      COALESCE(SUM(CASE WHEN record_type = 'sell' THEN realized_pnl ELSE 0 END), 0) as total_realized_pnl
      FROM fund_records WHERE user_id = $1`;
    const statsRes = await pool.query(statsSql, [req.user.id]);

    res.json({
      transactions: result.rows,
      total,
      page: parseInt(page),
      pageSize: limit,
      stats: statsRes.rows[0],
    });
  } catch (error) {
    console.error('获取交易流水失败:', error.message);
    res.status(500).json({ error: '获取交易流水失败' });
  }
});

// GET /api/portfolio/fee-analysis — 费用分析
router.get('/fee-analysis', async (req, res) => {
  try {
    const pool = getPool();
    const records = await pool.query(
      `SELECT fund_code, fund_name, shares, cost_price, buy_fee, sell_fee, record_type
       FROM fund_records WHERE user_id = $1`,
      [req.user.id]
    );

    let totalBuyFees = 0, totalSellFees = 0, totalInvestment = 0, totalSellAmount = 0;
    const fundFees = {};

    for (const r of records.rows) {
      const buyFee = parseFloat(r.buy_fee) || 0;
      const sellFee = parseFloat(r.sell_fee) || 0;
      const shares = parseFloat(r.shares);
      const cost = parseFloat(r.cost_price);
      const isSell = r.record_type === 'sell';

      if (isSell) {
        totalSellFees += sellFee;
        totalSellAmount += Math.abs(shares) * cost;
      } else {
        totalBuyFees += buyFee;
        totalInvestment += shares * cost;
      }

      if (!fundFees[r.fund_code]) {
        fundFees[r.fund_code] = { code: r.fund_code, name: r.fund_name, buyFees: 0, sellFees: 0, investment: 0, sellAmount: 0 };
      }
      if (isSell) {
        fundFees[r.fund_code].sellFees += sellFee;
        fundFees[r.fund_code].sellAmount += Math.abs(shares) * cost;
      } else {
        fundFees[r.fund_code].buyFees += buyFee;
        fundFees[r.fund_code].investment += shares * cost;
      }
    }

    const totalFees = totalBuyFees + totalSellFees;
    const feeRate = totalInvestment > 0 ? (totalFees / totalInvestment * 100) : 0;

    // 按基金分组的费用排名
    const fundFeeList = Object.values(fundFees).map(f => ({
      ...f,
      totalFees: Math.round((f.buyFees + f.sellFees) * 100) / 100,
      feeRate: f.investment > 0 ? Math.round((f.buyFees + f.sellFees) / f.investment * 10000) / 100 : 0,
      investment: Math.round(f.investment * 100) / 100,
    })).sort((a, b) => b.totalFees - a.totalFees);

    res.json({
      summary: {
        totalBuyFees: Math.round(totalBuyFees * 100) / 100,
        totalSellFees: Math.round(totalSellFees * 100) / 100,
        totalFees: Math.round(totalFees * 100) / 100,
        totalInvestment: Math.round(totalInvestment * 100) / 100,
        feeRate: Math.round(feeRate * 100) / 100,
      },
      fundFees: fundFeeList,
    });
  } catch (error) {
    console.error('费用分析失败:', error.message);
    res.status(500).json({ error: '费用分析失败' });
  }
});

// GET /api/portfolio/holdings-risk — 持仓基金风险指标
router.get('/holdings-risk', async (req, res) => {
  try {
    const pool = getPool();
    // 获取用户持仓汇总
    const holdingsRes = await pool.query(
      `SELECT fund_code, fund_name, SUM(CASE WHEN record_type IS DISTINCT FROM 'sell' THEN shares ELSE 0 END) as total_shares,
              SUM(CASE WHEN record_type IS DISTINCT FROM 'sell' THEN shares * cost_price ELSE 0 END) as total_cost
       FROM fund_records WHERE user_id = $1
       GROUP BY fund_code, fund_name
       HAVING SUM(CASE WHEN record_type IS DISTINCT FROM 'sell' THEN shares ELSE 0 END) > 0.001`,
      [req.user.id]
    );

    const results = [];
    for (const h of holdingsRes.rows) {
      // 获取风险指标
      const navRes = await pool.query(
        'SELECT nav, nav_date FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date DESC LIMIT 252',
        [h.fund_code]
      );

      let metrics = null;
      if (navRes.rows.length >= 30) {
        const navs = navRes.rows.reverse().map(n => parseFloat(n.nav)).filter(n => n > 0);
        if (navs.length >= 30) {
          const returns = [];
          for (let i = 1; i < navs.length; i++) returns.push((navs[i] - navs[i - 1]) / navs[i - 1]);
          const n = returns.length;
          const mean = returns.reduce((s, r) => s + r, 0) / n;
          const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
          const std = Math.sqrt(variance);
          const annualReturn = mean * 252;
          const annualVol = std * Math.sqrt(252);
          const riskFree = 0.02 / 252;
          const excess = returns.map(r => r - riskFree);
          const meanExcess = excess.reduce((s, r) => s + r, 0) / n;
          const sharpe = std > 0 ? (meanExcess / std) * Math.sqrt(252) : 0;
          const downSide = returns.filter(r => r < riskFree);
          const downVar = downSide.length > 0 ? downSide.reduce((s, r) => s + (r - riskFree) ** 2, 0) / downSide.length : 0;
          const downDev = Math.sqrt(downVar);
          const sortino = downDev > 0 ? (meanExcess / downDev) * Math.sqrt(252) : 0;
          let maxDD = 0, peak = navs[0];
          for (const nav of navs) { if (nav > peak) peak = nav; const dd = (peak - nav) / peak; if (dd > maxDD) maxDD = dd; }
          const calmar = maxDD > 0 ? annualReturn / maxDD : 0;
          metrics = {
            sharpe: Math.round(sharpe * 100) / 100,
            sortino: Math.round(sortino * 100) / 100,
            calmar: Math.round(calmar * 100) / 100,
            maxDrawdown: Math.round(maxDD * 10000) / 100,
            annualReturn: Math.round(annualReturn * 10000) / 100,
            annualVolatility: Math.round(annualVol * 10000) / 100,
            dataPoints: n,
          };
        }
      }

      // 获取行业信息
      const fundInfo = await pool.query('SELECT industry, valuation, scale FROM funds WHERE code = $1', [h.fund_code]);

      results.push({
        fundCode: h.fund_code,
        fundName: h.fund_name,
        totalShares: parseFloat(h.total_shares),
        totalCost: parseFloat(h.total_cost),
        metrics,
        industry: fundInfo.rows[0]?.industry || '其他',
        valuation: fundInfo.rows[0]?.valuation || '',
        scale: parseFloat(fundInfo.rows[0]?.scale) || 0,
      });
    }

    res.json({ holdings: results });
  } catch (error) {
    console.error('持仓风险分析失败:', error.message);
    res.status(500).json({ error: '持仓风险分析失败' });
  }
});

// GET /api/portfolio/industry-allocation — 行业配置分析
router.get('/industry-allocation', async (req, res) => {
  try {
    const pool = getPool();
    const holdingsRes = await pool.query(
      `SELECT fr.fund_code, fr.fund_name,
              SUM(CASE WHEN fr.record_type IS DISTINCT FROM 'sell' THEN fr.shares ELSE 0 END) as total_shares,
              SUM(CASE WHEN fr.record_type IS DISTINCT FROM 'sell' THEN fr.shares * fr.cost_price ELSE 0 END) as total_cost,
              f.industry, f.valuation, f.scale
       FROM fund_records fr
       LEFT JOIN funds f ON fr.fund_code = f.code
       WHERE fr.user_id = $1
       GROUP BY fr.fund_code, fr.fund_name, f.industry, f.valuation, f.scale
       HAVING SUM(CASE WHEN fr.record_type IS DISTINCT FROM 'sell' THEN fr.shares ELSE 0 END) > 0.001`,
      [req.user.id]
    );

    // 更新NAV
    for (const h of holdingsRes.rows) {
      const navRes = await pool.query(
        'SELECT current_nav, market_value, pnl, pnl_percent FROM fund_records WHERE user_id = $1 AND fund_code = $2 AND record_type IS DISTINCT FROM \'sell\' ORDER BY buy_date DESC LIMIT 1',
        [req.user.id, h.fund_code]
      );
      if (navRes.rows[0]?.market_value) {
        h.market_value = parseFloat(navRes.rows[0].market_value);
        h.pnl = parseFloat(navRes.rows[0].pnl);
        h.pnl_percent = parseFloat(navRes.rows[0].pnl_percent);
        h.current_nav = parseFloat(navRes.rows[0].current_nav);
      } else {
        h.market_value = parseFloat(h.total_cost);
        h.pnl = 0;
        h.pnl_percent = 0;
      }
    }

    const totalValue = holdingsRes.rows.reduce((s, h) => s + h.market_value, 0);

    // 按行业分组
    const industryMap = {};
    for (const h of holdingsRes.rows) {
      const ind = h.industry || '其他';
      if (!industryMap[ind]) industryMap[ind] = { industry: ind, totalValue: 0, totalPnl: 0, funds: [], fundCount: 0 };
      industryMap[ind].totalValue += h.market_value;
      industryMap[ind].totalPnl += h.pnl;
      industryMap[ind].funds.push({ code: h.fund_code, name: h.fund_name, value: h.market_value, pnl: h.pnl, pnlPercent: h.pnl_percent });
      industryMap[ind].fundCount++;
    }

    const allocations = Object.values(industryMap).map(a => ({
      ...a,
      weight: totalValue > 0 ? Math.round(a.totalValue / totalValue * 10000) / 100 : 0,
      totalValue: Math.round(a.totalValue * 100) / 100,
      totalPnl: Math.round(a.totalPnl * 100) / 100,
      returnRate: a.totalValue > 0 ? Math.round(a.totalPnl / (a.totalValue - a.totalPnl) * 10000) / 100 : 0,
    })).sort((a, b) => b.weight - a.weight);

    // 集中度分析
    const topWeight = allocations[0]?.weight || 0;
    const hhi = allocations.reduce((s, a) => s + (a.weight / 100) ** 2, 0);
    const concentration = hhi > 0.25 ? '高集中度' : hhi > 0.15 ? '中等集中度' : '分散配置';

    // 行业偏离建议
    const suggestions = [];
    if (topWeight > 40) suggestions.push({ type: 'warning', text: `${allocations[0].industry}占比${topWeight}%过高，建议单行业不超过30%` });
    if (allocations.length < 3) suggestions.push({ type: 'info', text: `仅覆盖${allocations.length}个行业，建议增加行业分散度` });
    const hasBond = allocations.some(a => a.industry === '债券' || a.industry === '固收');
    if (!hasBond) suggestions.push({ type: 'info', text: '缺少固收类资产，建议配置10-20%债券基金降低波动' });

    res.json({
      allocations,
      totalValue: Math.round(totalValue * 100) / 100,
      industryCount: allocations.length,
      concentration,
      hhi: Math.round(hhi * 10000) / 10000,
      topIndustry: allocations[0]?.industry || '',
      topWeight,
      suggestions,
    });
  } catch (error) {
    console.error('行业配置分析失败:', error.message);
    res.status(500).json({ error: '行业配置分析失败' });
  }
});

// GET /api/portfolio/performance-attribution — 收益归因分析
router.get('/performance-attribution', async (req, res) => {
  try {
    const pool = getPool();
    const holdingsRes = await pool.query(
      `SELECT fund_code, fund_name,
              SUM(CASE WHEN record_type IS DISTINCT FROM 'sell' THEN shares ELSE 0 END) as total_shares,
              SUM(CASE WHEN record_type IS DISTINCT FROM 'sell' THEN shares * cost_price ELSE 0 END) as total_cost
       FROM fund_records WHERE user_id = $1
       GROUP BY fund_code, fund_name
       HAVING SUM(CASE WHEN record_type IS DISTINCT FROM 'sell' THEN shares ELSE 0 END) > 0.001`,
      [req.user.id]
    );

    const attributions = [];
    let totalValue = 0;

    for (const h of holdingsRes.rows) {
      const navRes = await pool.query(
        'SELECT current_nav, market_value, pnl, pnl_percent FROM fund_records WHERE user_id = $1 AND fund_code = $2 AND record_type IS DISTINCT FROM \'sell\' ORDER BY buy_date DESC LIMIT 1',
        [req.user.id, h.fund_code]
      );
      const nav = navRes.rows[0];
      const marketValue = nav?.market_value ? parseFloat(nav.market_value) : parseFloat(h.total_cost);
      const pnl = nav?.pnl ? parseFloat(nav.pnl) : 0;
      const cost = parseFloat(h.total_cost);
      totalValue += marketValue;

      attributions.push({
        fundCode: h.fund_code,
        fundName: h.fund_name,
        cost: Math.round(cost * 100) / 100,
        marketValue: Math.round(marketValue * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
        returnRate: cost > 0 ? Math.round(pnl / cost * 10000) / 100 : 0,
        contribution: 0, // filled below
      });
    }

    // 计算每只基金对总收益的贡献
    const totalPnl = attributions.reduce((s, a) => s + a.pnl, 0);
    for (const a of attributions) {
      a.contribution = totalValue > 0 ? Math.round(a.pnl / totalValue * 10000) / 100 : 0;
      a.weight = totalValue > 0 ? Math.round(a.marketValue / totalValue * 10000) / 100 : 0;
    }
    attributions.sort((a, b) => b.contribution - a.contribution);

    // 最大贡献和最大拖累
    const best = attributions.find(a => a.pnl > 0);
    const worst = [...attributions].reverse().find(a => a.pnl < 0);

    res.json({
      attributions,
      totalPnl: Math.round(totalPnl * 100) / 100,
      totalValue: Math.round(totalValue * 100) / 100,
      bestContributor: best ? { name: best.fundName, contribution: best.contribution } : null,
      worstContributor: worst ? { name: worst.fundName, contribution: worst.contribution } : null,
    });
  } catch (error) {
    console.error('收益归因失败:', error.message);
    res.status(500).json({ error: '收益归因失败' });
  }
});

module.exports = router;
