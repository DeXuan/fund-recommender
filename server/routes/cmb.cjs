/**
 * 招行理财产品路由
 */

const express = require('express');
const { getPool } = require('../db.cjs');
const { authMiddleware, adminMiddleware } = require('../auth.cjs');
const { createHandler } = require('../utils/route-handler.cjs');

const router = express.Router();
const handler = createHandler('招行理财');

// 获取招行理财产品列表
router.get('/api/cmb-products', handler(async () => {
  const pool = getPool();

  const prodResult = await pool.query(
    `SELECT product_code, product_name, risk_level, product_status, investment_period, nav, nav_date, return_1m, return_3m, return_6m, return_1y, updated_at
     FROM cmb_products ORDER BY product_code`
  );

  const navResult = await pool.query(`
    SELECT DISTINCT ON (product_code)
      product_code, unit_nav, cumulative_nav, nav_date,
      return_1m_annualized, return_3m_annualized, return_6m_annualized,
      return_ytd_annualized, return_since_annualized
    FROM cmb_zhaoyin_nav
    ORDER BY product_code, nav_date DESC
  `);
  const navMap = {};
  for (const r of navResult.rows) {
    navMap[r.product_code] = r;
  }

  return prodResult.rows.map(r => {
    const code = r.product_code;
    const nav = navMap[code] || {};
    const unitNav = nav.unit_nav ? parseFloat(nav.unit_nav) : (r.nav ? parseFloat(r.nav) : null);
    const navDate = nav.nav_date
      ? (nav.nav_date instanceof Date ? nav.nav_date.toISOString().slice(0, 10) : nav.nav_date)
      : (r.nav_date instanceof Date ? r.nav_date.toISOString().slice(0, 10) : (r.nav_date || null));
    const return1m = nav.return_1m_annualized ? parseFloat(nav.return_1m_annualized) : (r.return_1m ? parseFloat(r.return_1m) : null);
    const return3m = nav.return_3m_annualized ? parseFloat(nav.return_3m_annualized) : (r.return_3m ? parseFloat(r.return_3m) : null);
    const return6m = nav.return_6m_annualized ? parseFloat(nav.return_6m_annualized) : (r.return_6m ? parseFloat(r.return_6m) : null);
    const returnYtd = nav.return_ytd_annualized ? parseFloat(nav.return_ytd_annualized) : null;
    const returnSince = nav.return_since_annualized ? parseFloat(nav.return_since_annualized) : (r.return_1y ? parseFloat(r.return_1y) : null);

    return {
      product_code: code, product_name: r.product_name,
      risk_level: r.risk_level || '', product_status: r.product_status || '',
      investment_period: r.investment_period || '',
      unit_nav: unitNav, nav_date: navDate,
      return_1m: return1m, return_3m: return3m, return_6m: return6m,
      return_ytd: returnYtd, return_since: returnSince,
      updated_at: r.updated_at || null,
    };
  });
}));

// 按产品代码查询
router.get('/api/cmb-products/lookup/:code', handler(async (req) => {
  const pool = getPool();
  const { code } = req.params;
  const result = await pool.query(
    `SELECT product_code, product_name, nav AS unit_nav, nav_date FROM cmb_products WHERE product_code = $1`,
    [code]
  );
  if (result.rows.length === 0) {
    const err = new Error('产品不存在');
    err.status = 404;
    throw err;
  }
  const navResult = await pool.query(
    `SELECT unit_nav, nav_date FROM cmb_zhaoyin_nav WHERE product_code = $1 ORDER BY nav_date DESC LIMIT 1`,
    [code]
  );
  const row = result.rows[0];
  const nav = navResult.rows[0];
  return {
    product_code: row.product_code, product_name: row.product_name,
    unit_nav: nav ? parseFloat(nav.unit_nav) : (row.unit_nav ? parseFloat(row.unit_nav) : null),
    nav_date: nav ? nav.nav_date : row.nav_date,
  };
}));

// 手动触发招行理财产品数据更新
router.post('/api/cmb-products/update', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { spawn } = require('child_process');
    const path = require('path');
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'fetch_cmb_personal_nav.py');

    const proc1 = spawn('python', [scriptPath, 'weekly'], {
      env: { ...process.env }, cwd: path.join(__dirname, '..', '..'), stdio: 'pipe',
    });
    proc1.stdout.on('data', (data) => console.log(`[CMB-WEEKLY] ${data.toString().trim()}`));
    proc1.stderr.on('data', (data) => console.error(`[CMB-WEEKLY] ${data.toString().trim()}`));
    proc1.on('close', (code) => {
      console.log(`[CMB-WEEKLY] 完成，退出码: ${code}`);
      const proc2 = spawn('python', [scriptPath, 'target'], {
        env: { ...process.env }, cwd: path.join(__dirname, '..', '..'), stdio: 'pipe',
      });
      proc2.stdout.on('data', (data) => console.log(`[CMB-TARGET] ${data.toString().trim()}`));
      proc2.stderr.on('data', (data) => console.error(`[CMB-TARGET] ${data.toString().trim()}`));
      proc2.on('close', (code2) => console.log(`[CMB-TARGET] 完成，退出码: ${code2}`));
      proc2.on('error', (err) => console.error('[CMB-TARGET] 启动失败:', err.message));
    });
    proc1.on('error', (err) => console.error('[CMB-WEEKLY] 启动失败:', err.message));

    res.json({ success: true, message: '招行理财产品数据更新已启动（全量+目标产品）' });
  } catch (error) {
    console.error('触发招行理财产品更新失败:', error.message);
    res.status(500).json({ error: '触发更新失败' });
  }
});

