const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { allFunds } = require('./fund-data.cjs');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// 数据更新状态
let dataUpdateStatus = {
  lastUpdateTime: null,
  nextUpdateTime: null,
  isUpdating: false,
  updateCount: 0,
  error: null,
};

// 定时更新间隔（15分钟）
const UPDATE_INTERVAL = 15 * 60 * 1000;

// 从东方财富API获取基金实时净值
async function fetchFundNavFromEastmoney(code) {
  try {
    const response = await axios.get(
      `https://fundgz.1234567.com.cn/js/${code}.rt`,
      { timeout: 5000 }
    );

    if (response.data) {
      // 解析返回的JSONP数据
      const jsonStr = response.data.replace(/^jsonpgz\(/, '').replace(/\);?$/, '');
      const data = JSON.parse(jsonStr);

      return {
        code: data.fundcode,
        name: data.name,
        nav: parseFloat(data.dwjz),       // 单位净值
        totalNav: parseFloat(data.gsz),    // 累计净值
        navDate: data.jzrq,                // 净值日期
        return1w: parseFloat(data.zzl) || 0, // 日涨跌幅
      };
    }
  } catch (error) {
    // 静默处理错误
  }
  return null;
}

// 批量更新基金数据
async function updateAllFundData() {
  if (dataUpdateStatus.isUpdating) {
    console.log('数据更新正在进行中，跳过本次更新');
    return;
  }

  dataUpdateStatus.isUpdating = true;
  dataUpdateStatus.error = null;
  console.log(`[${new Date().toLocaleString()}] 开始更新基金数据...`);

  try {
    let updatedCount = 0;

    // 批量获取基金净值
    for (let i = 0; i < allFunds.length; i += 5) {
      const batch = allFunds.slice(i, i + 5);
      const promises = batch.map(fund => fetchFundNavFromEastmoney(fund.code));
      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        if (result && result.nav) {
          const fund = batch[index];
          fund.nav = result.nav;
          fund.navDate = result.navDate;
          updatedCount++;
        }
      });

      // 避免请求过快
      if (i + 5 < allFunds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    dataUpdateStatus.lastUpdateTime = new Date().toISOString();
    dataUpdateStatus.updateCount++;
    dataUpdateStatus.nextUpdateTime = new Date(Date.now() + UPDATE_INTERVAL).toISOString();
    console.log(`[${new Date().toLocaleString()}] 基金数据更新完成，更新了 ${updatedCount} 只基金`);

  } catch (error) {
    console.error('数据更新失败:', error.message);
    dataUpdateStatus.error = error.message;
  } finally {
    dataUpdateStatus.isUpdating = false;
  }
}

// 启动定时更新任务
function startAutoUpdate() {
  console.log('启动自动数据更新任务（每15分钟）');

  // 立即执行一次更新
  updateAllFundData();

  // 设置定时器
  setInterval(() => {
    updateAllFundData();
  }, UPDATE_INTERVAL);
}

// 启动自动更新
startAutoUpdate();

// API路由

// 获取数据更新状态
app.get('/api/status', (req, res) => {
  res.json({
    lastUpdateTime: dataUpdateStatus.lastUpdateTime,
    nextUpdateTime: dataUpdateStatus.nextUpdateTime,
    isUpdating: dataUpdateStatus.isUpdating,
    updateCount: dataUpdateStatus.updateCount,
    error: dataUpdateStatus.error,
    updateInterval: UPDATE_INTERVAL / 1000 / 60 + '分钟',
  });
});

// 手动触发数据更新
app.post('/api/update', async (req, res) => {
  if (dataUpdateStatus.isUpdating) {
    return res.json({ success: false, message: '数据更新正在进行中' });
  }

  updateAllFundData();
  res.json({ success: true, message: '数据更新已启动' });
});

