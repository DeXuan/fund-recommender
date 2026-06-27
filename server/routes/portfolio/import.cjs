const express = require('express');
const logger = require('../../utils/logger.cjs');
const multer = require('multer');
const iconv = require('iconv-lite');
const { getPool } = require('../../db.cjs');
const { authMiddleware } = require('../../auth.cjs');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 512 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
      return cb(new Error('只允许上传CSV文件'));
    }
    cb(null, true);
  },
});

router.use(authMiddleware);

// POST /api/portfolio/import
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }

    const content = req.file.buffer.toString('utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV文件至少需要表头和一行数据' });
    }

    // Limit CSV import to 1000 rows to prevent resource exhaustion
    const MAX_IMPORT_ROWS = 1000;
    if (lines.length - 1 > MAX_IMPORT_ROWS) {
      return res.status(400).json({ error: `CSV最多支持导入${MAX_IMPORT_ROWS}条记录，当前${lines.length - 1}条` });
    }

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    // fund_name 和 shares 是必填，fund_code 和 cost_price 可自动补全
    const requiredCols = ['fund_name', 'shares', 'buy_date'];
    const missingCols = requiredCols.filter(col => !header.includes(col));
    if (missingCols.length > 0) {
      return res.status(400).json({ error: `CSV缺少必要列: ${missingCols.join(', ')}` });
    }

    const colIndex = {};
    header.forEach((col, i) => { colIndex[col] = i; });

    const pool = getPool();
    let imported = 0;
    const errors = [];
    const navCache = {}; // 缓存已查询的净值
    const nameToCodeCache = {}; // 缓存基金名称到代码的映射

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 3) continue; // 至少需要 shares, buy_date 和 fund_code/fund_name 之一

      let fundCode = colIndex['fund_code'] != null ? cols[colIndex['fund_code']] || '' : '';
      let fundName = colIndex['fund_name'] != null ? cols[colIndex['fund_name']] || '' : '';
      const shares = parseFloat(cols[colIndex['shares']]);
      const buyDate = cols[colIndex['buy_date']];
      const buyFee = colIndex['buy_fee'] != null ? parseFloat(cols[colIndex['buy_fee']] || '0') : 0;
      const notes = colIndex['notes'] != null ? cols[colIndex['notes']] || '' : '';

      // cost_price 可选，如果未提供则查询当日净值
      let costPrice = colIndex['cost_price'] != null ? parseFloat(cols[colIndex['cost_price']] || '0') : 0;

      if ((!fundCode && !fundName) || isNaN(shares) || !buyDate) {
        errors.push(`第${i + 1}行: 数据格式错误，至少需要基金代码或基金名称`);
        continue;
      }
      if (shares <= 0) {
        errors.push(`第${i + 1}行: 份额必须大于0`);
        continue;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(buyDate)) {
        errors.push(`第${i + 1}行: 日期格式应为 YYYY-MM-DD`);
        continue;
      }

      // 如果 fund_code 为空，根据 fund_name 查询
      if (!fundCode) {
        if (nameToCodeCache[fundName]) {
          fundCode = nameToCodeCache[fundName];
        } else {
          const nameResult = await pool.query(
            `SELECT code, name FROM funds WHERE name = $1 OR name LIKE $2 LIMIT 1`,
            [fundName, `%${fundName}%`]
          );
          if (nameResult.rows.length > 0) {
            fundCode = nameResult.rows[0].code;
            fundName = nameResult.rows[0].name; // 使用数据库中的标准名称
            nameToCodeCache[fundName] = fundCode;
          } else {
            errors.push(`第${i + 1}行: 未找到基金"${fundName}"，请填写正确的基金名称或代码`);
            continue;
          }
        }
      }

      // 验证 fund_code 格式
      if (!/^\d{6}$/.test(fundCode)) {
        errors.push(`第${i + 1}行: 基金代码必须为6位数字`);
        continue;
      }

      // 如果 fund_name 为空，根据 fund_code 查询
      if (!fundName) {
        const fundResult = await pool.query('SELECT name FROM funds WHERE code = $1', [fundCode]);
        if (fundResult.rows.length > 0) {
          fundName = fundResult.rows[0].name;
        } else {
          errors.push(`第${i + 1}行: 未找到基金代码${fundCode}对应的名称`);
          continue;
        }
      }

      // 如果成本价为空或0，查询当日净值
      if (!costPrice || costPrice <= 0) {
        const cacheKey = `${fundCode}_${buyDate}`;
        if (navCache[cacheKey] !== undefined) {
          costPrice = navCache[cacheKey];
        } else {
          // 查询买入日期当日或之前最近的净值
          const navResult = await pool.query(
            `SELECT nav FROM fund_nav
             WHERE fund_code = $1 AND nav_date <= $2
             ORDER BY nav_date DESC LIMIT 1`,
            [fundCode, buyDate]
          );
          if (navResult.rows.length > 0) {
            costPrice = parseFloat(navResult.rows[0].nav);
            navCache[cacheKey] = costPrice;
          } else {
            errors.push(`第${i + 1}行: 未找到基金${fundCode}在${buyDate}或之前的净值，请手动填写成本价`);
            continue;
          }
        }
      }

      if (costPrice <= 0) {
        errors.push(`第${i + 1}行: 成本价必须大于0`);
        continue;
      }

      await pool.query(
        'INSERT INTO fund_records (user_id, fund_code, fund_name, shares, cost_price, buy_date, buy_fee, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [req.user.id, fundCode, fundName, shares, costPrice, buyDate, buyFee, notes]
      );
      imported++;
    }

    res.json({ imported, errors, total: lines.length - 1 });
  } catch (error) {
    logger.error('导入失败:', error.message);
    res.status(500).json({ error: '导入失败' });
  }
});

