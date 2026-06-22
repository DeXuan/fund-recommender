/**
 * 从天天基金API获取所有基金的详细信息并更新到PostgreSQL
 *
 * 数据源:
 *   - FundBasicInformation.ashx: 净值、收益率、申购状态、费率折扣、规模
 *   - FundDetailInformation.ashx: 管理费率、托管费率、跟踪指数、基金经理
 *   - pingzhongdata: 原申购费率、持仓股票
 *
 * 用法: node scripts/sync-fund-details.cjs [--limit=N] [--code=XXXXXX]
 */

const https = require('https');
const http = require('http');
try { require('dotenv').config(); } catch {}
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST, port: parseInt(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE, user: process.env.PG_USER, password: process.env.PG_PASSWORD,
  connectionTimeoutMillis: 10000,
});

const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const CODE_ARG = process.argv.find(a => a.startsWith('--code='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 0;
const SINGLE_CODE = CODE_ARG ? CODE_ARG.split('=')[1] : null;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://fund.eastmoney.com/' },
      timeout: 12000,
    }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parsePercent(s) {
  if (!s || s === '--' || s === '' || s === null || s === undefined) return null;
  const n = parseFloat(String(s).replace('%', ''));
  return isNaN(n) ? null : n;
}

// ========== 获取基金基本信息 ==========
async function fetchBasicInfo(code) {
  try {
    const url = `https://fundmobapi.eastmoney.com/FundMApi/FundBasicInformation.ashx?FCODE=${code}&deviceid=wap&plat=Wap&product=EFund&version=2.0.0`;
    const raw = await httpGet(url);
    const r = JSON.parse(raw);
    if (!r.Datas) return null;
    const d = r.Datas;
    return {
      code: d.FCODE,
      name: d.SHORTNAME,
      type: d.FTYPE,
      nav: parseFloat(d.DWJZ) || null,
      cumulativeNav: parseFloat(d.LJJZ) || null,
      navDate: d.FSRQ || null,
      return1w: parsePercent(d.SYL_Z),
      return1m: parsePercent(d.SYL_Y),
      return3m: parsePercent(d.SYL_3Y),
      return6m: parsePercent(d.SYL_6Y),
      return1y: parsePercent(d.SYL_1N),
      returnYtd: parsePercent(d.SYL_JN),
      returnSince: parsePercent(d.SYL_LN),
      dailyChange: parsePercent(d.RZDF),
      purchaseStatus: d.SGZT || null,
      redemptionStatus: d.SHZT || null,
      purchaseFeeOriginal: parsePercent(d.SOURCERATE),
      purchaseFeeDiscount: parsePercent(d.RATE),
      minPurchase: parseFloat(d.MINSG) || null,
      riskLevel: d.RISKLEVEL || null,
      scale: d.FEGM ? parseFloat(d.FEGM) / 100000000 : null, // 元→亿
      totalNav: d.ENDNAV ? parseFloat(d.ENDNAV) / 100000000 : null,
      manager: d.JJJL || null,
      company: d.JJGS || null,
      custodian: d.TGYH || null,
      establishmentDate: d.ESTABDATE || null,
      isBuyable: d.ISBUY === 1 || d.BUY === true,
      dcaMin: parseFloat(d.MINDT) || null,
      holdings: d.FUNDINVEST || null,
    };
  } catch (e) {
    return null;
  }
}

// ========== 获取基金详细费率信息 ==========
async function fetchDetailInfo(code) {
  try {
    const url = `https://fundmobapi.eastmoney.com/FundMApi/FundDetailInformation.ashx?FCODE=${code}&deviceid=wap&plat=Wap&product=EFund&version=2.0.0`;
    const raw = await httpGet(url);
    const r = JSON.parse(raw);
    if (!r.Datas) return null;
    const d = r.Datas;
    return {
      managementFee: parsePercent(d.MGREXP),
      custodyFee: parsePercent(d.TRUSTEXP),
      serviceFee: parsePercent(d.SALESEXP),
      indexCode: d.INDEXCODE || null,
      indexName: d.INDEXNAME || null,
      benchmark: d.BENCH || null,
      fullName: d.FULLNAME || null,
      riskLevel: d.RISKLEVEL || null,
      manager: d.JJJL || null,
      company: d.JJGS || null,
      custodianBank: d.TGYH || null,
    };
  } catch (e) {
    return null;
  }
}

// ========== 获取收益率数据(从pingzhongdata) ==========
async function fetchPingzhongData(code) {
  try {
    const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js`;
    const raw = await httpGet(url);
    const extract = (key) => {
      const m = raw.match(new RegExp(key + "\\s*=\\s*['\"]([^'\"]*?)['\"]"));
      return m ? m[1] : null;
    };
    return {
      purchaseFeeOriginal: parseFloat(extract('fund_sourceRate')) || null,
      purchaseFeeDiscount: parseFloat(extract('fund_Rate')) || null,
      minPurchase: parseFloat(extract('fund_minsg')) || null,
      holdings: extract('stockCodes') || null,
    };
  } catch (e) {
    return null;
  }
}

// ========== 行业分类(基于基金名称) ==========
function classifyIndustry(name, existingIndustry) {
  if (existingIndustry && existingIndustry !== '其他' && existingIndustry !== '') return existingIndustry;
  const n = (name || '').toLowerCase();
  if (/沪深300/.test(n)) return '沪深300';
  if (/中证500/.test(n)) return '中证500';
  if (/中证1000/.test(n)) return '中证1000';
  if (/中证a500|中证A500/.test(n)) return '中证A500';
  if (/创业板/.test(n)) return '创业板';
  if (/科创50/.test(n)) return '科创50';
  if (/上证50/.test(n)) return '上证50';
  if (/纳斯达克|nasdaq/i.test(n)) return '纳斯达克100';
  if (/标普500|sp500/i.test(n)) return '标普500';
  if (/恒生|港股/.test(n)) return '港股';
  if (/日经|日本/.test(n)) return '日本';
  if (/德国|dax/i.test(n)) return '德国';
  if (/印度/.test(n)) return '印度';
  if (/越南/.test(n)) return '越南';
  if (/欧洲/.test(n)) return '欧洲';
  if (/医药|医疗|创新药/.test(n)) return '医药';
  if (/半导体|芯片/.test(n)) return '半导体/芯片';
  if (/人工智能|ai/i.test(n)) return '人工智能';
  if (/新能源|光伏|锂/.test(n)) return '新能源';
  if (/消费|白酒|食品/.test(n)) return '消费';
  if (/军工|国防/.test(n)) return '军工';
  if (/证券|券商/.test(n)) return '证券';
  if (/银行|金融|保险/.test(n)) return '金融';
  if (/煤炭/.test(n)) return '煤炭';
  if (/红利|高股息/.test(n)) return '红利';
  if (/原油|石油/.test(n)) return '原油';
  if (/黄金/.test(n)) return '黄金';
  if (/REIT/i.test(n)) return 'REITs';
  if (/qdii/i.test(n)) return 'QDII';
  return existingIndustry || '其他';
}

// ========== 主流程 ==========
async function main() {
  console.log('=== 基金详细信息同步 ===');

  const client = await pool.connect();
  try {
    // 获取所有基金代码
    let query = 'SELECT code, name, industry FROM funds ORDER BY code';
    const params = [];
    if (SINGLE_CODE) {
      query = 'SELECT code, name, industry FROM funds WHERE code = $1';
      params.push(SINGLE_CODE);
    }
    const allFunds = await client.query(query, params);
    let funds = allFunds.rows;
    if (LIMIT > 0) funds = funds.slice(0, LIMIT);

    console.log(`待处理: ${funds.length} 只基金`);
    console.log('');

    let success = 0, failed = 0, skipped = 0;
    const startTime = Date.now();

    // 并发控制：每批10个
    const BATCH_SIZE = 10;
    for (let i = 0; i < funds.length; i += BATCH_SIZE) {
      const batch = funds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (fund) => {
        const [basic, detail, pingzhong] = await Promise.all([
          fetchBasicInfo(fund.code),
          fetchDetailInfo(fund.code),
          fetchPingzhongData(fund.code),
        ]);
        return { fund, basic, detail, pingzhong };
      }));

      for (const { fund, basic, detail, pingzhong } of results) {
        if (!basic && !detail) { skipped++; continue; }

        const b = basic || {};
        const d = detail || {};
        const p = pingzhong || {};

        // 合并数据（优先用 detail 的费率，basic 的净值/收益）
        const managementFee = d.managementFee ?? null;
        const custodyFee = d.custodyFee ?? null;
        const serviceFee = d.serviceFee ?? null;
        const totalFee = (managementFee != null && custodyFee != null)
          ? parseFloat((managementFee + custodyFee + (serviceFee || 0)).toFixed(4))
          : null;

        const purchaseFeeOriginal = b.purchaseFeeOriginal ?? p.purchaseFeeOriginal ?? null;
        const purchaseFeeDiscount = b.purchaseFeeDiscount ?? p.purchaseFeeDiscount ?? null;
        const minPurchase = b.minPurchase ?? p.minPurchase ?? null;

        const industry = classifyIndustry(b.name || fund.name, fund.industry);
        const indexName = d.indexName || null;
        const scale = b.scale || null;

        try {
          // 更新 funds 表
          await client.query(`
            UPDATE funds SET
              name = COALESCE($2, name),
              type = COALESCE(NULLIF($3::text, ''), type),
              industry = $4,
              index_name = COALESCE($5, index_name),
              management_fee = COALESCE($6, management_fee),
              custody_fee = COALESCE($7, custody_fee),
              service_fee = COALESCE($8, service_fee),
              total_fee = COALESCE($9, total_fee),
              scale = COALESCE($10, scale),
              rating = COALESCE($11, rating),
              buy_suggestion = COALESCE($12, buy_suggestion),
              daily_limit = COALESCE($13, daily_limit),
              manager = COALESCE($14, manager),
              valuation = COALESCE($15, valuation)
            WHERE code = $1
          `, [
            fund.code,
            b.name || fund.name,
            b.type || '',
            industry,
            indexName,
            managementFee,
            custodyFee,
            serviceFee,
            totalFee,
            scale,
            d.riskLevel || null,
            b.purchaseStatus || null,
            b.minPurchase || null,
            b.manager || d.manager || null,
            d.benchmark || null,
          ]);

          // 更新 fund_nav 表
          if (b.nav && b.navDate) {
            await client.query(`
              INSERT INTO fund_nav (fund_code, nav, total_nav, nav_date, return_1w, return_1m, return_3m, return_6m, return_1y)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (fund_code, nav_date) DO UPDATE SET
                nav = EXCLUDED.nav,
                total_nav = EXCLUDED.total_nav,
                return_1w = COALESCE(EXCLUDED.return_1w, fund_nav.return_1w),
                return_1m = COALESCE(EXCLUDED.return_1m, fund_nav.return_1m),
                return_3m = COALESCE(EXCLUDED.return_3m, fund_nav.return_3m),
                return_6m = COALESCE(EXCLUDED.return_6m, fund_nav.return_6m),
                return_1y = COALESCE(EXCLUDED.return_1y, fund_nav.return_1y)
            `, [fund.code, b.nav, b.totalNav || null, b.navDate, b.return1w, b.return1m, b.return3m, b.return6m, b.return1y]);
          }

          success++;
        } catch (e) {
          failed++;
        }
      }

      // 进度显示
      const done = Math.min(i + BATCH_SIZE, funds.length);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = done / elapsed;
      const eta = Math.round((funds.length - done) / rate);
      process.stdout.write(`\r  进度: ${done}/${funds.length} | 成功:${success} 跳过:${skipped} 失败:${failed} | ${rate.toFixed(0)}/s | ETA:${eta}s`);

      // 限流
      if (i + BATCH_SIZE < funds.length) await sleep(300);
    }

    console.log('');
    console.log('');
    console.log('=== 同步完成 ===');
    console.log(`成功: ${success} | 跳过: ${skipped} | 失败: ${failed}`);
    console.log(`耗时: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    // 验证
    const stats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN management_fee > 0 THEN 1 END) as with_mgmt_fee,
        COUNT(CASE WHEN manager IS NOT NULL AND manager != '' THEN 1 END) as with_manager,
        COUNT(CASE WHEN scale > 0 THEN 1 END) as with_scale
      FROM funds
    `);
    const s = stats.rows[0];
    console.log('');
    console.log('数据完整性:');
    console.log(`  总基金: ${s.total}`);
    console.log(`  有管理费率: ${s.with_mgmt_fee}`);
    console.log(`  有基金经理: ${s.with_manager}`);
    console.log(`  有规模数据: ${s.with_scale}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('同步失败:', e.message); process.exit(1); });
