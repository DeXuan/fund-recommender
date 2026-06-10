/**
 * 一次性脚本：抓取支付宝金选基金数据并写入数据库
 * 运行: node scripts/fetch-gold-funds.cjs
 *
 * 仅使用 FundBasicInformation API（含净值、经理、规模、收益率），无需 lsjz API
 * SYL 字段映射: SYL_1N=近1年, SYL_6Y=近6月, SYL_3Y=近3月, SYL_Y=近1月, SYL_Z=近1周
 */
require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

const GOLD_FUND_CODES = [
  '110020', '310318', '519671', '002910', '007531', '010253',
  '161017', '000478', '007028', '013349', '009626',
  '159915', '001593', '005668', '010657',
  '588000', '588080', '011612', '011613',
  '110003', '001549', '007136',
  '560010', '006165', '014987',
  '022430', '022455', '022386',
  '001180', '012634', '000059', '161726',
  '008887', '012414', '007300', '012557',
  '014673',
  '012831', '007380',
  '000248', '161725', '001156',
  '512880', '006098', '012349',
  '005693', '004854', '006113',
  '001550', '161005',
  '008279', '161724', '161032',
  '017032', '016907', '012834',
  '005968', '008169',
  '003095',
  '040046', '270042', '160213', '015299',
  '007721', '050025', '006075', '019547',
  '012348', '013402', '008334',
  '090010', '100032', '005561',
  '159880', '007874', '012520',
  '011102',
  '159766', '562510',
  '000171', '000172', '002611', '003327',
];

const codes = [...new Set(GOLD_FUND_CODES)];

async function fetchOne(code) {
  try {
    const { data } = await axios.get(
      'https://fundmobapi.eastmoney.com/FundMApi/FundBasicInformation.ashx',
      { params: { FCODE: code, deviceid: 'wap', plat: 'Wap', product: 'EFund', version: '2.0.0' }, timeout: 10000 },
    );
    const d = data?.Datas;
    if (!d) return null;

    const nav = parseFloat(d.DWJZ);
    if (!nav) return null;

    const pf = (v) => (v !== undefined && v !== null && v !== '' ? parseFloat(v) : null);

    return {
      code,
      name: d.SHORTNAME || '',
      nav,
      navDate: d.FSRQ || null,
      manager: d.JJJL || null,
      scale: d.ENDNAV ? parseFloat((parseFloat(d.ENDNAV) / 1e8).toFixed(2)) : null,
      return1y: pf(d.SYL_1N),
      return6m: pf(d.SYL_6Y),
      return3m: pf(d.SYL_3Y),
      return1m: pf(d.SYL_Y),
      return1w: pf(d.SYL_Z),
    };
  } catch {
    return null;
  }
}

(async () => {
  console.log(`开始抓取 ${codes.length} 只金选基金...`);
  await pool.query("UPDATE funds SET is_gold_selected = false WHERE is_gold_selected = true");

  let success = 0;

  for (let i = 0; i < codes.length; i += 5) {
    const batch = codes.slice(i, i + 5);
    const results = await Promise.all(batch.map((c) => fetchOne(c)));

    for (const r of results) {
      if (!r) continue;
      await pool.query(
        `INSERT INTO funds (code, name, type, industry, manager, scale, is_gold_selected, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
         ON CONFLICT (code) DO UPDATE SET
           name = COALESCE(NULLIF($2, ''), funds.name),
           manager = COALESCE(NULLIF($5, ''), funds.manager),
           scale = COALESCE($6, funds.scale),
           is_gold_selected = true,
           updated_at = NOW()`,
        [r.code, r.name, '指数型', '其他', r.manager, r.scale],
      );

      if (r.navDate) {
        await pool.query(
          `INSERT INTO fund_nav (fund_code, nav, total_nav, nav_date, return_1w, return_1m, return_3m, return_6m, return_1y)
           VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (fund_code, nav_date) DO UPDATE SET
             nav = EXCLUDED.nav, total_nav = EXCLUDED.total_nav,
             return_1w = COALESCE(EXCLUDED.return_1w, fund_nav.return_1w),
             return_1m = COALESCE(EXCLUDED.return_1m, fund_nav.return_1m),
             return_3m = COALESCE(EXCLUDED.return_3m, fund_nav.return_3m),
             return_6m = COALESCE(EXCLUDED.return_6m, fund_nav.return_6m),
             return_1y = COALESCE(EXCLUDED.return_1y, fund_nav.return_1y)`,
          [r.code, r.nav, r.navDate, r.return1w, r.return1m, r.return3m, r.return6m, r.return1y],
        );
      }
      success++;
    }

    if ((i + 5) % 30 === 0 || i + 5 >= codes.length) {
      console.log(`进度: ${Math.min(i + 5, codes.length)}/${codes.length} (成功${success})`);
    }
    if (i + 5 < codes.length) await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n完成: 成功 ${success}/${codes.length}`);
  const { rows } = await pool.query("SELECT COUNT(*) as c FROM funds WHERE is_gold_selected = true");
  console.log('数据库金选基金数:', rows[0].c);

  await pool.end();
  process.exit(0);
})();
