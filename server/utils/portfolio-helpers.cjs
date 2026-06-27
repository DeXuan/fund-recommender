const axios = require('axios');
const { API_URLS, REQUEST_DEFAULTS } = require('../config/index.cjs');
const logger = require('./logger.cjs');

/**
 * 获取并存储基金历史净值（从东方财富API）
 * 多个路由模块共用：analytics（收益地图）、insights（VIP分析）
 */
async function fetchAndStoreHistoricalNav(pool, fundCode, fundName, year) {
  // Ensure fund exists in funds table (FK requirement)
  const existingFund = await pool.query('SELECT code FROM funds WHERE code = $1', [fundCode]);
  if (existingFund.rows.length === 0) {
    await pool.query(
      `INSERT INTO funds (code, name, type, industry) VALUES ($1, $2, '混合型', '其他')
       ON CONFLICT (code) DO NOTHING`,
      [fundCode, fundName || fundCode]
    );
  }

  // Fetch up to 260 days of historical NAV from eastmoney
  const res = await axios.get(
    `${API_URLS.EASTMONEY_NAV_HISTORY}?fundCode=${fundCode}&pageIndex=1&pageSize=365`,
    { timeout: 10000, headers: { Referer: REQUEST_DEFAULTS.REFERER_EASTMONEY, 'User-Agent': REQUEST_DEFAULTS.USER_AGENT } }
  );
  const list = res.data?.Data?.LSJZList;
  if (!list || list.length === 0) return;

  let inserted = 0;
  for (const item of list) {
    const navDate = item.FSRQ; // e.g. "2025-01-15"
    const nav = parseFloat(item.DWJZ);
    if (!navDate || isNaN(nav)) continue;

    await pool.query(
      `INSERT INTO fund_nav (fund_code, nav, total_nav, nav_date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (fund_code, nav_date) DO NOTHING`,
      [fundCode, nav, parseFloat(item.LJJZ) || null, navDate]
    );
    inserted++;
  }
  logger.info(`[VIP分析] ${fundCode} 获取并存储 ${inserted} 条历史净值`);
}

/**
 * 计算定投执行日期
 * DCA模块共用
 */
function getDcaExecutionDates(plan, fromDate, toDate) {
  const dates = [];
  const start = new Date(fromDate);
  start.setDate(start.getDate() + 1);
  const end = new Date(toDate);

  const current = new Date(start);
  current.setDate(1);

  while (current <= end) {
    let execDate;

    switch (plan.frequency) {
      case 'weekly': {
        const targetDay = plan.day_of_week || 1;
        const firstOfWeek = new Date(current);
        const dayDiff = (targetDay - firstOfWeek.getDay() + 7) % 7;
        firstOfWeek.setDate(firstOfWeek.getDate() + dayDiff);
        execDate = firstOfWeek;
        current.setDate(current.getDate() + 7);
        break;
      }
      case 'biweekly': {
        const targetDay = plan.day_of_week || 1;
        const firstOfWeek = new Date(current);
        const dayDiff = (targetDay - firstOfWeek.getDay() + 7) % 7;
        firstOfWeek.setDate(firstOfWeek.getDate() + dayDiff);
        execDate = firstOfWeek;
        current.setDate(current.getDate() + 14);
        break;
      }
      case 'monthly': {
        execDate = new Date(current.getFullYear(), current.getMonth(), plan.day_of_month || 1);
        current.setMonth(current.getMonth() + 1);
        break;
      }
      case 'quarterly': {
        execDate = new Date(current.getFullYear(), current.getMonth(), plan.day_of_month || 1);
        current.setMonth(current.getMonth() + 3);
        break;
      }
      default:
        return dates;
    }

    if (execDate >= start && execDate <= end) {
      dates.push(new Date(execDate));
    }
  }

  return dates;
}

/**
 * 资产类别分类
 * insights模块共用
 */
