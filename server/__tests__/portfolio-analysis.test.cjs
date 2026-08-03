'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { classifyAsset, generateSuggestions } = require('../utils/portfolio-analysis.cjs');

describe('classifyAsset', () => {
  it('货币基金按类型识别', () => {
    assert.equal(classifyAsset('000001', '某货币A', '', '货币'), '货币基金');
    assert.equal(classifyAsset('000001', '货基', '货币市场', ''), '货币基金');
  });

  it('债券/固收按类型、行业、名称识别', () => {
    assert.equal(classifyAsset('000001', '某债', '', '债券'), '固收');
    assert.equal(classifyAsset('000001', '稳健回报', '', ''), '固收');
    assert.equal(classifyAsset('000001', '某基金', '债券型', ''), '固收');
  });

  it('QDII/海外按类型、行业、名称识别', () => {
    assert.equal(classifyAsset('000001', '某QDII', '', 'qdii'), '海外股');
    assert.equal(classifyAsset('000001', '纳斯达克100', '', ''), '海外股');
    assert.equal(classifyAsset('000001', '标普500', '', ''), '海外股');
    assert.equal(classifyAsset('000001', '某基金', '港股通', ''), '海外股');
  });

  it('黄金归为固收（避险属性）', () => {
    assert.equal(classifyAsset('518880', '华安黄金ETF', '黄金', ''), '固收');
  });

  it('进攻型：半导体/AI/新能源/军工/科创等', () => {
    assert.equal(classifyAsset('000001', '芯片ETF', '', ''), '国内股(进攻)');
    assert.equal(classifyAsset('000001', '某基金', '人工智能', ''), '国内股(进攻)');
    assert.equal(classifyAsset('000001', '某基金', '军工', ''), '国内股(进攻)');
    assert.equal(classifyAsset('562500', '机器人ETF', '机器人', ''), '国内股(进攻)');
  });

  it('防御型：消费/医药/红利/宽基等默认归防御', () => {
    assert.equal(classifyAsset('110020', '沪深300ETF联接', '宽基', ''), '国内股(防御)');
    assert.equal(classifyAsset('100032', '红利指数', '红利', ''), '国内股(防御)');
  });
});

describe('generateSuggestions', () => {
  const baseHoldings = [
    { fund_name: '基金A', market_value: 100000, pnl: 5000, pnl_percent: 5 },
  ];
  const baseCategories = [
    { name: '国内股(防御)', weight: 100 },
  ];

  it('总市值为 0 返回空数组', () => {
    assert.deepEqual(generateSuggestions(baseHoldings, baseCategories, 0, [], null), []);
  });

  it('权益仓位 >80% 触发风险提示', () => {
    const cats = [{ name: '国内股(进攻)', weight: 90 }, { name: '固收', weight: 10 }];
    const s = generateSuggestions(baseHoldings, cats, 100000, [], null);
    assert.ok(s.some(x => x.title === '权益仓位过高'));
  });

  it('固收 >70% 触发机会提示', () => {
    const cats = [{ name: '固收', weight: 80 }, { name: '货币基金', weight: 20 }];
    const s = generateSuggestions(baseHoldings, cats, 100000, [], null);
    assert.ok(s.some(x => x.title === '固收占比偏高'));
  });

  it('单只基金占比 >30% 触发集中度提示', () => {
    const holdings = [
      { fund_name: '重仓基金', market_value: 80000, pnl: 1000, pnl_percent: 1 },
      { fund_name: '轻仓基金', market_value: 20000, pnl: 500, pnl_percent: 2 },
    ];
    const s = generateSuggestions(holdings, baseCategories, 100000, [], null);
    assert.ok(s.some(x => x.title.includes('持仓集中')));
  });

  it('低估/高估指数触发市场建议', () => {
    const market = [
      { name: '沪深300', pePercentile: 20 },
      { name: '中证500', pePercentile: 80 },
    ];
    const s = generateSuggestions(baseHoldings, baseCategories, 100000, market, null);
    assert.ok(s.some(x => x.title === '低估指数值得关注'));
    assert.ok(s.some(x => x.title === '高估指数注意风险'));
  });

  it('平均亏损 >10% 触发止损建议', () => {
    const holdings = [
      { fund_name: '亏损基', market_value: 50000, pnl: -6000, pnl_percent: -12 },
    ];
    const s = generateSuggestions(holdings, baseCategories, 50000, [], null);
    assert.ok(s.some(x => x.title === '亏损基金需关注'));
  });

  it('无异常时返回组合状态良好', () => {
    // 5 只各占 20%（无集中度），类别均衡且含海外配置
    // 权益35%+海外15%=50%(<80%)，固收40%(<70%)，海外15%(≥10%)，无亏损
    const holdings = [
      { fund_name: '基金A', market_value: 20000, pnl: 1000, pnl_percent: 5 },
      { fund_name: '基金B', market_value: 20000, pnl: 500, pnl_percent: 2 },
      { fund_name: '基金C', market_value: 20000, pnl: 2000, pnl_percent: 10 },
      { fund_name: '基金D', market_value: 20000, pnl: 300, pnl_percent: 1 },
      { fund_name: '基金E', market_value: 20000, pnl: 400, pnl_percent: 2 },
    ];
    const cats = [
      { name: '国内股(防御)', weight: 35 },
      { name: '海外股', weight: 15 },
      { name: '固收', weight: 40 },
      { name: '货币基金', weight: 10 },
    ];
    const s = generateSuggestions(holdings, cats, 100000, [], null);
    assert.ok(s.some(x => x.title === '组合状态良好'));
  });

  it('风险画像不匹配时触发再平衡建议', () => {
    const riskProfile = { riskType: '稳健型', allocation: [{ industry: '债', percentage: 60 }] };
    const cats = [{ name: '国内股(防御)', weight: 100 }];
    const s = generateSuggestions(baseHoldings, cats, 100000, [], riskProfile);
    assert.ok(s.some(x => x.type === 'rebalance'));
  });
});
