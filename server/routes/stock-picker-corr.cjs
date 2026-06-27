const express = require('express');
const router = express.Router();
const { getPool } = require('../db.cjs');
const { authMiddleware, subscriptionMiddleware } = require('../auth.cjs');
const logger = require('../utils/logger.cjs');

router.use(authMiddleware);
router.use(subscriptionMiddleware);

// 计算Pearson相关系数
function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 10) return 0;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

// POST /api/stock-picker/correlation — 相关性分析
router.post('/api/stock-picker/correlation', async (req, res) => {
  try {
    const { codes } = req.body;
    if (!codes || !Array.isArray(codes) || codes.length < 2 || codes.length > 20) {
      return res.status(400).json({ error: '请输入2-20只基金代码' });
    }
    const validCodes = codes.filter(c => /^\d{6}$/.test(c));
    if (validCodes.length < 2) return res.status(400).json({ error: '至少需要2只有效基金代码' });

    const pool = getPool();

    // 批量获取基金名称
    const fundInfoResult = await pool.query(
      'SELECT code, name, industry FROM funds WHERE code = ANY($1)', [validCodes]
    );
    const fundInfoMap = new Map(fundInfoResult.rows.map(r => [r.code, r]));

    // 批量获取净值历史（250个交易日）
    const navResult = await pool.query(
      `SELECT fund_code, nav, nav_date FROM fund_nav
       WHERE fund_code = ANY($1) AND nav_date >= NOW() - INTERVAL '400 days'
       ORDER BY fund_code, nav_date`,
      [validCodes]
    );

    // 按基金分组并计算日收益率
    const fundReturns = new Map();
    for (const code of validCodes) {
      const navs = navResult.rows.filter(r => r.fund_code === code);
      const returns = [];
      for (let i = 1; i < navs.length; i++) {
        const prev = parseFloat(navs[i - 1].nav);
        const curr = parseFloat(navs[i].nav);
        if (prev > 0) returns.push((curr - prev) / prev);
      }
      fundReturns.set(code, returns);
    }

    // 计算相关性矩阵
    const n = validCodes.length;
    const matrix = [];
    const highCorrelationPairs = [];

    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          row.push(1.0);
        } else {
          const ri = fundReturns.get(validCodes[i]) || [];
          const rj = fundReturns.get(validCodes[j]) || [];
          // 对齐长度
          const minLen = Math.min(ri.length, rj.length);
          const corr = pearsonCorrelation(ri.slice(-minLen), rj.slice(-minLen));
          row.push(Math.round(corr * 1000) / 1000);

          if (i < j && corr > 0.8) {
            highCorrelationPairs.push({
              a: validCodes[i], b: validCodes[j],
              aName: fundInfoMap.get(validCodes[i])?.name || validCodes[i],
              bName: fundInfoMap.get(validCodes[j])?.name || validCodes[j],
              correlation: Math.round(corr * 1000) / 1000
            });
          }
        }
      }
      matrix.push(row);
    }

    // 计算分散化得分
    let offDiagSum = 0, offDiagCount = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        offDiagSum += Math.abs(matrix[i][j]);
        offDiagCount++;
      }
    }
    const avgCorrelation = offDiagCount > 0 ? offDiagSum / offDiagCount : 0;
    const diversificationScore = Math.round((1 - avgCorrelation) * 100) / 100;

    res.json({
      correlationMatrix: matrix,
      fundCodes: validCodes,
      fundNames: validCodes.map(c => fundInfoMap.get(c)?.name || c),
      fundIndustries: validCodes.map(c => fundInfoMap.get(c)?.industry || ''),
      diversificationScore,
      avgCorrelation: Math.round(avgCorrelation * 1000) / 1000,
      highCorrelationPairs,
      suggestion: diversificationScore < 0.3
        ? '组合分散度较低，建议增加不同行业/风格的基金'
        : diversificationScore < 0.6
          ? '组合分散度一般，可适当调整'
          : '组合分散度良好'
    });
  } catch (error) {
    logger.error(`相关性分析失败: ${error.message}`);
    res.status(500).json({ error: '相关性分析失败' });
  }
});

module.exports = router;