// 获取单个招行理财产品的净值历史
router.get('/api/cmb-products/:code/nav-history', handler(async (req) => {
  const pool = getPool();
  const { code } = req.params;

  const prodResult = await pool.query(
    'SELECT product_code, product_name, risk_level, product_status FROM cmb_products WHERE product_code = $1',
    [code]
  );
  if (prodResult.rows.length === 0) {
    const err = new Error('产品不存在');
    err.status = 404;
    throw err;
  }

  const navResult = await pool.query(
    `SELECT unit_nav, cumulative_nav, nav_date FROM cmb_zhaoyin_nav
     WHERE product_code = $1 ORDER BY nav_date ASC`,
    [code]
  );

  const product = prodResult.rows[0];
  const navHistory = navResult.rows.map(r => ({
    unit_nav: parseFloat(r.unit_nav),
    cumulative_nav: r.cumulative_nav ? parseFloat(r.cumulative_nav) : null,
    nav_date: r.nav_date instanceof Date ? r.nav_date.toISOString().slice(0, 10) : r.nav_date,
  }));

  if (navHistory.length > 0) {
    const firstNav = navHistory[0].unit_nav;
    for (const item of navHistory) {
      item.cumulative_return = parseFloat(((item.unit_nav - firstNav) / firstNav * 100).toFixed(4));
    }
  }

  return {
    product_code: product.product_code, product_name: product.product_name,
    risk_level: product.risk_level, product_status: product.product_status,
    nav_history: navHistory,
  };
}));

// 招银理财净值 API
router.get('/api/cmb-zhaoyin-nav', handler(async (req) => {
  const pool = getPool();
  const { search, sort, order, page = 1, pageSize = 50 } = req.query;
  const safePageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 50));
  const safePage = Math.max(1, parseInt(page) || 1);

  let where = '';
  const params = [];
  let idx = 1;

  if (search) {
    where = `WHERE n.product_code ILIKE $${idx} OR n.product_name ILIKE $${idx}`;
    params.push(`%${search}%`);
    idx++;
  }

  const countSql = `SELECT COUNT(DISTINCT n.product_code) FROM cmb_zhaoyin_nav n ${where}`;
  const countResult = await pool.query(countSql, params);
  const total = parseInt(countResult.rows[0].count);

  const sortMap = {
    'product_code': 'n.product_code', 'product_name': 'n.product_name',
    'unit_nav': 'n.unit_nav', 'cumulative_nav': 'n.cumulative_nav', 'nav_date': 'n.nav_date',
  };
  const sortCol = sortMap[sort] || 'n.nav_date';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
  const offset = (safePage - 1) * safePageSize;

  const dataSql = `
    SELECT DISTINCT ON (n.product_code)
      n.product_code, n.product_name, n.unit_nav, n.cumulative_nav, n.nav_date,
      n.return_1m_annualized, n.return_3m_annualized, n.return_6m_annualized,
      n.return_ytd_annualized, n.return_since_annualized
    FROM cmb_zhaoyin_nav n ${where}
    ORDER BY n.product_code, n.nav_date DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `;
  const dataResult = await pool.query(dataSql, [...params, safePageSize, offset]);

  return {
    data: dataResult.rows.map(r => ({
      product_code: r.product_code, product_name: r.product_name,
      unit_nav: r.unit_nav ? parseFloat(r.unit_nav) : null,
      cumulative_nav: r.cumulative_nav ? parseFloat(r.cumulative_nav) : null,
      nav_date: r.nav_date,
      return_1m_annualized: r.return_1m_annualized ? parseFloat(r.return_1m_annualized) : null,
      return_3m_annualized: r.return_3m_annualized ? parseFloat(r.return_3m_annualized) : null,
      return_6m_annualized: r.return_6m_annualized ? parseFloat(r.return_6m_annualized) : null,
      return_ytd_annualized: r.return_ytd_annualized ? parseFloat(r.return_ytd_annualized) : null,
      return_since_inception_annualized: r.return_since_annualized ? parseFloat(r.return_since_annualized) : null,
    })),
    total, page: safePage, pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize),
  };
}));

// 手动触发招银理财净值数据更新
router.post('/api/cmb-zhaoyin-nav/update', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { spawn } = require('child_process');
    const scriptPath = require('path').join(__dirname, '..', '..', 'scripts', 'fetch_cmb_personal_nav.py');
    const python = spawn('python', [scriptPath], {
      env: { ...process.env }, cwd: require('path').join(__dirname, '..', '..'),
    });
    let output = '';
    python.stdout.on('data', (data) => { output += data.toString(); });
    python.stderr.on('data', (data) => { output += data.toString(); });
    python.on('close', (code) => { console.log(`[招银理财NAV] 爬取脚本退出，code=${code}`); });
    res.json({ success: true, message: '招银理财净值数据更新已启动' });
  } catch (error) {
    console.error('触发招银理财净值更新失败:', error.message);
    res.status(500).json({ error: '触发更新失败' });
  }
});

module.exports = { router };
