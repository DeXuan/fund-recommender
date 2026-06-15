/**
 * AI Context Provider - Injects live portfolio, market, and fund data into system prompt
 * Optimized: parallel queries, single JOIN instead of N+1
 */

const { getPool } = require('../db.cjs');
const fundService = require('../fund-service.cjs');

function extractFundCodes(message) {
  const codePattern = /\b(\d{6})\b/g;
  const codes = [];
  let match;
  while ((match = codePattern.exec(message)) !== null) {
    codes.push(match[1]);
  }
  return [...new Set(codes)];
}

async function buildContext(message, userId) {
  const pool = getPool();
  const fundCodes = extractFundCodes(message);
  let context = '';

  // 并行执行所有数据查询
  const tasks = [];

  // 1. 持仓数据（单次 JOIN 查询，不再 N+1）
  if (userId) {
    tasks.push(
      pool.query(`
        WITH latest_nav AS (
          SELECT DISTINCT ON (fund_code)
            fund_code, current_nav, market_value, pnl, pnl_percent, nav_updated_at
          FROM fund_records
          WHERE user_id = $1 AND record_type != 'sell'
          ORDER BY fund_code, updated_at DESC
        )
        SELECT h.fund_code, h.fund_name, h.total_shares, h.total_cost,
               n.current_nav, n.market_value, n.pnl, n.pnl_percent, n.nav_updated_at
        FROM (
          SELECT fund_code, fund_name,
                 SUM(shares) as total_shares,
                 SUM(shares * cost_price + buy_fee) as total_cost
          FROM fund_records
          WHERE user_id = $1 AND record_type != 'sell'
          GROUP BY fund_code, fund_name
          HAVING SUM(shares) > 0
        ) h
        LEFT JOIN latest_nav n ON n.fund_code = h.fund_code
        ORDER BY n.market_value DESC NULLS LAST
      `, [userId]).catch(() => ({ rows: [] }))
    );
  } else {
    tasks.push(Promise.resolve({ rows: [] }));
  }

  // 2. 市场指数
  tasks.push(
    fundService.getMarketIndices().catch(() => [])
  );

  // 3. 行业数据
  tasks.push(
    pool.query(
      `SELECT industry, COUNT(*) as count FROM funds WHERE industry IS NOT NULL AND industry != '' GROUP BY industry ORDER BY count DESC LIMIT 15`
    ).catch(() => ({ rows: [] }))
  );

  // 4. 已实现收益
  if (userId) {
    tasks.push(
      pool.query(`
        SELECT fund_name, SUM(realized_pnl) as realized_pnl
        FROM fund_records
        WHERE user_id = $1 AND record_type = 'sell' AND realized_pnl IS NOT NULL
        GROUP BY fund_name
      `, [userId]).catch(() => ({ rows: [] }))
    );
  } else {
    tasks.push(Promise.resolve({ rows: [] }));
  }

  // 5. 具体基金详情（最多 3 只）
  if (fundCodes.length > 0) {
    tasks.push(
      Promise.all(
        fundCodes.slice(0, 3).map(code =>
          fundService.getAllFundsWithNav({ search: code })
            .then(result => {
              const funds = result.data || result || [];
              return funds.find(f => f.code === code) || funds[0] || null;
            })
            .catch(() => null)
        )
      )
    );
  } else {
    tasks.push(Promise.resolve([]));
  }

  const [holdingsRes, indices, industriesRes, realizedRes, fundDetails] = await Promise.all(tasks);

  // === 组装持仓上下文 ===
  const holdings = holdingsRes.rows || [];
  if (holdings.length > 0) {
    const totalValue = holdings.reduce((s, h) => s + parseFloat(h.market_value || 0), 0);
    const totalCost = holdings.reduce((s, h) => s + parseFloat(h.total_cost || 0), 0);
    const totalPnl = totalValue - totalCost;
    const totalReturn = totalCost > 0 ? (totalPnl / totalCost * 100) : 0;

    context += `\n## 📦 用户当前持仓\n\n`;
    context += `| 基金代码 | 基金名称 | 份额 | 成本价 | 现价 | 市值 | 收益 | 收益率 |\n`;
    context += `|:--------:|---------|-----:|------:|-----:|-----:|-----:|------:|\n`;
    for (const h of holdings) {
      const shares = parseFloat(h.total_shares);
      const cost = parseFloat(h.total_cost);
      const nav = parseFloat(h.current_nav || 0);
      const value = parseFloat(h.market_value || 0);
      const pnl = parseFloat(h.pnl || 0);
      const pnlPct = parseFloat(h.pnl_percent || 0);
      context += `| ${h.fund_code} | ${h.fund_name} | ${shares.toFixed(2)} | ${cost > 0 ? (cost / shares).toFixed(4) : 'N/A'} | ${nav?.toFixed(4) || 'N/A'} | ${value.toFixed(2)} | ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} | ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% |\n`;
    }
    context += `\n**💰 持仓汇总**：总市值 **¥${totalValue.toFixed(2)}** | 总成本 **¥${totalCost.toFixed(2)}** | 总收益 **${totalPnl >= 0 ? '+' : ''}¥${totalPnl.toFixed(2)}**（**${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%**）\n`;

    if (holdings.length > 1) {
      context += `\n**📊 持仓集中度**：\n`;
      for (const h of holdings) {
        const value = parseFloat(h.market_value || 0);
        const weight = totalValue > 0 ? (value / totalValue * 100) : 0;
        context += `- ${h.fund_name}：占比 **${weight.toFixed(1)}%**\n`;
      }
    }

    // 已实现收益
    const realizedRows = realizedRes.rows || [];
    if (realizedRows.length > 0) {
      const totalRealized = realizedRows.reduce((s, r) => s + parseFloat(r.realized_pnl || 0), 0);
      context += `\n**💎 已实现收益**：${totalRealized >= 0 ? '+' : ''}¥${totalRealized.toFixed(2)}\n`;
    }
  }

  // === 组装市场指数上下文 ===
  if (indices && indices.length > 0) {
    context += `\n## 📈 大盘指数行情\n\n`;
    context += `| 指数名称 | 最新价 | 涨跌幅 | PE分位 | 估值状态 |\n`;
    context += `|:--------:|------:|------:|------:|:------:|\n`;
    for (const idx of indices) {
      const icon = (idx.changePercent || 0) >= 0 ? '🔴' : '🟢';
      const pe = idx.pePercentile != null ? `${idx.pePercentile}%` : '-';
      context += `| ${idx.name} | ${idx.price?.toFixed(2) || '-'} | ${icon} ${(idx.changePercent || 0) >= 0 ? '+' : ''}${(idx.changePercent || 0).toFixed(2)}% | ${pe} | ${idx.valuationStatus || idx.valuation || '-'} |\n`;
    }
  }

  // === 组装行业上下文 ===
  const industries = industriesRes.rows || [];
  if (industries.length > 0) {
    context += `\n## 🏷️ 热门行业板块\n\n`;
    context += industries.map(r => `${r.industry}(${r.count}只)`).join(' | ');
    context += '\n';
  }

  // === 组装基金详情上下文 ===
  if (fundDetails && fundDetails.length > 0) {
    for (const fund of fundDetails) {
      if (!fund) continue;
      context += `\n## 🔍 基金详情：${fund.name}（${fund.code}）\n\n`;
      context += `- 类型：${fund.type || '-'}\n`;
      context += `- 行业：${fund.industry || '-'}\n`;
      context += `- 规模：${fund.scale?.toFixed(2) || '-'}亿\n`;
      context += `- 费率：${fund.totalFee?.toFixed(2) || '-'}%\n`;
      context += `- 近1年收益：${fund.return1y >= 0 ? '+' : ''}${fund.return1y?.toFixed(2) || '-'}%\n`;
      context += `- 近6月收益：${fund.return6m >= 0 ? '+' : ''}${fund.return6m?.toFixed(2) || '-'}%\n`;
      context += `- 近3月收益：${fund.return3m >= 0 ? '+' : ''}${fund.return3m?.toFixed(2) || '-'}%\n`;
      context += `- 近1月收益：${fund.return1m >= 0 ? '+' : ''}${fund.return1m?.toFixed(2) || '-'}%\n`;
      if (fund.isGoldSelected) context += `- ⭐ **金选基金**\n`;
      if (fund.manager) context += `- 基金经理：${fund.manager}\n`;
    }
  }

  return context;
}

module.exports = { buildContext };
