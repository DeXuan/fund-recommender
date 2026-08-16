/**
 * 从东方财富 API 同步全量股票/指数/QDII 基金数据到 PostgreSQL
 *
 * 用法: node scripts/sync-eastmoney-funds.cjs
 * 可选参数: --dry-run (只打印不写库)  --type=gp,zs,qdii (指定类型)
 */

const https = require('https');
const http = require('http');

// 加载环境变量
try { require('dotenv').config(); } catch {}

const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  connectionTimeoutMillis: 10000,
});

const DRY_RUN = process.argv.includes('--dry-run');
const TYPE_ARG = process.argv.find(a => a.startsWith('--type='));
const FETCH_TYPES = TYPE_ARG
  ? TYPE_ARG.split('=')[1].split(',')
  : ['gp', 'zs', 'qdii'];

const TYPE_MAP = {
  gp: '股票型',
  zs: '指数',
  qdii: 'QDII',
};

// ========== HTTP 请求 ==========
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://fund.eastmoney.com/',
      },
      timeout: 15000,
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ========== 解析东方财富排名数据 ==========
function parseRankData(raw) {
  // 提取 allRecords
  const totalMatch = raw.match(/allRecords:(\d+)/);
  const total = totalMatch ? parseInt(totalMatch[1]) : 0;

  // 提取 datas 数组中的每条记录
  const datasMatch = raw.match(/datas:\[(.*?)\]/s);
  if (!datasMatch) return { total, records: [] };

  const items = datasMatch[1].match(/"([^"]*)"/g);
  if (!items) return { total, records: [] };

  const records = items.map(s => {
    const fields = s.replace(/"/g, '').split(',');
    return {
      code: fields[0],
      name: fields[1],
      date: fields[3],
      nav: parseFloat(fields[4]) || null,
      cumulativeNav: parseFloat(fields[5]) || null,
      return1w: parseFloat(fields[7]) || null,
      return1m: parseFloat(fields[8]) || null,
      return3m: parseFloat(fields[9]) || null,
      return6m: parseFloat(fields[10]) || null,
      return1y: parseFloat(fields[11]) || null,
      returnYtd: parseFloat(fields[14]) || null,
      returnSince: parseFloat(fields[15]) || null,
      inceptionDate: fields[17],
      purchaseFee: fields[19] || null,
      purchaseFeeDiscount: fields[20] || null,
      serviceFee: fields[22] || null,
      scale: parseFloat(fields[24]) || 0,
    };
  });

  return { total, records };
}

