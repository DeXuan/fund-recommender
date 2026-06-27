const express = require('express');
const router = express.Router();
const { getPool } = require('../db.cjs');
const { authMiddleware, svipExclusiveMiddleware } = require('../auth.cjs');
const { queryFundsForScoring } = require('../fund-service.cjs');
const logger = require('../utils/logger.cjs');

router.use(authMiddleware);
router.use(svipExclusiveMiddleware);

// 自然语言解析引擎（规则-based，无需LLM）
function parseNaturalLanguageQuery(query) {
  const conditions = [];
  const q = query.trim();

  // 收益条件: "近1年收益>20%", "收益>15%", "1年收益超20%"
  const returnMatch = q.match(/(?:近)?(?:1|一)年(?:收益|回报|涨幅)[>＞]?\s*(\d+(?:\.\d+)?)\s*%?/);
  if (returnMatch) {
    conditions.push({ field: 'return1y', op: '>', value: parseFloat(returnMatch[1]), label: `近1年收益>${returnMatch[1]}%` });
  }
  const returnGte = q.match(/收益[>＞≥不低于超]+?\s*(\d+(?:\.\d+)?)\s*%?/);
  if (!returnMatch && returnGte) {
    conditions.push({ field: 'return1y', op: '>', value: parseFloat(returnGte[1]), label: `收益>${returnGte[1]}%` });
  }

  // 费率条件: "低费率", "费率<1%", "费率低于0.5%"
  if (/低费率|便宜|省钱/.test(q)) {
    conditions.push({ field: 'totalFee', op: '<', value: 0.8, label: '低费率(<0.8%)' });
  }
  const feeMatch = q.match(/费率[<＜低于]+?\s*(\d+(?:\.\d+)?)\s*%?/);
  if (feeMatch) {
    conditions.push({ field: 'totalFee', op: '<', value: parseFloat(feeMatch[1]), label: `费率<${feeMatch[1]}%` });
  }

  // 规模条件: "规模>50亿", "大规模", "规模超100亿"
  const scaleMatch = q.match(/规模[>＞不低于超]+?\s*(\d+(?:\.\d+)?)\s*亿?/);
  if (scaleMatch) {
    conditions.push({ field: 'scale', op: '>', value: parseFloat(scaleMatch[1]), label: `规模>${scaleMatch[1]}亿` });
  }
  if (/大规模|百亿|千亿/.test(q) && !scaleMatch) {
    conditions.push({ field: 'scale', op: '>', value: 50, label: '大规模(>50亿)' });
  }

  // 行业/指数条件
  const industries = [
    '沪深300', '中证500', '中证1000', '创业板', '科创板',
    '医药', '科技', '消费', '新能源', '半导体', '白酒', '军工', '金融', '光伏', '芯片', '人工智能', '银行', '证券', '地产', '煤炭', '有色'
  ];
  for (const ind of industries) {
    if (q.includes(ind)) {
      conditions.push({ field: 'industry', op: '=', value: ind, label: ind });
      break;
    }
  }

  // 基金类型
  if (/qdii|海外|美股|纳斯达克|标普/.test(q)) {
    conditions.push({ field: 'type', op: '=', value: 'QDII', label: 'QDII基金' });
  } else if (/etf|指数基金/.test(q)) {
    conditions.push({ field: 'type', op: '=', value: 'ETF', label: 'ETF基金' });
  } else if (/债|债券|固收/.test(q)) {
    conditions.push({ field: 'type', op: '=', value: '债券型', label: '债券型基金' });
  } else if (/混合|灵活/.test(q)) {
    conditions.push({ field: 'type', op: '=', value: '混合型', label: '混合型基金' });
  } else if (/股票|主动/.test(q)) {
    conditions.push({ field: 'type', op: '=', value: '股票型', label: '股票型基金' });
  }

  // 评级条件: "高评级", "五星"
  if (/高评级|五星|四星以上/.test(q)) {
    conditions.push({ field: 'rating', op: '>=', value: 4, label: '高评级(≥4星)' });
  }

  return conditions;
}

function buildFilterFromConditions(conditions) {
  const filters = {};
  for (const c of conditions) {
    if (c.field === 'industry') filters.industry = c.value;
    else if (c.field === 'type') filters.type = c.value;
  }
  return filters;
}

function filterAndScore(funds, conditions) {
  let filtered = [...funds];

  for (const c of conditions) {
    if (c.field === 'return1y') {
      filtered = filtered.filter(f => (f.return1y || 0) > c.value);
    } else if (c.field === 'totalFee') {
      filtered = filtered.filter(f => (f.totalFee || 0) > 0 && (f.totalFee || 0) < c.value);
    } else if (c.field === 'scale') {
      filtered = filtered.filter(f => (f.scale || 0) > c.value);
    } else if (c.field === 'rating') {
      filtered = filtered.filter(f => (f.rating || 0) >= c.value);
    }
  }

  // 按收益排序
  filtered.sort((a, b) => (b.return1y || 0) - (a.return1y || 0));
  return filtered.slice(0, 30);
}

// POST /api/stock-picker/nl-screen — 自然语言筛选
router.post('/api/stock-picker/nl-screen', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || query.length > 200) {
      return res.status(400).json({ error: '请输入有效的筛选条件（200字以内）' });
    }

    const conditions = parseNaturalLanguageQuery(query);
    if (conditions.length === 0) {
      return res.json({
        parsed: { conditions: [], raw: query },
        results: [],
        total: 0,
        suggestion: '未能识别有效的筛选条件。试试："近1年收益>20%的低费率基金" 或 "规模>50亿的沪深300基金"'
      });
    }

    const filters = buildFilterFromConditions(conditions);
    const funds = await queryFundsForScoring(filters);
    const results = filterAndScore(funds, conditions);

    res.json({
      parsed: { conditions, raw: query },
      results: results.map(f => ({
        code: f.code, name: f.name, type: f.type, industry: f.industry,
        return1y: f.return1y, totalFee: f.totalFee, scale: f.scale,
        rating: f.rating, manager: f.manager, nav: f.nav
      })),
      total: results.length
    });
  } catch (error) {
    logger.error(`自然语言筛选失败: ${error.message}`);
    res.status(500).json({ error: '筛选失败' });
  }
});

module.exports = router;
