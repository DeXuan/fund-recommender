const https = require('https');
try { require('dotenv').config(); } catch {}
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST, port: parseInt(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE, user: process.env.PG_USER, password: process.env.PG_PASSWORD,
  connectionTimeoutMillis: 10000,
});

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://fund.eastmoney.com/data/fundranking.html' },
      timeout: 15000,
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parsePercent(s) {
  if (!s || s === '--' || s === '') return null;
  const n = parseFloat(String(s).replace('%', ''));
  return isNaN(n) ? null : n;
}

async function fetchFundList(type, typeName) {
  const allFunds = [];
  let page = 1;
  const pageSize = 500;

  while (true) {
    const url = `https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=${type}&rs=&gs=0&sc=6yzf&st=desc&pi=${page}&pn=${pageSize}&dx=1&v=0.1`;
    try {
      const raw = await httpGet(url);
      const match = raw.match(/datas:\[(.*?)\]/s);
      if (!match || !match[1]) break;

      const items = match[1].split('","').map(s => s.replace(/^"|"$/g, '')).filter(s => s);
      if (items.length === 0) break;

      for (const item of items) {
        const f = item.split(',');
        if (f.length < 2) continue;
        allFunds.push({ code: f[0], name: f[1], type: typeName });
      }

      const allMatch = raw.match(/allRecords:(\d+)/);
      const totalRecords = allMatch ? parseInt(allMatch[1]) : 0;
      if (allFunds.length >= totalRecords || items.length < pageSize) break;

      page++;
      await sleep(100);
    } catch (e) {
      console.log(`  获取 ${typeName} 第${page}页失败: ${e.message}`);
      break;
    }
  }

  return allFunds;
}

async function fetchFundDetail(code) {
  const [basicRaw, detailRaw, holderRaw] = await Promise.all([
    httpGet(`https://fundmobapi.eastmoney.com/FundMApi/FundBasicInformation.ashx?FCODE=${code}&deviceid=wap&plat=Wap&product=EFund&version=2.0.0`),
    httpGet(`https://fundmobapi.eastmoney.com/FundMApi/FundDetailInformation.ashx?FCODE=${code}&deviceid=wap&plat=Wap&product=EFund&version=2.0.0`),
    httpGet(`https://fundmobapi.eastmoney.com/FundMApi/FundHolderStructure.ashx?FCODE=${code}&deviceid=wap&plat=Wap&product=EFund&version=2.0.0`),
  ]);
  const basic = JSON.parse(basicRaw).Datas || {};
  const detail = JSON.parse(detailRaw).Datas || {};
  const holderData = JSON.parse(holderRaw).Datas || [];
  const holder = holderData.length > 0 ? holderData[0] : {};

  const mgmt = parsePercent(detail.MGREXP);
  const custody = parsePercent(detail.TRUSTEXP);
  const service = parsePercent(detail.SALESEXP);
  const totalFee = (mgmt != null && custody != null) ? parseFloat((mgmt + custody + (service || 0)).toFixed(4)) : null;
  const scale = basic.FEGM ? parseFloat(basic.FEGM) : null;
  const nav = parseFloat(basic.DWJZ) || null;
  const shares = (scale && nav && nav > 0) ? scale / nav : null;

  return {
    code: basic.FCODE, name: basic.SHORTNAME, type: basic.FTYPE,
    nav, totalNav: parseFloat(basic.LJJZ) || null, navDate: basic.FSRQ,
    shares: shares ? shares / 1e8 : null,
    purchaseFee: parseFloat(detail.RATE || basic.RATE) || null,
    excessReturn: null,
    institutionHold: holder.JGBL ? parseFloat(holder.JGBL) : null,
    individualHold: holder.GRBL ? parseFloat(holder.GRBL) : null,
    totalFee, mgmt, custody,
    indexName: detail.INDEXNAME || null,
    scale: scale ? scale / 1e8 : null,
    manager: basic.JJJL || detail.JJJL || null,
    buyStatus: basic.SGZT || null,
    minPurchase: parseFloat(basic.MINSG) || null,
    return1w: parsePercent(basic.SYL_Z), return1m: parsePercent(basic.SYL_Y),
    return3m: parsePercent(basic.SYL_3Y), return6m: parsePercent(basic.SYL_6Y),
    return1y: parsePercent(basic.SYL_1N),
  };
}

function classifyIndustry(name) {
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
  if (/医药|医疗|创新药/.test(n)) return '医药';
  if (/半导体|芯片|集成电路/.test(n)) return '半导体/芯片';
  if (/人工智能|ai/i.test(n)) return '人工智能';
  if (/新能源|光伏|锂/.test(n)) return '新能源';
  if (/消费|白酒|食品/.test(n)) return '消费';
  if (/军工|国防/.test(n)) return '军工';
  if (/证券|券商/.test(n)) return '证券';
  if (/银行|金融|保险/.test(n)) return '金融';
  if (/科技|创新/.test(n)) return '科技';
  if (/成长/.test(n)) return '成长';
  if (/价值|蓝筹/.test(n)) return '价值';
  if (/qdii/i.test(n)) return 'QDII';
  return '其他';
}

