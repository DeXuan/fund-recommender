/**
 * 一次性脚本：抓取支付宝金选基金数据并写入数据库
 * 运行: node scripts/fetch-gold-funds.cjs
 *
 * 使用 FundBasicInformation API（含净值、经理、规模、收益率）
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

// 支付宝金选基金代码列表 - 来自蚂蚁财富精选基金池
const GOLD_FUND_CODES = [
  // 宽基指数 - 沪深300
  '110020', '310318', '519671', '002910', '007531', '010253',
  // 宽基指数 - 中证500
  '161017', '000478', '007028',
  // 宽基指数 - 创业板指
  '159915', '001593', '005668', '010657',
  // 宽基指数 - 科创50
  '588000', '588080', '011612', '011613',
  // 宽基指数 - 上证50
  '110003', '001549', '007136',
  // 宽基指数 - 中证1000
  '560010', '006165', '014987',
  // 宽基指数 - 中证A500
  '022430', '022455', '022386',
  // 行业 - 医药
  '001180', '012634', '000059', '161726',
  // 行业 - 半导体/芯片
  '008887', '012414', '007300', '012557',
  // 行业 - 人工智能/AI
  '011612', '014673',
  // 行业 - 新能源
  '012831', '007380', '010253', '005668',
  // 行业 - 消费
  '000248', '161725', '001156',
  // 行业 - 证券
  '512880', '006098', '012349',
  // 行业 - 军工
  '005693', '004854', '006113',
  // 行业 - 金融/银行
  '001550', '161005',
  // 行业 - 煤炭
  '008279', '161724', '161032',
  // 行业 - 电力
  '017032', '016907', '012834',
  // 行业 - 家电
  '005968', '008169',
  // 行业 - 白酒
  '003095',
  // QDII - 纳斯达克100
  '040046', '270042', '160213', '015299',
  // QDII - 标普500
  '007721', '050025', '006075', '019547',
  // QDII - 恒生科技
  '012348', '013402',
  // 策略 - 中证红利
  '090010', '100032', '005561',
  // 行业 - 有色金属
  '159880', '007874', '012520',
  // 行业 - 光伏
  '011102',
  // 行业 - 酒店旅游（含航空产业链）
  '159766', '562510', '159257', '159392', '159208', '159227', '024766', '024767',
  // 固收 - 债券
  '000171', '000172', '002611', '003327',
  // 知名金选主动/消费/宽基
  '110011', '005911', '000083', '110022', '000961', '050002',
  '001000', '162605', '163412', '340006', '000746', '001102',
  '090004', '110008', '004243',
];

const codes = [...new Set(GOLD_FUND_CODES)];

// 金选基金分类函数
function classifyGoldCategory(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('纳斯达克') || n.includes('nasdaq')) return 'QDII-美股';
  if (n.includes('标普') || n.includes('s&p')) return 'QDII-美股';
  if (n.includes('恒生')) return 'QDII-港股';
  if (n.includes('沪深300')) return '宽基-沪深300';
  if (n.includes('中证500')) return '宽基-中证500';
  if (n.includes('创业板')) return '宽基-创业板';
  if (n.includes('科创50')) return '宽基-科创50';
  if (n.includes('上证50')) return '宽基-上证50';
  if (n.includes('中证1000')) return '宽基-中证1000';
  if (n.includes('中证A500') || n.includes('a500')) return '宽基-A500';
  if (n.includes('医药') || n.includes('医疗') || n.includes('健康')) return '行业-医药';
  if (n.includes('半导体') || n.includes('芯片')) return '行业-半导体';
  if (n.includes('人工智能') || n.includes('ai')) return '行业-AI';
  if (n.includes('新能源')) return '行业-新能源';
  if (n.includes('消费')) return '行业-消费';
  if (n.includes('证券') || n.includes('券商')) return '行业-证券';
  if (n.includes('军工') || n.includes('国防')) return '行业-军工';
  if (n.includes('金融') || n.includes('银行')) return '行业-金融';
  if (n.includes('煤炭')) return '行业-煤炭';
  if (n.includes('电力')) return '行业-电力';
  if (n.includes('家电')) return '行业-家电';
  if (n.includes('白酒')) return '行业-白酒';
  if (n.includes('红利')) return '策略-红利';
  if (n.includes('光伏')) return '行业-光伏';
  if (n.includes('机器人')) return '行业-机器人';
  if (n.includes('旅游') || n.includes('酒店') || n.includes('航空产业')) return '行业-酒店旅游';
  if (n.includes('债券') || n.includes('固收')) return '固收-债券';
  if (n.includes('有色金属')) return '行业-有色金属';
  return '其他';
}

function inferIndustry(name, goldCategory) {
  if (goldCategory.startsWith('QDII')) {
    if (name.includes('纳斯达克')) return '纳斯达克100';
    if (name.includes('标普')) return '标普500';
    if (name.includes('恒生')) return '恒生指数';
  }
  if (goldCategory.includes('沪深300')) return '沪深300';
  if (goldCategory.includes('中证500')) return '中证500';
  if (goldCategory.includes('创业板')) return '创业板';
  if (goldCategory.includes('科创')) return '科创50';
  if (goldCategory.includes('医药')) return '医药';
  if (goldCategory.includes('半导体')) return '半导体/芯片';
  if (goldCategory.includes('AI')) return '人工智能';
  if (goldCategory.includes('新能源')) return '新能源';
  if (goldCategory.includes('消费')) return '消费';
  if (goldCategory.includes('证券')) return '证券';
  if (goldCategory.includes('军工')) return '军工';
  if (goldCategory.includes('金融')) return '金融';
  if (goldCategory.includes('煤炭')) return '煤炭';
  if (goldCategory.includes('电力')) return '电力';
  if (goldCategory.includes('家电')) return '家电';
  if (goldCategory.includes('白酒')) return '消费';
  if (goldCategory.includes('红利')) return '沪深300';
  if (goldCategory.includes('光伏')) return '新能源';
  if (goldCategory.includes('机器人')) return '人工智能';
  if (goldCategory.includes('酒店旅游')) return '酒店旅游';
  if (goldCategory.includes('债券')) return '债券';
  if (goldCategory.includes('有色金属')) return '有色金属';
  return '其他';
}

function estimateRating(totalFee, return1y, scale) {
  let score = 3;
  if (totalFee <= 0.6) score += 0.5;
  else if (totalFee > 1.0) score -= 0.5;
  if (return1y != null && return1y > 20) score += 1;
  else if (return1y != null && return1y > 10) score += 0.5;
  else if (return1y != null && return1y < -10) score -= 0.5;
  if (scale > 10) score += 0.5;
  else if (scale < 1) score -= 0.5;
  return Math.max(1, Math.min(5, Math.round(score)));
}

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
    const scale = d.ENDNAV ? parseFloat((parseFloat(d.ENDNAV) / 1e8).toFixed(2)) : null;
    const totalFee = pf(d.FRATE) || 0;
    const return1y = pf(d.SYL_1N);
    const rating = estimateRating(totalFee, return1y, scale || 0);

    // 申购状态
    let buySuggestion = '开放申购';
    let dailyLimit = 0;
    const sgzt = d.SGZT || '';
    const maxsg = parseInt(d.MAXSG);
    if (sgzt.includes('暂停')) {
      buySuggestion = '暂停申购';
    } else if (sgzt.includes('限') || sgzt.includes('大额')) {
      buySuggestion = '限大额';
      dailyLimit = isNaN(maxsg) ? 10 : maxsg;
    }

    const goldCategory = classifyGoldCategory(d.SHORTNAME || '');
    const industry = inferIndustry(d.SHORTNAME || '', goldCategory);

    return {
      code,
      name: d.SHORTNAME || '',
      type: d.FTYPE || '指数型',
      industry,
      indexName: d.TTYPENAME || '',
      managementFee: pf(d.FRATE) || 0,
      custodyFee: pf(d.DRATE) || 0,
      serviceFee: pf(d.SRATE) || 0,
      totalFee: totalFee || 0,
      nav,
      navDate: d.FSRQ || null,
      manager: d.JJJL || null,
      scale,
      rating,
      buySuggestion,
      dailyLimit,
      return1y,
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

  // 重置所有金选标记
  await pool.query("UPDATE funds SET is_gold_selected = false WHERE is_gold_selected = true");

  let success = 0;
  let navCount = 0;
  const errors = [];

  for (let i = 0; i < codes.length; i += 5) {
    const batch = codes.slice(i, i + 5);
    const results = await Promise.all(batch.map((c) => fetchOne(c)));

    for (const r of results) {
      if (!r) {
        errors.push(`API返回空数据`);
        continue;
      }

      try {
        // 写入基金基本信息
        await pool.query(
          `INSERT INTO funds (
            code, name, type, industry, index_name,
            management_fee, custody_fee, service_fee, total_fee,
            scale, rating, buy_suggestion, daily_limit, manager,
            is_gold_selected, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, NOW())
          ON CONFLICT (code) DO UPDATE SET
            name = COALESCE(NULLIF($2, ''), funds.name),
            type = COALESCE(NULLIF($3, ''), funds.type),
            industry = CASE
              WHEN funds.industry IS NULL OR funds.industry = '' OR funds.industry = '其他'
              THEN COALESCE(NULLIF($4, ''), funds.industry)
              ELSE funds.industry
            END,
            index_name = COALESCE(NULLIF($5, ''), funds.index_name),
            management_fee = COALESCE($6, funds.management_fee),
            custody_fee = COALESCE($7, funds.custody_fee),
            service_fee = COALESCE($8, funds.service_fee),
            total_fee = COALESCE($9, funds.total_fee),
            scale = COALESCE($10, funds.scale),
            rating = COALESCE($11, funds.rating),
            buy_suggestion = COALESCE(NULLIF($12, ''), funds.buy_suggestion),
            daily_limit = COALESCE($13, funds.daily_limit),
            manager = COALESCE(NULLIF($14, ''), funds.manager),
            is_gold_selected = true,
            updated_at = NOW()`,
          [
            r.code, r.name, r.type, r.industry, r.indexName,
            r.managementFee, r.custodyFee, r.serviceFee, r.totalFee,
            r.scale, r.rating, r.buySuggestion, r.dailyLimit, r.manager,
          ],
        );

        // 写入净值数据
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
          navCount++;
        }

        success++;
      } catch (e) {
        errors.push(`${r.code}: ${e.message}`);
      }
    }

    if ((i + 5) % 30 === 0 || i + 5 >= codes.length) {
      console.log(`进度: ${Math.min(i + 5, codes.length)}/${codes.length} (成功${success})`);
    }
    if (i + 5 < codes.length) await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n完成: 成功 ${success}/${codes.length}, 净值更新 ${navCount}`);
  if (errors.length > 0) {
    console.log(`错误 ${errors.length}:`);
    errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
  }

  const { rows } = await pool.query("SELECT COUNT(*) as c FROM funds WHERE is_gold_selected = true");
  console.log('数据库金选基金总数:', rows[0].c);

  // 统计分类分布
  const { rows: categories } = await pool.query(
    "SELECT industry, COUNT(*) as cnt FROM funds WHERE is_gold_selected = true GROUP BY industry ORDER BY cnt DESC"
  );
  console.log('\n分类分布:');
  categories.forEach(r => console.log(`  ${r.industry}: ${r.cnt}只`));

  await pool.end();
  process.exit(0);
})();