// POST /api/portfolio/import-alipay
router.post('/import-alipay', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传支付宝账单CSV文件' });
    }

    // 支付宝账单使用GBK编码，需转码
    const content = iconv.decode(req.file.buffer, 'gbk');
    const allLines = content.split(/\r?\n/);

    // 跳过前4行元数据，找到表头行
    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, allLines.length); i++) {
      if (allLines[i].includes('交易号') && allLines[i].includes('商品名称')) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return res.status(400).json({ error: '无法识别支付宝账单格式，请确认文件是否正确' });
    }

    // 解析表头
    const header = allLines[headerIdx].split(',').map(h => h.trim());
    const colIndex = {};
    header.forEach((col, i) => { colIndex[col] = i; });

    // 检查必要列
    const requiredCols = ['商品名称', '金额（元）', '收/支', '交易状态'];
    const missingCols = requiredCols.filter(col => colIndex[col] == null);
    if (missingCols.length > 0) {
      return res.status(400).json({ error: `账单缺少必要列: ${missingCols.join(', ')}` });
    }

    // 解析数据行（跳过表头和末尾汇总）
    const dataLines = allLines.slice(headerIdx + 1).filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (trimmed.startsWith('共') && trimmed.includes('笔')) return false;
      return true;
    });

    const MAX_IMPORT_ROWS = 1000;
    if (dataLines.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({ error: `最多支持导入${MAX_IMPORT_ROWS}条记录` });
    }

    const pool = getPool();
    let imported = 0;
    const errors = [];
    let skipped = 0;

    for (let i = 0; i < dataLines.length; i++) {
      const cols = dataLines[i].split(',').map(c => c.trim());

      // 筛选：仅处理"支出"且"交易成功"的记录（基金申购）
      const direction = cols[colIndex['收/支']] || '';
      const status = cols[colIndex['交易状态']] || '';
      if (direction !== '支出' || status !== '交易成功') {
        skipped++;
        continue;
      }

      // 从商品名称提取基金代码
      const productName = cols[colIndex['商品名称']] || '';
      const codeMatch = productName.match(/(\d{6})/);
      if (!codeMatch) {
        errors.push(`第${i + headerIdx + 2}行: 无法从"${productName}"中提取基金代码`);
        continue;
      }
      const fundCode = codeMatch[1];

      // 提取基金名称（去掉基金代码及前后内容）
      const fundName = productName.replace(/\s*\d{6}\s*/, '').replace(/货币|股票|混合|债券|指数/g, '').trim() || productName;

      // 清洗金额（去除¥、逗号、空格）
      const amountStr = (cols[colIndex['金额（元）']] || '').replace(/[¥￥,\s]/g, '');
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        errors.push(`第${i + headerIdx + 2}行: 金额格式错误`);
        continue;
      }

      // 提取日期（付款时间或交易创建时间）
      const payTime = cols[colIndex['付款时间']] || cols[colIndex['交易创建时间']] || '';
      const dateMatch = payTime.match(/(\d{4}-\d{2}-\d{2})/);
      const buyDate = dateMatch ? dateMatch[1] : '';
      if (!buyDate) {
        errors.push(`第${i + headerIdx + 2}行: 无法解析日期`);
        continue;
      }

      // 提取手续费
      const feeStr = (cols[colIndex['服务费（元）']] || '0').replace(/[¥￥,\s]/g, '');
      const buyFee = parseFloat(feeStr) || 0;

      // 申购金额即为成本价（份额需后续更新，这里用金额/1作为占位）
      await pool.query(
        'INSERT INTO fund_records (user_id, fund_code, fund_name, shares, cost_price, buy_date, buy_fee, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [req.user.id, fundCode, fundName, amount, 1, buyDate, buyFee, '支付宝导入']
      );
      imported++;
    }

    res.json({ imported, errors, skipped, total: dataLines.length });
  } catch (error) {
    logger.error('支付宝导入失败:', error.message);
    res.status(500).json({ error: '导入失败，请检查文件格式是否正确' });
  }
});

module.exports = router;