async function main() {
  console.log('=== 从东方财富获取所有偏股基金 ===\n');

  const types = [
    ['gp', '股票型'],
    ['zs', '指数型-股票'],
    ['hh', '混合型'],
    ['qdii', 'QDII'],
  ];

  let allFunds = [];
  for (const [apiType, typeName] of types) {
    console.log(`获取 ${typeName}...`);
    const funds = await fetchFundList(apiType, typeName);
    console.log(`  获取到 ${funds.length} 只`);
    allFunds.push(...funds);
  }

  console.log(`\n总计获取 ${allFunds.length} 只基金`);

  const stockFunds = allFunds.filter(f => {
    const name = (f.name || '').toLowerCase();
    if (/债券|纯债|信用债|利率债|可转债/.test(name)) return false;
    if (/货币/.test(name)) return false;
    if (/同业存单/.test(name)) return false;
    return true;
  });

  console.log(`过滤后偏股基金: ${stockFunds.length} 只\n`);

  const client = await pool.connect();
  const existing = await client.query('SELECT code FROM funds');
  const existingCodes = new Set(existing.rows.map(r => r.code));

  const newFunds = stockFunds.filter(f => !existingCodes.has(f.code));
  console.log(`数据库已有: ${existingCodes.size}`);
  console.log(`需新增: ${newFunds.length}\n`);

  if (newFunds.length === 0) {
    console.log('无需新增');
    client.release();
    await pool.end();
    return;
  }

  let success = 0, failed = 0;
  const BATCH = 10;
  const startTime = Date.now();

  for (let i = 0; i < newFunds.length; i += BATCH) {
    const batch = newFunds.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async f => {
      try {
        const data = await fetchFundDetail(f.code);
        return { fund: f, data };
      } catch (e) {
        return { fund: f, data: null, error: e.message };
      }
    }));

    for (const { fund, data, error } of results) {
      if (!data) { failed++; continue; }
      try {
        const industry = classifyIndustry(data.name || fund.name);

        await client.query(`
          INSERT INTO funds (code, name, type, industry, index_name, management_fee, custody_fee, service_fee, total_fee, scale, manager, buy_suggestion, daily_limit, shares, purchase_fee, excess_return, institution_hold, individual_hold, rating)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
          ON CONFLICT (code) DO UPDATE SET
            name=EXCLUDED.name, type=EXCLUDED.type, industry=EXCLUDED.industry,
            index_name=COALESCE(EXCLUDED.index_name,funds.index_name),
            management_fee=COALESCE(EXCLUDED.management_fee,funds.management_fee),
            custody_fee=COALESCE(EXCLUDED.custody_fee,funds.custody_fee),
            service_fee=COALESCE(EXCLUDED.service_fee,funds.service_fee),
            total_fee=COALESCE(EXCLUDED.total_fee,funds.total_fee),
            scale=COALESCE(EXCLUDED.scale,funds.scale),
            manager=COALESCE(EXCLUDED.manager,funds.manager),
            shares=COALESCE(EXCLUDED.shares,funds.shares),
            purchase_fee=COALESCE(EXCLUDED.purchase_fee,funds.purchase_fee),
            excess_return=COALESCE(EXCLUDED.excess_return,funds.excess_return),
            institution_hold=COALESCE(EXCLUDED.institution_hold,funds.institution_hold),
            individual_hold=COALESCE(EXCLUDED.individual_hold,funds.individual_hold)
        `, [
          data.code, data.name, data.type, industry,
          data.indexName, data.mgmt, data.custody, null, data.totalFee,
          data.scale, data.manager, data.buyStatus, data.minPurchase,
          data.shares, data.purchaseFee, data.excessReturn,
          data.institutionHold, data.individualHold, null,
        ]);

        if (data.nav && data.navDate) {
          await client.query(`
            INSERT INTO fund_nav (fund_code, nav, total_nav, nav_date, return_1w, return_1m, return_3m, return_6m, return_1y)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (fund_code, nav_date) DO UPDATE SET
              nav=EXCLUDED.nav, total_nav=EXCLUDED.total_nav,
              return_1w=COALESCE(EXCLUDED.return_1w,fund_nav.return_1w),
              return_1m=COALESCE(EXCLUDED.return_1m,fund_nav.return_1m),
              return_3m=COALESCE(EXCLUDED.return_3m,fund_nav.return_3m),
              return_6m=COALESCE(EXCLUDED.return_6m,fund_nav.return_6m),
              return_1y=COALESCE(EXCLUDED.return_1y,fund_nav.return_1y)
          `, [data.code, data.nav, data.totalNav, data.navDate, data.return1w, data.return1m, data.return3m, data.return6m, data.return1y]);
        }

        success++;
      } catch (e) { failed++; }
    }

    const done = Math.min(i + BATCH, newFunds.length);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = done / elapsed;
    const eta = Math.round((newFunds.length - done) / rate);
    process.stdout.write(`\r  进度: ${done}/${newFunds.length} | 成功:${success} 失败:${failed} | ${rate.toFixed(0)}/s | ETA:${eta}s`);

    if (i + BATCH < newFunds.length) await sleep(200);
  }

  console.log(`\n\n=== 同步完成 ===`);
  console.log(`新增: ${success} | 失败: ${failed}`);
  console.log(`耗时: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  const total = await client.query('SELECT COUNT(*) as cnt FROM funds');
  console.log(`数据库总基金数: ${total.rows[0].cnt}`);

  client.release();
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