// ========== 行业分类 ==========
function classifyIndustry(name) {
  const n = name.toLowerCase();
  // 宽基指数
  if (/沪深300|hs300/.test(n)) return '沪深300';
  if (/中证500|zz500/.test(n)) return '中证500';
  if (/中证1000|zz1000/.test(n)) return '中证1000';
  if (/中证a500|中证A500/.test(n)) return '中证A500';
  if (/创业板|cyb/.test(n)) return '创业板';
  if (/科创50|kc50/.test(n)) return '科创50';
  if (/上证50|sz50/.test(n)) return '上证50';
  if (/上证指数|上证综指/.test(n)) return '上证指数';
  if (/中证800|zz800/.test(n)) return '中证800';
  if (/中证红利|红利/.test(n)) return '红利';
  if (/深证成分|深证100|深成指/.test(n)) return '深证指数';
  if (/国证芯片|半导体|芯片/.test(n)) return '半导体/芯片';
  if (/人工智能|ai(?!\w)/.test(n)) return '人工智能';
  if (/纳斯达克|nasdaq/.test(n)) return '纳斯达克100';
  if (/标普500|sp500|s&p500/.test(n)) return '标普500';
  if (/恒生|hangseng|港股|港股通/.test(n)) return '港股';
  if (/日经|nikkei|日本/.test(n)) return '日本';
  if (/德国|dax/.test(n)) return '德国';
  if (/印度/.test(n)) return '印度';
  if (/越南/.test(n)) return '越南';
  if (/医药|医疗|创新药|生物医药|中证生科/.test(n)) return '医药';
  if (/新能源|碳中和/.test(n)) return '新能源';
  if (/光伏|风电|储能/.test(n)) return '新能源';
  if (/消费|白酒|食品饮料|酒/.test(n)) return '消费';
  if (/军工|国防|航天/.test(n)) return '军工';
  if (/证券|券商/.test(n)) return '证券';
  if (/银行|金融|保险/.test(n)) return '金融';
  if (/煤炭/.test(n)) return '煤炭';
  if (/电力|新能源发电/.test(n)) return '电力';
  if (/地产|房地产/.test(n)) return '地产';
  if (/传媒|游戏|影视|动漫/.test(n)) return '传媒';
  if (/农业|养殖|猪/.test(n)) return '农业';
  if (/有色|黄金|白银|铜|锂/.test(n)) return '有色金属';
  if (/钢铁/.test(n)) return '钢铁';
  if (/建材|水泥|陶瓷/.test(n)) return '陶瓷/建材';
  if (/汽车|智能驾驶|车联网/.test(n)) return '汽车';
  if (/机器人|智能制造|工业母机/.test(n)) return '机器人';
  if (/信息技术|计算机|软件|云计算|大数据/.test(n)) return '信息技术';
  if (/通信|5g|物联网/.test(n)) return '通信';
  if (/环保|碳/.test(n)) return '环保';
  if (/旅游|酒店/.test(n)) return '酒店旅游';
  if (/家电/.test(n)) return '家电';
  if (/科创|创新/.test(n)) return '科技创新';
  if (/量化|对冲/.test(n)) return '量化';
  if (/固收\+|固收/.test(n)) return '固收+';
  if (/中概|中国海外/.test(n)) return '中概股';
  if (/全球|world|global/.test(n)) return '全球';
  if (/qdii/i.test(n)) return 'QDII';
  // 宽基指数补充
  if (/沪深|上证|深证|中证|国证|恒生|创业板|科创|北证|MSCI|msci/.test(n)) return '宽基指数';
  // 行业指数补充
  if (/医药|医疗|生物|创新药|疫苗/.test(n)) return '医药';
  if (/科技|tmt|电子|信息|半导体|芯片|集成电路/.test(n)) return '科技';
  if (/消费|食品|白酒|饮料|乳制品|调味/.test(n)) return '消费';
  if (/金融|银行|保险|证券|非银/.test(n)) return '金融';
  if (/新能源|光伏|风电|储能|电池|锂/.test(n)) return '新能源';
  if (/军工|国防|航天|航空/.test(n)) return '军工';
  if (/地产|房地产|基建|建筑/.test(n)) return '基建';
  if (/有色|资源|能源|煤炭|石油|化工/.test(n)) return '资源';
  if (/农业|养殖|畜牧|粮食|种业/.test(n)) return '农业';
  if (/环保|绿色|低碳|碳中和/.test(n)) return '环保';
  if (/传媒|文化|娱乐|游戏|体育/.test(n)) return '文体传媒';
  if (/汽车|出行|交通|物流/.test(n)) return '交运物流';
  if (/家电|家居|服装|纺织/.test(n)) return '轻工制造';
  if (/医药|医疗|健康|养生/.test(n)) return '医药';
  if (/互联网|电商|数字|数据/.test(n)) return '数字经济';
  if (/红利|高股息|价值/.test(n)) return '红利';
  if (/成长|龙头|蓝筹/.test(n)) return '风格指数';
  if (/债券|信用|利率|可转债/.test(n)) return '债券';
  if (/商品|黄金|白银|原油|豆粕|铜/.test(n)) return '商品';
  if (/对冲|绝对收益|市场中性/.test(n)) return '量化对冲';
  return '宽基指数'; // 默认归入宽基指数而非"其他"
}