// 获取基金列表
app.get('/api/funds', async (req, res) => {
  try {
    const { industry, type, sort, order, search } = req.query;
    let funds = [...allFunds];

    if (industry) {
      funds = funds.filter(f => f.industry === industry);
    }

    if (type) {
      funds = funds.filter(f => f.type === type);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      funds = funds.filter(f =>
        f.code.includes(search) ||
        f.name.toLowerCase().includes(searchLower)
      );
    }

    if (sort) {
      const sortOrder = order === 'asc' ? 1 : -1;
      funds.sort((a, b) => {
        if (sort === 'return1y') return (b.return1y - a.return1y) * sortOrder;
        if (sort === 'return6m') return (b.return6m - a.return6m) * sortOrder;
        if (sort === 'return3m') return (b.return3m - a.return3m) * sortOrder;
        if (sort === 'return1m') return (b.return1m - a.return1m) * sortOrder;
        if (sort === 'totalFee') return (a.totalFee - b.totalFee) * sortOrder;
        if (sort === 'scale') return (b.scale - a.scale) * sortOrder;
        if (sort === 'rating') return (b.rating - a.rating) * sortOrder;
        return 0;
      });
    }

    res.json(funds);
  } catch (error) {
    res.status(500).json({ error: '获取基金列表失败' });
  }
});

// 获取基金详情
app.get('/api/funds/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const fund = allFunds.find(f => f.code === code);

    if (!fund) {
      return res.status(404).json({ error: '基金不存在' });
    }

    // 生成详细数据
    const detail = generateFundDetail(fund);
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: '获取基金详情失败' });
  }
});

// 获取市场指数数据
app.get('/api/market/indices', async (req, res) => {
  try {
    const indices = [
      { name: '沪深300', code: '000300', pe: 12.5, pb: 1.3, pePercentile: 42, pbPercentile: 32, valuation: '合理偏低', suggestion: '适合定投' },
      { name: '中证500', code: '000905', pe: 26, pb: 1.8, pePercentile: 45, pbPercentile: 30, valuation: '合理偏低', suggestion: '适合定投' },
      { name: '创业板指', code: '399006', pe: 35, pb: 4.2, pePercentile: 55, pbPercentile: 40, valuation: '合理', suggestion: '适合小额定投' },
      { name: '科创50', code: '000688', pe: 45, pb: 4.5, pePercentile: 60, pbPercentile: 45, valuation: '合理偏高', suggestion: '建议观望' },
      { name: '上证指数', code: '000001', pe: 13.2, pb: 1.4, pePercentile: 48, pbPercentile: 35, valuation: '合理', suggestion: '适合定投' },
    ];

    res.json(indices);
  } catch (error) {
    res.status(500).json({ error: '获取指数数据失败' });
  }
});

// 获取行业推荐
app.get('/api/recommendations/industry', async (req, res) => {
  try {
    const recommendations = [
      {
        industry: '人工智能/AI',
        trend: '强势上涨',
        valuation: '合理偏高',
        buySuggestion: '优先配置',
        logic: 'AI算力+应用双轮驱动，年度核心主线',
        funds: allFunds.filter(f => f.industry === '人工智能').slice(0, 3),
      },
      {
        industry: '半导体/芯片',
        trend: '震荡上行',
        valuation: '合理',
        buySuggestion: '优先配置',
        logic: '半导体国产替代+AI芯片需求爆发',
        funds: allFunds.filter(f => f.industry === '半导体/芯片').slice(0, 3),
      },
      {
        industry: '纳斯达克100',
        trend: '强势上涨',
        valuation: '合理偏高',
        buySuggestion: '限大额配置',
        logic: '美股科技龙头，QDII额度紧张',
        funds: allFunds.filter(f => f.industry === '纳斯达克100').slice(0, 3),
      },
      {
        industry: '医药',
        trend: '底部反弹',
        valuation: '极低',
        buySuggestion: '左侧布局',
        logic: '估值历史极低，长期配置价值凸显',
        funds: allFunds.filter(f => f.industry === '医药').slice(0, 3),
      },
    ];

    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: '获取推荐失败' });
  }
});

// 获取分批建仓方案
app.get('/api/recommendations/batch-plans', async (req, res) => {
  try {
    const plans = [
      {
        batch: 1,
        time: '本周',
        ratio: 40,
        funds: ['人工智能ETF联接A(013349)', '半导体芯片ETF联接A(008887)'],
        method: '一次性买入',
        reason: 'AI+半导体为年度核心主线，Q2涨幅领先',
      },
      {
        batch: 2,
        time: '下周',
        ratio: 30,
        funds: ['光伏ETF联接A(011102)', '新能源ETF联接A(012348)'],
        method: '定投或一次性买入',
        reason: '光伏/新能源底部反转，估值低估区间',
      },
      {
        batch: 3,
        time: '第三周',
        ratio: 20,
        funds: ['军工ETF联接A(013139)', '科技ETF联接A(007873)'],
        method: '定投',
        reason: '稳健配置型标的，分散风险',
      },
      {
        batch: 4,
        time: '第四周',
        ratio: 10,
        funds: ['银行ETF联接A(001594)'],
        method: '定投',
        reason: '银行高股息防守，平衡组合风险',
      },
    ];

    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: '获取建仓方案失败' });
  }
});