function classifyAsset(fundCode, fundName, industry, type) {
  const name = (fundName || '').toLowerCase();
  const ind = (industry || '').toLowerCase();
  const t = (type || '').toLowerCase();

  // 货币基金
  if (t === '货币' || ind.includes('货币')) return '货币基金';
  // 债券/固收
  if (t === '债券' || ind.includes('债券') || name.includes('债') || name.includes('回报')) return '固收';
  // 海外（QDII / 纳斯达克 / 标普 / 港股）
  if (t === 'qdii' || ind.includes('纳斯达克') || ind.includes('标普') || ind.includes('港股') || name.includes('纳斯达克') || name.includes('标普')) return '海外股';
  // 黄金
  if (ind.includes('黄金') || name.includes('黄金')) return '固收';
  // 国内股 - 进攻型（科技成长类）
  const aggressiveKeywords = ['半导体', '芯片', '人工智能', 'ai', '新能源', '光伏', '军工', '科创', '机器人', '信息技术', '科技'];
  if (aggressiveKeywords.some(k => ind.includes(k) || name.includes(k))) return '国内股(进攻)';
  // 国内股 - 防御型（消费、医药、红利、宽基）
  return '国内股(防御)';
}

/**
 * 生成组合智能建议
 * insights模块使用
 */
function generateSuggestions(holdings, categories, totalValue, market, riskProfile) {
  const suggestions = [];

  if (totalValue === 0) return suggestions;

  const catMap = {};
  for (const c of categories) catMap[c.name] = c;

  // --- 基于资产配置的建议 ---
  const stockCategories = categories.filter(c => c.name.includes('股'));
  const stockWeight = stockCategories.reduce((s, c) => s + c.weight, 0);
  const bondWeight = (catMap['固收']?.weight || 0) + (catMap['货币基金']?.weight || 0);

  if (stockWeight > 80) {
    suggestions.push({
      type: 'risk', level: 'warning',
      title: '权益仓位过高',
      detail: `股票类资产占比 ${stockWeight.toFixed(0)}%，建议适当增配固收或货币基金降低组合波动。`,
    });
  }
  if (bondWeight > 70) {
    suggestions.push({
      type: 'opportunity', level: 'info',
      title: '固收占比偏高',
      detail: `固收+货币占比 ${bondWeight.toFixed(0)}%，收益率可能偏低。可根据风险承受能力适当增配宽基指数基金。`,
    });
  }

  // --- 集中度风险 ---
  for (const h of holdings) {
    const weight = totalValue > 0 ? (h.market_value / totalValue) * 100 : 0;
    if (weight > 30) {
      suggestions.push({
        type: 'risk', level: 'warning',
        title: `持仓集中：${h.fund_name}`,
        detail: `单只基金占比 ${weight.toFixed(1)}%，集中度过高。建议分散至其他资产类别以降低非系统性风险。`,
      });
    }
  }

  // --- 进攻/防御平衡 ---
  const attackWeight = catMap['国内股(进攻)']?.weight || 0;
  const defenseWeight = catMap['国内股(防御)']?.weight || 0;
  if (attackWeight > 50 && defenseWeight < 20) {
    suggestions.push({
      type: 'balance', level: 'info',
      title: '进攻型仓位偏重',
      detail: `进攻型资产(半导体/AI/新能源等)占比 ${attackWeight.toFixed(0)}%，防御型(消费/红利/宽基)仅 ${defenseWeight.toFixed(0)}%。建议增配红利或沪深300等防御性资产平滑波动。`,
    });
  }

  // --- 海外配置 ---
  const overseasWeight = catMap['海外股']?.weight || 0;
  if (overseasWeight < 10 && stockWeight > 30) {
    suggestions.push({
      type: 'opportunity', level: 'info',
      title: '建议增配海外资产',
      detail: '海外资产占比偏低，适当配置纳斯达克100或标普500可提升组合地域分散度，降低单一市场风险。',
    });
  }

  // --- 基于风险评估的建议 ---
  if (riskProfile && riskProfile.allocation) {
    const targetMap = {};
    for (const a of riskProfile.allocation) {
      const ind = a.industry || '';
      if (ind.includes('货币') || ind.includes('余额')) targetMap['货币基金'] = (targetMap['货币基金'] || 0) + a.percentage;
      else if (ind.includes('债') || ind.includes('稳健')) targetMap['固收'] = (targetMap['固收'] || 0) + a.percentage;
      else if (ind.includes('纳斯达克') || ind.includes('标普') || ind.includes('港')) targetMap['海外股'] = (targetMap['海外股'] || 0) + a.percentage;
      else if (ind.includes('半导体') || ind.includes('芯片') || ind.includes('人工智能') || ind.includes('AI') || ind.includes('新能源') || ind.includes('光伏')) targetMap['国内股(进攻)'] = (targetMap['国内股(进攻)'] || 0) + a.percentage;
      else targetMap['国内股(防御)'] = (targetMap['国内股(防御)'] || 0) + a.percentage;
    }

    for (const [cat, target] of Object.entries(targetMap)) {
      const current = catMap[cat]?.weight || 0;
      const diff = target - current;
      if (Math.abs(diff) > 10) {
        const action = diff > 0 ? '增配' : '减配';
        suggestions.push({
          type: 'rebalance', level: diff > 0 ? 'info' : 'warning',
          title: `${cat}: ${action}建议`,
          detail: `您的${riskProfile.riskType}画像建议${cat}配置约${target}%，当前仅${current.toFixed(0)}%，建议${action}约${Math.abs(diff).toFixed(0)}个百分点。`,
        });
      }
    }
  }

  // --- 基于市场行情的建议 ---
  const undervalued = market.filter(m => m.pePercentile > 0 && m.pePercentile < 35);
  const overvalued = market.filter(m => m.pePercentile > 70);

  if (undervalued.length > 0) {
    const names = undervalued.map(m => m.name).join('、');
    suggestions.push({
      type: 'market', level: 'info',
      title: '低估指数值得关注',
      detail: `${names}当前估值处于历史偏低区间(PE分位<35%)，是定投或加仓的好时机。`,
    });
  }
  if (overvalued.length > 0) {
    const names = overvalued.map(m => m.name).join('、');
    suggestions.push({
      type: 'market', level: 'warning',
      title: '高估指数注意风险',
      detail: `${names}当前估值偏高(PE分位>70%)，建议减仓或暂停定投，等待回调。`,
    });
  }

  // --- 盈亏分析 ---
  const lossHoldings = holdings.filter(h => h.pnl < 0);
  const profitHoldings = holdings.filter(h => h.pnl > 0);
  if (lossHoldings.length > 0) {
    const totalLoss = lossHoldings.reduce((s, h) => s + Math.abs(h.pnl), 0);
    const avgLossPct = lossHoldings.reduce((s, h) => s + Math.abs(h.pnl_percent), 0) / lossHoldings.length;
    if (avgLossPct > 10) {
      suggestions.push({
        type: 'action', level: 'warning',
        title: '亏损基金需关注',
        detail: `${lossHoldings.length}只基金合计亏损¥${totalLoss.toFixed(0)}，平均跌幅${avgLossPct.toFixed(1)}%。若基本面未变可坚持定投摊低成本，若行业逻辑已变建议止损换仓。`,
      });
    }
  }

  if (suggestions.length === 0) {
    suggestions.push({
      type: 'info', level: 'success',
      title: '组合状态良好',
      detail: '当前资产配置较为均衡，继续保持定投纪律，定期检视组合。',
    });
  }

  return suggestions;
}

