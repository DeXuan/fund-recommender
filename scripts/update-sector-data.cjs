/**
 * 板块数据更新脚本 — 从新浪行业板块 API 获取最新涨跌幅并写入 sector_data 表
 *
 * 用法：
 *   node scripts/update-sector-data.cjs              # 正常更新
 *   node scripts/update-sector-data.cjs --dry-run    # 预览不写入
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const iconv = require('iconv-lite');

const { Pool } = require('pg');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const log = {
  info: (msg) => console.log(`[${new Date().toLocaleString()}] [INFO] ${msg}`),
  warn: (msg) => console.warn(`[${new Date().toLocaleString()}] [WARN] ${msg}`),
  error: (msg) => console.error(`[${new Date().toLocaleString()}] [ERROR] ${msg}`),
};

const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  max: 5,
  connectionTimeoutMillis: 15000,
});

async function updateSectorData(sectors) {
  if (dryRun) return sectors.length;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  let count = 0;
  for (const sector of sectors) {
    try {
      await pool.query(
        `INSERT INTO sector_data (name, change_percent, volume, leading_stock, trade_date)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name, trade_date)
         DO UPDATE SET
           change_percent = EXCLUDED.change_percent,
           volume = EXCLUDED.volume,
           leading_stock = EXCLUDED.leading_stock,
           created_at = NOW()`,
        [sector.name, sector.change, sector.volume, sector.leadingStock, todayStr]
      );
      count++;
    } catch (e) {
      log.warn(`写入板块 ${sector.name} 失败: ${e.message}`);
    }
  }
  return count;
}

async function fetchSectorData() {
  try {
    const response = await axios.get(
      'https://vip.stock.finance.sina.com.cn/q/view/newSinaHy.php',
      { timeout: 10000, responseType: 'arraybuffer', headers: { Referer: 'https://finance.sina.com.cn/' } }
    );

    const text = iconv.decode(Buffer.from(response.data), 'gbk');
    const jsonStr = text.replace(/^var S_Finance_bankuai_sinaindustry = /, '').replace(/;$/, '');
    const data = JSON.parse(jsonStr);

    return Object.values(data).map(v => {
      const f = v.split(',');
      return {
        name: f[1],
        change: parseFloat(f[5]) || 0,
        volume: (parseInt(f[7]) / 1e8).toFixed(1) + '亿',
        leadingStock: f[12] || '',
      };
    }).sort((a, b) => b.change - a.change);
  } catch (error) {
    log.warn('获取板块数据失败:', error.message);
    return [];
  }
}

async function main() {
  log.info('========================================');
  log.info('板块数据更新脚本');
  log.info(`模式: ${dryRun ? 'DRY-RUN (预览)' : '写入数据库'}`);
  log.info('========================================');

  const sectors = await fetchSectorData();
  if (sectors.length === 0) {
    log.warn('未获取到板块数据');
    await pool.end();
    process.exit(1);
  }

  log.info(`获取到 ${sectors.length} 个行业板块`);

  if (dryRun) {
    console.table(sectors.slice(0, 10).map(s => ({ 板块: s.name, 涨跌: s.change, 成交额: s.volume, 领涨: s.leadingStock })));
    log.info('DRY-RUN 结束，未写入');
    await pool.end();
    return;
  }

  const count = await updateSectorData(sectors);
  log.info(`写入完成: ${count}/${sectors.length} 个板块`);
  console.table(sectors.slice(0, 10).map(s => ({ 板块: s.name, 涨跌: s.change, 成交额: s.volume, 领涨: s.leadingStock })));

  await pool.end();
}

main().catch(err => {
  log.error(`脚本异常: ${err.message}`);
  pool.end().then(() => process.exit(1));
});