// 获取QDII基金数据
app.get('/api/funds/qdii', async (req, res) => {
  try {
    const qdiiFunds = allFunds.filter(f => f.type === 'QDII');
    res.json(qdiiFunds);
  } catch (error) {
    res.status(500).json({ error: '获取QDII基金失败' });
  }
});

// 获取沪深300基金
app.get('/api/funds/hs300', async (req, res) => {
  try {
    const hs300Funds = allFunds.filter(f => f.industry === '沪深300');
    res.json(hs300Funds);
  } catch (error) {
    res.status(500).json({ error: '获取沪深300基金失败' });
  }
});

// 风险评估
app.post('/api/risk/profile', (req, res) => {
  try {
    const profile = req.body;

    const getRiskRecommendation = (profile) => {
      const score = profile.answers.reduce((sum, a) => sum + a, 0);
      const maxScore = profile.answers.length * 4;
      const ratio = score / maxScore;

      if (ratio < 0.3) {
        return {
          level: 'conservative',
          label: '保守型',
          description: '您偏好低风险投资，建议配置货币基金、债券基金为主',
          allocation: { stock: 20, bond: 60, money: 20 },
          funds: allFunds.filter(f => f.return1y < 10).slice(0, 5),
        };
      } else if (ratio < 0.6) {
        return {
          level: 'moderate',
          label: '稳健型',
          description: '您能承受一定风险，建议均衡配置股票和债券基金',
          allocation: { stock: 50, bond: 40, money: 10 },
          funds: allFunds.filter(f => f.return1y >= 10 && f.return1y < 25).slice(0, 5),
        };
      } else {
        return {
          level: 'aggressive',
          label: '激进型',
          description: '您追求高收益，可配置较多股票型基金',
          allocation: { stock: 80, bond: 15, money: 5 },
          funds: allFunds.filter(f => f.return1y >= 25).slice(0, 5),
        };
      }
    };

    const recommendation = getRiskRecommendation(profile);
    res.json(recommendation);
  } catch (error) {
    res.status(500).json({ error: '风险评估失败' });
  }
});

// 定投计算器
app.post('/api/tools/dca', (req, res) => {
  try {
    const { monthlyAmount, period, expectedReturn } = req.body;
    const monthlyRate = expectedReturn / 100 / 12;
    let totalInvest = monthlyAmount * period;
    let totalValue = 0;

    for (let i = 0; i < period; i++) {
      totalValue = (totalValue + monthlyAmount) * (1 + monthlyRate);
    }

    const totalReturn = totalValue - totalInvest;
    const returnRate = (totalReturn / totalInvest * 100).toFixed(2);

    res.json({
      totalInvest: totalInvest.toFixed(2),
      totalValue: totalValue.toFixed(2),
      totalReturn: totalReturn.toFixed(2),
      returnRate,
    });
  } catch (error) {
    res.status(500).json({ error: '计算失败' });
  }
});

// 基金对比
app.post('/api/tools/compare', async (req, res) => {
  try {
    const { codes } = req.body;
    const funds = codes
      .map(code => {
        const fund = allFunds.find(f => f.code === code);
        if (fund) return generateFundDetail(fund);
        return null;
      })
      .filter(Boolean);

    res.json(funds);
  } catch (error) {
    res.status(500).json({ error: '对比失败' });
  }
});

// 获取行业列表
app.get('/api/industries', (req, res) => {
  const industries = [...new Set(allFunds.map(f => f.industry))].sort();
  res.json(industries);
});