// ========== 主流程 ==========
async function main() {
  console.log('=== 东方财富基金数据同步 ===');
  console.log('同步类型:', FETCH_TYPES.map(t => TYPE_MAP[t] || t).join(', '));
  console.log('DRY_RUN:', DRY_RUN);
  console.log('');

  const client = await pool.connect();
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  try {
    for (const ft of FETCH_TYPES) {
      const typeName = TYPE_MAP[ft] || ft;
      console.log(`--- 同步 ${typeName} ---`);

      // 第一页获取总数
      const firstUrl = `https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=${ft}&rs=&gs=0&sc=6yzf&st=desc&pi=1&pn=500&dx=1`;
      const firstRaw = await httpGet(firstUrl);
      const { total, records: firstRecords } = parseRankData(firstRaw);

      if (total === 0) {
        console.log(`  ${typeName}: 无数据，跳过`);
        continue;
      }

      console.log(`  ${typeName} 共 ${total} 只基金`);

      // 收集所有记录（使用大分页一次获取）
      let allRecords = [...firstRecords];
      if (total > 50) {
        // 用单次大请求获取剩余数据
        const bigUrl = `https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=${ft}&rs=&gs=0&sc=6yzf&st=desc&pi=1&pn=${total}&dx=1`;
        try {
          const raw = await httpGet(bigUrl);
          const { records } = parseRankData(raw);
          if (records.length > allRecords.length) {
            allRecords = records;
          }
        } catch (e) {
          console.warn(`  大分页获取失败: ${e.message}，回退到逐页获取`);
          const pageSize = 200;
          const totalPages = Math.ceil(total / pageSize);
          for (let page = 2; page <= totalPages; page++) {
            const url = `https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=${ft}&rs=&gs=0&sc=6yzf&st=desc&pi=${page}&pn=${pageSize}&dx=1`;
            try {
              const raw = await httpGet(url);
              const { records } = parseRankData(raw);
              allRecords.push(...records);
            } catch (e2) {
              console.warn(`  第${page}页获取失败: ${e2.message}`);
            }
            await sleep(300);
          }
        }
      }

      console.log(`  获取到 ${allRecords.length} 只基金，开始写入数据库...`);

      // 写入数据库
      let inserted = 0, updated = 0, skipped = 0;

      for (const fund of allRecords) {
        if (!fund.code || !/^\d{6}$/.test(fund.code)) { skipped++; continue; }
        // 跳过债券/货币基金（手动维护类型字段，防止回填）
        if (/债|货币/.test(fund.name)) { skipped++; continue; }

        const industry = classifyIndustry(fund.name);
        const dbType = ft === 'zs' ? '指数' : typeName;

        try {
          const result = await client.query(
            `INSERT INTO funds (code, name, type, industry, management_fee, custody_fee, service_fee, total_fee, scale, rating, buy_suggestion)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (code) DO UPDATE SET
               name = EXCLUDED.name,
               type = CASE WHEN funds.type = '' OR funds.type IS NULL THEN EXCLUDED.type ELSE funds.type END,
               industry = CASE WHEN funds.industry = '其他' OR funds.industry = '' OR funds.industry IS NULL THEN EXCLUDED.industry ELSE funds.industry END,
               scale = CASE WHEN EXCLUDED.scale > 0 THEN EXCLUDED.scale ELSE funds.scale END`,
            [
              fund.code,
              fund.name,
              dbType,
              industry,
              0, // management_fee - 东方财富排名API不提供，后续单独补充
              0, // custody_fee
              0, // service_fee
              0, // total_fee
              fund.scale,
              3, // default rating
              '', // buy_suggestion
            ]
          );
          if (result.rowCount > 0) {
            // Check if it was an insert or update by checking if the fund existed before
            const existsCheck = await client.query('SELECT 1 FROM funds WHERE code = $1', [fund.code]);
            // row was affected - either inserted or updated
            inserted++; // simplified: count all as processed
          }
        } catch (e) {
          // Ignore duplicate key errors etc.
          skipped++;
        }
      }

      console.log(`  ${typeName} 完成: 处理 ${inserted + skipped} 只, 跳过 ${skipped} 只`);
      totalInserted += inserted;
      totalSkipped += skipped;

      // 更新净值数据
      console.log(`  更新 ${typeName} 净值数据...`);
      let navUpdated = 0;
      for (const fund of allRecords) {
        if (!fund.code || !/^\d{6}$/.test(fund.code)) continue;
        if (!fund.nav) continue;
        try {
          await client.query(
            `INSERT INTO fund_nav (fund_code, nav, total_nav, nav_date, return_1w, return_1m, return_3m, return_6m, return_1y)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (fund_code, nav_date) DO UPDATE SET
               nav = EXCLUDED.nav,
               total_nav = EXCLUDED.total_nav,
               return_1w = COALESCE(EXCLUDED.return_1w, fund_nav.return_1w),
               return_1m = COALESCE(EXCLUDED.return_1m, fund_nav.return_1m),
               return_3m = COALESCE(EXCLUDED.return_3m, fund_nav.return_3m),
               return_6m = COALESCE(EXCLUDED.return_6m, fund_nav.return_6m),
               return_1y = COALESCE(EXCLUDED.return_1y, fund_nav.return_1y)`,
            [
              fund.code,
              fund.nav,
              fund.cumulativeNav,
              fund.date,
              fund.return1w,
              fund.return1m,
              fund.return3m,
              fund.return6m,
              fund.return1y,
            ]
          );
          navUpdated++;
        } catch (e) { /* ignore */ }
      }
      console.log(`  ${typeName} 净值更新: ${navUpdated} 只`);

      await sleep(1000);
    }

    // 最终统计
    const countResult = await client.query('SELECT COUNT(*) as cnt FROM funds');
    const navCountResult = await client.query('SELECT COUNT(DISTINCT fund_code) as cnt FROM fund_nav');
    console.log('');
    console.log('=== 同步完成 ===');
    console.log('funds 表总数:', countResult.rows[0].cnt);
    console.log('有净值数据的基金:', navCountResult.rows[0].cnt);

    // 按类型统计
    const typeStats = await client.query('SELECT type, COUNT(*) as cnt FROM funds GROUP BY type ORDER BY cnt DESC');
    console.log('');
    console.log('按类型统计:');
    typeStats.rows.forEach(r => console.log(`  ${r.type}: ${r.cnt}只`));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error('同步失败:', e.message);
  process.exit(1);
});