/**
 * 3层NAV解析：API -> fund_nav -> cmb_zhaoyin_nav
 * analytics和insights模块共用
 */
async function resolveLatestNav(pool, fundCodes) {
  const navMap = {};

  // 1. 从 fund_nav 表获取最新净值
  const latestNavResult = await pool.query(
    `SELECT DISTINCT ON (fund_code) fund_code, nav, nav_date
     FROM fund_nav WHERE fund_code = ANY($1)
     ORDER BY fund_code, nav_date DESC`,
    [fundCodes]
  );
  for (const row of latestNavResult.rows) {
    navMap[row.fund_code] = { nav: parseFloat(row.nav), date: row.nav_date };
  }

  // 2. 对 fund_nav 表中没有的代码，从 cmb_zhaoyin_nav 表补充（招行理财产品）
  const missingCodes = fundCodes.filter(code => !navMap[code]);
  if (missingCodes.length > 0) {
    const cmbNavResult = await pool.query(
      `SELECT DISTINCT ON (product_code) product_code, unit_nav, nav_date
       FROM cmb_zhaoyin_nav WHERE product_code = ANY($1)
       ORDER BY product_code, nav_date DESC`,
      [missingCodes]
    );
    for (const row of cmbNavResult.rows) {
      if (row.unit_nav) {
        navMap[row.product_code] = { nav: parseFloat(row.unit_nav), date: row.nav_date };
      }
    }
  }

  return navMap;
}

module.exports = {
  fetchAndStoreHistoricalNav,
  getDcaExecutionDates,
  classifyAsset,
  generateSuggestions,
  resolveLatestNav,
};