// 生成基金详情数据
function generateFundDetail(fund) {
  const getValuation = (return1y) => {
    if (return1y > 30) return '合理偏高';
    if (return1y > 15) return '合理';
    if (return1y > 0) return '合理偏低';
    if (return1y > -10) return '低估';
    return '极低';
  };

  const getValuationCode = (valuation) => {
    if (valuation.includes('极低')) return 'very_low';
    if (valuation.includes('低估') || valuation.includes('偏低')) return 'low';
    if (valuation.includes('合理') && !valuation.includes('偏')) return 'reasonable';
    if (valuation.includes('偏高')) return 'high';
    return 'reasonable';
  };

  const getHoldings = (industry) => {
    const holdingsMap = {
      '人工智能': [
        { name: '科大讯飞', percentage: 12.5 },
        { name: '海康威视', percentage: 9.8 },
        { name: '中际旭创', percentage: 8.2 },
        { name: '工业富联', percentage: 7.5 },
        { name: '寒武纪', percentage: 6.8 },
        { name: '紫光股份', percentage: 5.2 },
        { name: '中科曙光', percentage: 4.8 },
        { name: '浪潮信息', percentage: 4.5 },
        { name: '用友网络', percentage: 3.8 },
        { name: '金山办公', percentage: 3.2 },
      ],
      '半导体/芯片': [
        { name: '北方华创', percentage: 11.2 },
        { name: '中芯国际', percentage: 10.5 },
        { name: '韦尔股份', percentage: 8.8 },
        { name: '兆易创新', percentage: 7.2 },
        { name: '卓胜微', percentage: 6.5 },
        { name: '圣邦股份', percentage: 5.8 },
        { name: '中微公司', percentage: 5.2 },
        { name: '长电科技', percentage: 4.5 },
        { name: '华虹半导体', percentage: 4.2 },
        { name: '紫光国微', percentage: 3.8 },
      ],
      '纳斯达克100': [
        { name: '苹果 (AAPL)', percentage: 12.8 },
        { name: '微软 (MSFT)', percentage: 11.5 },
        { name: '英伟达 (NVDA)', percentage: 8.5 },
        { name: '亚马逊 (AMZN)', percentage: 7.2 },
        { name: 'Meta (META)', percentage: 5.8 },
        { name: '谷歌 (GOOGL)', percentage: 5.5 },
        { name: '特斯拉 (TSLA)', percentage: 4.2 },
        { name: '博通 (AVGO)', percentage: 3.8 },
        { name: '奈飞 (NFLX)', percentage: 3.2 },
        { name: 'AMD (AMD)', percentage: 2.8 },
      ],
      '医药': [
        { name: '恒瑞医药', percentage: 10.5 },
        { name: '药明康德', percentage: 9.2 },
        { name: '迈瑞医疗', percentage: 8.5 },
        { name: '片仔癀', percentage: 7.2 },
        { name: '爱尔眼科', percentage: 6.5 },
        { name: '智飞生物', percentage: 5.8 },
        { name: '长春高新', percentage: 5.2 },
        { name: '沃森生物', percentage: 4.5 },
        { name: '通策医疗', percentage: 3.8 },
        { name: '华大基因', percentage: 3.2 },
      ],
      '新能源': [
        { name: '宁德时代', percentage: 15.2 },
        { name: '比亚迪', percentage: 12.5 },
        { name: '隆基绿能', percentage: 8.8 },
        { name: '阳光电源', percentage: 7.2 },
        { name: '通威股份', percentage: 6.5 },
        { name: '亿纬锂能', percentage: 5.8 },
        { name: '赣锋锂业', percentage: 5.2 },
        { name: '天齐锂业', percentage: 4.5 },
        { name: '璞泰来', percentage: 3.8 },
        { name: '恩捷股份', percentage: 3.2 },
      ],
      '消费': [
        { name: '贵州茅台', percentage: 15.5 },
        { name: '五粮液', percentage: 10.2 },
        { name: '山西汾酒', percentage: 8.5 },
        { name: '泸州老窖', percentage: 7.2 },
        { name: '海天味业', percentage: 6.5 },
        { name: '伊利股份', percentage: 5.8 },
        { name: '洋河股份', percentage: 5.2 },
        { name: '古井贡酒', percentage: 4.5 },
        { name: '今世缘', percentage: 3.8 },
        { name: '舍得酒业', percentage: 3.2 },
      ],
    };

    return holdingsMap[industry] || [
      { name: '重仓股1', percentage: 12.5 },
      { name: '重仓股2', percentage: 9.8 },
      { name: '重仓股3', percentage: 8.2 },
      { name: '重仓股4', percentage: 6.5 },
      { name: '重仓股5', percentage: 5.8 },
    ];
  };

  const getPerformanceHistory = (nav, return1y) => {
    const monthlyReturn = return1y / 12;
    const history = [];
    let currentNav = nav * 0.92;

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthReturn = monthlyReturn + (Math.random() - 0.5) * 4;
      currentNav = currentNav * (1 + monthReturn / 100);

      history.push({
        date: monthStr,
        nav: parseFloat(currentNav.toFixed(4)),
        return: parseFloat(monthReturn.toFixed(2)),
      });
    }

    return history;
  };

  const valuation = fund.valuation || getValuation(fund.return1y);
  const dailyLimit = fund.dailyLimit || (fund.buySuggestion === '限大额' ? 10 : 0);

  return {
    ...fund,
    fullName: `${fund.name} (${fund.code})`,
    establishDate: '2020-01-15',
    fundManager: fund.name.includes('华夏') ? '张弘弢' :
                 fund.name.includes('易方达') ? '成曦' :
                 fund.name.includes('广发') ? '霍华明' :
                 fund.name.includes('天弘') ? '杨超' :
                 fund.name.includes('南方') ? '孙伟' :
                 fund.name.includes('国泰') ? '梁杏' :
                 fund.name.includes('华安') ? '许之彦' :
                 '基金经理',
    company: fund.name.includes('华夏') ? '华夏基金' :
             fund.name.includes('易方达') ? '易方达基金' :
             fund.name.includes('广发') ? '广发基金' :
             fund.name.includes('天弘') ? '天弘基金' :
             fund.name.includes('南方') ? '南方基金' :
             fund.name.includes('国泰') ? '国泰基金' :
             '基金公司',
    managementFee: fund.managementFee || 0.5,
    custodyFee: fund.custodyFee || 0.1,
    serviceFee: fund.serviceFee || 0,
    purchaseFee: 1.20,
    purchaseFeeDiscount: 0.12,
    totalFee: fund.totalFee || (fund.managementFee || 0.5) + (fund.custodyFee || 0.1),
    share: (fund.scale * 0.8).toFixed(2),
    shareChange: (Math.random() * 10 - 2).toFixed(2),
    institutionHold: (Math.random() * 5 + 1).toFixed(2),
    individualHold: (95 + Math.random() * 5).toFixed(2),
    purchaseStatus: fund.buySuggestion === '暂停申购' ? 'suspended' :
                   fund.buySuggestion === '限大额' ? 'limited' : 'open',
    dailyLimit: dailyLimit,
    rating: fund.rating || 3,
    recommendation: fund.logic || '暂无推荐理由',
    riskLevel: fund.return1y > 20 ? 'high' : fund.return1y > 0 ? 'medium' : 'high',
    pe: (15 + Math.random() * 30).toFixed(2),
    pb: (1 + Math.random() * 4).toFixed(2),
    pePercentile: (20 + Math.random() * 60).toFixed(2),
    pbPercentile: (15 + Math.random() * 50).toFixed(2),
    valuation: getValuationCode(valuation),
    redeemFee: [
      { period: '7天内', rate: 1.50 },
      { period: '7天-1年', rate: 0.50 },
      { period: '1-2年', rate: 0.25 },
      { period: '2年以上', rate: 0.00 },
    ],
    topHoldings: getHoldings(fund.industry),
    performanceHistory: getPerformanceHistory(fund.nav, fund.return1y),
    investmentAdvice: fund.return1y > 30 ? '该基金近期表现优异，但估值偏高，建议分批买入或定投配置。' :
                     fund.return1y > 10 ? '该基金表现稳健，适合长期持有，建议定投配置。' :
                     fund.return1y > 0 ? '该基金表现一般，可适当配置，建议观察后续走势。' :
                     '该基金近期表现不佳，但估值处于低位，可考虑左侧布局。',
    suitableFor: fund.return1y > 20 ? '激进型投资者' :
                 fund.return1y > 0 ? '稳健型投资者' :
                 '保守型投资者',
    lastUpdateTime: dataUpdateStatus.lastUpdateTime,
  };
}

app.listen(PORT, () => {
  console.log(`基金推荐服务器运行在 http://localhost:${PORT}`);
  console.log('自动数据更新已启动（每15分钟）');
});
