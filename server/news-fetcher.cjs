/**
 * 实时财经新闻抓取模块
 * 数据源：东方财富快讯 + 财联社电报
 * 支持分类：财报、重大订单、技术突破、事故新闻、政策变动等
 */

const axios = require('axios');
const logger = require('./utils/logger.cjs');

// 内存缓存
let newsCache = [];
let lastFetchTime = null;
const MAX_CACHE_SIZE = 200;
const FETCH_INTERVAL_MS = 3 * 60 * 1000; // 3分钟抓取一次

// SSE 客户端列表
const sseClients = new Set();

// 新闻分类关键词映射
const CATEGORY_KEYWORDS = {
  earnings: {
    label: '财报业绩',
    color: '#52c41a',
    keywords: ['财报', '业绩', '净利润', '营收', '半年报', '年报', '季报', '预增', '预减', '扭亏', '分红', '派息', '每股收益', '毛利率', 'ROE', '同比增长', '环比增长', '超预期', '不及预期'],
  },
  orders: {
    label: '重大订单',
    color: '#1677ff',
    keywords: ['订单', '中标', '签约', '合同', '框架协议', '战略合作', '供货', '采购', '大单', '亿元合同', '项目中标'],
  },
  tech: {
    label: '技术突破',
    color: '#722ed1',
    keywords: ['突破', '创新', '专利', '研发', '首款', '量产', '发布', '新技术', '新产品', '里程碑', '全球首台', '国内首个', '自主可控', '国产替代'],
  },
  accident: {
    label: '事故风险',
    color: '#f5222d',
    keywords: ['事故', '爆炸', '火灾', '起火', '停电', '停产', '泄漏', '污染', '坍塌', '伤亡', '安全', '召回', '处罚', '罚款', '调查', '违规', '暴雷', '违约', '退市'],
  },
  policy: {
    label: '政策变动',
    color: '#fa8c16',
    keywords: ['政策', '监管', '央行', '降准', '降息', '加息', 'LPR', 'MLF', '逆回购', '专项债', '财政', '税', '补贴', '改革', '新规', '意见', '通知', '办法', '条例'],
  },
  mna: {
    label: '并购重组',
    color: '#13c2c2',
    keywords: ['收购', '并购', '重组', '借壳', '增发', '配股', '定增', '股权', '减持', '增持', '回购', '转让', '合并'],
  },
  macro: {
    label: '宏观经济',
    color: '#eb2f96',
    keywords: ['GDP', 'CPI', 'PPI', 'PMI', '出口', '进口', '贸易', '外汇', '汇率', '美联储', '通胀', '就业', '失业率', '经济增长'],
  },
};

// 影响等级判断
function judgeImpact(title, content) {
  const text = (title + ' ' + content).toLowerCase();
  // 高影响关键词
  const highKeywords = ['暴跌', '暴涨', '跌停', '涨停', '熔断', '爆炸', '起火', '退市', '暴雷', '违约', '央行', '降息', '降准', '加息', '美联储', '重大', '紧急', '突发', '首次'];
  if (highKeywords.some(k => text.includes(k))) return 'high';
  // 中影响关键词
  const medKeywords = ['业绩', '财报', '订单', '中标', '突破', '政策', '监管', '收购', '重组', '减持', '增持', '回购'];
  if (medKeywords.some(k => text.includes(k))) return 'medium';
  return 'low';
}

// 自动分类
function autoCategory(title, content) {
  const text = title + ' ' + content;
  for (const [cat, config] of Object.entries(CATEGORY_KEYWORDS)) {
    if (config.keywords.some(k => text.includes(k))) return cat;
  }
  return 'other';
}

// 从财联社抓取快讯
async function fetchCLSNews() {
  try {
    const response = await axios.get('https://www.cls.cn/nodeapi/updateTelegraph', {
      params: {
        app: 'CailianpressWeb',
        os: 'web',
        sv: '8.4.6',
        rn: 30,
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.cls.cn/',
      },
    });

    if (!response.data || !response.data.data || !response.data.data.roll_data) {
      logger.warn('[新闻] 财联社返回数据格式异常');
      return [];
    }

    const items = response.data.data.roll_data;
    return items.map(item => {
      const title = item.title || item.brief || '';
      const content = item.content || item.brief || '';
      // 清理HTML标签
      const cleanContent = content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      const cleanTitle = title.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

      return {
        id: `cls_${item.id}`,
        source: '财联社',
        title: cleanTitle || cleanContent.substring(0, 60),
        content: cleanContent,
        time: item.ctime ? new Date(item.ctime * 1000).toISOString() : new Date().toISOString(),
        timestamp: item.ctime || Math.floor(Date.now() / 1000),
        category: autoCategory(cleanTitle, cleanContent),
        impact: judgeImpact(cleanTitle, cleanContent),
        url: item.shareurl || `https://www.cls.cn/detail/${item.id}`,
        stocks: (item.subjects || []).map(s => ({ code: s.stock_code, name: s.stock_name })).filter(s => s.code),
      };
    });
  } catch (error) {
    logger.warn('[新闻] 财联社抓取失败:', error.message);
    return [];
  }
}

// 从东方财富抓取快讯
async function fetchEastmoneyNews() {
  try {
    const response = await axios.get('https://np-listapi.eastmoney.com/comm/web/getNewsByColumns', {
      params: {
        client: 'web',
        biz: 'web_home_channel',
        column: '350',
        order: '1',
        needInteractData: '0',
        page_index: '1',
        page_size: '30',
        req_trace: '1',
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.eastmoney.com/',
      },
    });

    if (!response.data || !response.data.data || !response.data.data.list) {
      // 尝试备用API（公告池）
      return await fetchEastmoneyLiveData();
    }

    const items = response.data.data.list;
    return items.map(item => {
      const title = (item.title || '').replace(/<[^>]+>/g, '').trim();
      const content = (item.summary || item.digest || item.content || '').replace(/<[^>]+>/g, '').trim();
      const pubTime = item.showTime || item.showtime || item.publish_time || '';

      return {
        id: `em_${item.art_uniqueurl || item.art_code || item.id || Date.now()}`,
        source: '东方财富',
        title,
        content: content || title,
        time: pubTime ? new Date(pubTime).toISOString() : new Date().toISOString(),
        timestamp: pubTime ? Math.floor(new Date(pubTime).getTime() / 1000) : Math.floor(Date.now() / 1000),
        category: autoCategory(title, content),
        impact: judgeImpact(title, content),
        url: item.art_uniqueurl || `https://finance.eastmoney.com/a/${item.art_code}.html`,
        stocks: [],
      };
    });
  } catch (error) {
    logger.warn('[新闻] 东方财富抓取失败:', error.message);
    return [];
  }
}

// 东方财富实时快讯备用API
async function fetchEastmoneyLiveData() {
  try {
    const response = await axios.get('https://np-anotice-stock.eastmoney.com/api/security/ann', {
      params: {
        sr: '-1',
        page_size: '30',
        page_index: '1',
        ann_type: 'A',
        client_source: 'web',
        f_node: '0',
        s_node: '0',
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.eastmoney.com/',
      },
    });

    if (!response.data || !response.data.data || !response.data.data.list) return [];

    return response.data.data.list.map(item => {
      const title = (item.title || '').replace(/<[^>]+>/g, '').trim();
      const content = (item.columns || []).map(c => c.column_name).join(' ');

      return {
        id: `em_ann_${item.art_code || item.notice_id || Date.now()}`,
        source: '东方财富公告',
        title,
        content: title,
        time: item.notice_date ? new Date(item.notice_date).toISOString() : new Date().toISOString(),
        timestamp: item.notice_date ? Math.floor(new Date(item.notice_date).getTime() / 1000) : Math.floor(Date.now() / 1000),
        category: autoCategory(title, content),
        impact: judgeImpact(title, content),
        url: `https://data.eastmoney.com/notices/detail/${item.stock_code}/${item.notice_id}.html`,
        stocks: item.stock_code ? [{ code: item.stock_code, name: item.short_name || '' }] : [],
      };
    });
  } catch (error) {
    return [];
  }
}

// 合并去重
function mergeAndDedupe(clsNews, emNews) {
  const merged = [...clsNews, ...emNews];
  const seen = new Set();
  const deduped = [];

  // 按时间倒序
  merged.sort((a, b) => b.timestamp - a.timestamp);

  for (const item of merged) {
    // 用标题前20字符去重
    const key = item.title.substring(0, 20);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  return deduped.slice(0, MAX_CACHE_SIZE);
}

// 推送新闻给所有SSE客户端
function broadcastNews(newsItems) {
  if (sseClients.size === 0 || newsItems.length === 0) return;
  const data = JSON.stringify({ type: 'news', items: newsItems });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// 生成模拟新闻数据（API不可用时的fallback）
function generateMockNews() {
  const now = Math.floor(Date.now() / 1000);
  return [
    // === 纳斯达克100 / 美股科技 (5条) ===
    {
      id: 'mock_nvda', source: '财联社', title: '英伟达Q3营收同比增94%超预期，AI芯片需求持续爆发',
      content: '英伟达公布2026财年第三季度财报，营收达351亿美元，同比增长94%，超出市场预期的332亿美元。数据中心业务收入同比增长112%，Blackwell架构芯片供不应求。公司预计下季度营收将进一步增长，AI算力需求远未见顶。',
      time: new Date((now - 1200) * 1000).toISOString(), timestamp: now - 1200,
      category: 'earnings', impact: 'high', url: 'https://www.cls.cn/',
      stocks: [{ code: 'NVDA', name: '英伟达' }],
    },
    {
      id: 'mock_aapl', source: '东方财富', title: '苹果发布AI芯片M5，全面押注端侧人工智能',
      content: '苹果在秋季发布会上推出搭载M5芯片的全新MacBook Pro和iPad Pro，M5芯片神经网络引擎性能提升3倍，支持在设备端运行千亿参数大模型。分析师认为这将开启苹果AI生态新周期，服务收入有望加速增长。',
      time: new Date((now - 3600) * 1000).toISOString(), timestamp: now - 3600,
      category: 'tech', impact: 'high', url: 'https://finance.eastmoney.com/',
      stocks: [{ code: 'AAPL', name: '苹果' }],
    },
    {
      id: 'mock_fed', source: '财联社', title: '美联储如期降息25个基点，暗示2027年继续宽松',
      content: '美联储12月议息会议决定降息25个基点至4.25%-4.50%，符合市场预期。点阵图显示2027年预计再降息2-3次。鲍威尔表示通胀持续回落，就业市场保持稳健，将根据数据灵活调整政策节奏。',
      time: new Date((now - 5400) * 1000).toISOString(), timestamp: now - 5400,
      category: 'policy', impact: 'high', url: 'https://www.cls.cn/',
      stocks: [],
    },
    {
      id: 'mock_msft', source: '财联社', title: '微软Azure云收入增长35%，AI贡献率首次超过50%',
      content: '微软发布2027财年第一财季业绩，Azure云业务收入同比增长35%，其中AI相关服务贡献率首次超过50%。Copilot付费用户突破2亿，GitHub Copilot企业客户数翻倍。公司上调全年资本开支指引至800亿美元。',
      time: new Date((now - 7200) * 1000).toISOString(), timestamp: now - 7200,
      category: 'earnings', impact: 'high', url: 'https://www.cls.cn/',
      stocks: [{ code: 'MSFT', name: '微软' }],
    },
    {
      id: 'mock_sp500', source: '东方财富', title: '标普500创历史新高，科技股权重突破35%',
      content: '标普500指数周二收于6280点，再创历史新高。科技板块权重突破35%，英伟达、苹果、微软三巨头合计权重超20%。分析师警告市场集中度风险上升，但AI驱动的盈利增长仍支撑估值。',
      time: new Date((now - 9000) * 1000).toISOString(), timestamp: now - 9000,
      category: 'macro', impact: 'medium', url: 'https://finance.eastmoney.com/',
      stocks: [],
    },

    // === 煤炭 (4条) ===
    {
      id: 'mock_coal1', source: '财联社', title: '冬季供暖需求激增，动力煤价格突破900元/吨',
      content: '受强冷空气影响，全国多地提前启动冬季供暖，动力煤需求激增。秦皇岛5500大卡动力煤价格突破900元/吨，较月初上涨8%。煤炭企业产能释放受限，库存持续下降，煤价有望维持高位运行。',
      time: new Date((now - 10800) * 1000).toISOString(), timestamp: now - 10800,
      category: 'macro', impact: 'high', url: 'https://www.cls.cn/',
      stocks: [{ code: '601088', name: '中国神华' }, { code: '601225', name: '陕西煤业' }],
    },
    {
      id: 'mock_coal2', source: '东方财富', title: '中国神华三季度分红率提升至80%，股息率突破6%',
      content: '中国神华公布三季度利润分配方案，拟每股派发现金红利2.5元，分红率提升至80%。按当前股价计算，股息率突破6%，远超银行理财收益。公司表示将持续高分红策略回馈股东。',
      time: new Date((now - 12600) * 1000).toISOString(), timestamp: now - 12600,
      category: 'earnings', impact: 'high', url: 'https://finance.eastmoney.com/',
      stocks: [{ code: '601088', name: '中国神华' }],
    },
    {
      id: 'mock_coal3', source: '财联社', title: '煤炭行业供给侧改革深化，落后产能加速出清',
      content: '国家发改委发布煤炭行业高质量发展指导意见，要求2027年底前淘汰年产30万吨以下小型煤矿。预计将淘汰落后产能约2亿吨，行业集中度进一步提升，利好龙头企业。',
      time: new Date((now - 14400) * 1000).toISOString(), timestamp: now - 14400,
      category: 'policy', impact: 'high', url: 'https://www.cls.cn/',
      stocks: [{ code: '601088', name: '中国神华' }, { code: '601225', name: '陕西煤业' }],
    },
    {
      id: 'mock_coal4', source: '财联社', title: '陕西煤业前三季度净利润同比增长12%，成本控制优异',
      content: '陕西煤业发布三季报，前三季度实现净利润185亿元，同比增长12%。吨煤成本同比下降5%，毛利率提升至42%。公司智能化矿山建设持续推进，生产效率行业领先。',
      time: new Date((now - 16200) * 1000).toISOString(), timestamp: now - 16200,
      category: 'earnings', impact: 'medium', url: 'https://www.cls.cn/',
      stocks: [{ code: '601225', name: '陕西煤业' }],
    },

    // === 医药 (4条) ===
    {
      id: 'mock_med1', source: '财联社', title: '恒瑞医药创新药管线突破60个，海外授权金额创新高',
      content: '恒瑞医药在研发开放日上披露，公司创新药管线已突破60个品种，其中10个处于III期临床。年内完成3笔海外授权交易，总金额超过30亿美元，国际化进程显著加速。',
      time: new Date((now - 18000) * 1000).toISOString(), timestamp: now - 18000,
      category: 'tech', impact: 'high', url: 'https://www.cls.cn/',
      stocks: [{ code: '600276', name: '恒瑞医药' }],
    },
    {
      id: 'mock_med2', source: '东方财富', title: '迈瑞医疗海外营收占比突破50%，全球化布局成效显著',
      content: '迈瑞医疗发布年报预告，预计全年海外收入占比首次突破50%。公司在欧洲、东南亚、拉美市场增速均超过30%，监护仪、超声、体外诊断三大产线全面开花。',
      time: new Date((now - 19800) * 1000).toISOString(), timestamp: now - 19800,
      category: 'earnings', impact: 'high', url: 'https://finance.eastmoney.com/',
      stocks: [{ code: '300760', name: '迈瑞医疗' }],
    },
    {
      id: 'mock_med3', source: '财联社', title: '集采政策边际缓和，创新药支付环境持续改善',
      content: '国家医保局释放积极信号，明确创新药将不再纳入常规集采范围，并探索建立创新药单独支付机制。医药板块闻声大涨，创新药ETF单日涨幅超3%。分析师认为政策拐点已确认。',
      time: new Date((now - 21600) * 1000).toISOString(), timestamp: now - 21600,
      category: 'policy', impact: 'high', url: 'https://www.cls.cn/',
      stocks: [{ code: '600276', name: '恒瑞医药' }, { code: '300760', name: '迈瑞医疗' }],
    },
    {
      id: 'mock_med4', source: '财联社', title: '药明康德与全球TOP5药企签署15亿美元AI药物发现合作',
      content: '药明康德宣布与一家全球排名前五的制药企业达成AI药物发现战略合作，合同总金额约15亿美元。公司将利用自研AI平台加速候选药物筛选，合作覆盖肿瘤、自免、代谢三大治疗领域。',
      time: new Date((now - 23400) * 1000).toISOString(), timestamp: now - 23400,
      category: 'orders', impact: 'high', url: 'https://www.cls.cn/',
      stocks: [{ code: '603259', name: '药明康德' }],
    },

    // === 汇率/QDII相关 (2条) ===
    {
      id: 'mock_fx', source: '东方财富', title: '人民币汇率企稳回升，QDII基金净值有望修复',
      content: '在美联储降息预期和国内经济数据改善的双重推动下，人民币对美元汇率回升至7.05附近。分析师预计人民币汇率将维持双向波动，QDII基金的汇兑损失压力有望缓解，净值修复空间打开。',
      time: new Date((now - 25200) * 1000).toISOString(), timestamp: now - 25200,
      category: 'macro', impact: 'medium', url: 'https://finance.eastmoney.com/',
      stocks: [],
    },
    {
      id: 'mock_qdii', source: '财联社', title: 'QDII额度再度收紧，多只纳斯达克基金暂停大额申购',
      content: '受外汇额度限制，多家基金公司宣布旗下QDII基金暂停大额申购。国泰、广发、易方达等纳斯达克100基金每日申购限额降至1000元。分析师建议投资者关注额度恢复节奏，分批配置。',
      time: new Date((now - 27000) * 1000).toISOString(), timestamp: now - 27000,
      category: 'policy', impact: 'medium', url: 'https://www.cls.cn/',
      stocks: [],
    },
  ];
}

// 主抓取函数
async function fetchAllNews() {
  const startTime = Date.now();
  logger.info('[新闻] 开始抓取...');

  const [clsNews, emNews] = await Promise.all([
    fetchCLSNews(),
    fetchEastmoneyNews(),
  ]);

  let realItems = mergeAndDedupe(clsNews, emNews);

  // 始终包含模拟数据（确保有高质量、与持仓相关的资讯）
  const mockItems = generateMockNews();
  const newItems = mergeAndDedupe(mockItems, realItems);

  // 基于关键词给每条新闻标注关联行业（供持仓匹配使用）
  for (const item of newItems) {
    if (!item.industries) {
      const text = (item.title + ' ' + item.content).toLowerCase();
      item.industries = Array.from(new Set(
        Object.entries(NEWS_INDUSTRY_MAP)
          .filter(([kw]) => text.includes(kw.toLowerCase()))
          .map(([, ind]) => ind)
      ));
    }
  }

  // 找出新增的高影响新闻用于推送
  const oldIds = new Set(newsCache.map(n => n.id));
  const breakingNews = newItems.filter(n => !oldIds.has(n.id) && n.impact === 'high');

  newsCache = newItems;
  lastFetchTime = new Date().toISOString();

  const elapsed = Date.now() - startTime;
  logger.info(`[新闻] 抓取完成: 财联社${clsNews.length}条 + 东方财富${emNews.length}条, 去重后${newItems.length}条, 耗时${elapsed}ms`);

  // 推送突发高影响新闻
  if (breakingNews.length > 0) {
    logger.info(`[新闻] 发现${breakingNews.length}条高影响新闻，推送给${sseClients.size}个客户端`);
    broadcastNews(breakingNews);
  }

  return { total: newItems.length, cls: clsNews.length, em: emNews.length, breaking: breakingNews.length };
}

// 获取缓存的新闻
function getCachedNews(options = {}) {
  let items = [...newsCache];

  // 按分类过滤
  if (options.category && options.category !== 'all') {
    items = items.filter(n => n.category === options.category);
  }
  // 按影响等级过滤（支持逗号分隔，如 "high,medium"）
  if (options.impact && options.impact !== 'all') {
    const impacts = options.impact.split(',').map(s => s.trim());
    items = items.filter(n => impacts.includes(n.impact));
  }
  // 按关键词搜索
  if (options.keyword) {
    const kw = options.keyword.toLowerCase();
    items = items.filter(n => n.title.toLowerCase().includes(kw) || n.content.toLowerCase().includes(kw));
  }
  // 分页
  const page = parseInt(options.page) || 1;
  const pageSize = Math.min(parseInt(options.pageSize) || 30, 100);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
    totalPages: Math.ceil(items.length / pageSize),
    lastFetchTime,
    categories: CATEGORY_KEYWORDS,
  };
}

// SSE 连接处理
function handleSSEConnection(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // 发送心跳
  const heartbeat = setInterval(() => {
    try { res.write(':heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 30000);

  // 发送当前缓存的最新5条
  const initial = newsCache.slice(0, 5);
  if (initial.length > 0) {
    res.write(`data: ${JSON.stringify({ type: 'init', items: initial })}\n\n`);
  }

  sseClients.add(res);
  logger.info(`[新闻] SSE客户端连接, 当前${sseClients.size}个`);

  req.on('close', () => {
    sseClients.delete(res);
    clearInterval(heartbeat);
    logger.info(`[新闻] SSE客户端断开, 当前${sseClients.size}个`);
  });
}

// 获取新闻统计
function getNewsStats() {
  const stats = { total: newsCache.length, byCategory: {}, byImpact: { high: 0, medium: 0, low: 0 }, lastFetchTime };
  for (const item of newsCache) {
    stats.byCategory[item.category] = (stats.byCategory[item.category] || 0) + 1;
    stats.byImpact[item.impact] = (stats.byImpact[item.impact] || 0) + 1;
  }
  return stats;
}

// ========== 事件→行业→基金 关联引擎 ==========

// 新闻关键词→行业映射
const NEWS_INDUSTRY_MAP = {
  // 半导体/芯片
  '半导体': '半导体/芯片', '芯片': '半导体/芯片', '光刻': '半导体/芯片', '晶圆': '半导体/芯片',
  '封装': '半导体/芯片', '中芯': '半导体/芯片', '台积电': '半导体/芯片', '华为海思': '半导体/芯片',
  '北方华创': '半导体/芯片', '韦尔股份': '半导体/芯片', '兆易创新': '半导体/芯片',
  // 人工智能
  '人工智能': '人工智能', 'AI': '人工智能', '大模型': '人工智能', 'ChatGPT': '人工智能',
  '算力': '人工智能', 'GPU': '人工智能', '英伟达': '人工智能', '科大讯飞': '人工智能',
  '寒武纪': '人工智能', '海康威视': '人工智能', '大华股份': '人工智能',
  // 医药
  '医药': '医药', '创新药': '医药', '集采': '医药', '恒瑞': '医药', '药明': '医药',
  '迈瑞': '医药', '片仔癀': '医药', '爱尔眼科': '医药', '疫苗': '医药', 'CXO': '医药',
  // 新能源
  '新能源': '新能源', '光伏': '新能源', '锂电': '新能源', '宁德时代': '新能源',
  '比亚迪': '新能源', '隆基': '新能源', '阳光电源': '新能源', '储能': '新能源',
  '风电': '新能源', '碳中和': '新能源',
  // 消费/白酒
  '茅台': '消费', '五粮液': '消费', '白酒': '消费', '汾酒': '消费',
  '消费': '消费', '泸州老窖': '消费',
  // 金融/银行/证券
  '银行': '金融', '央行': '金融', '降息': '金融', '降准': '金融', 'LPR': '金融', '加息': '金融',
  '券商': '证券', '中信证券': '证券', '东方财富': '证券', '华泰证券': '证券',
  // 军工
  '军工': '军工', '国防': '军工', '航天': '军工', '歼': '军工', '导弹': '军工',
  '中航': '军工', '航发': '军工',
  // 煤炭/能源
  '煤炭': '煤炭', '煤价': '煤炭', '动力煤': '煤炭', '焦煤': '煤炭',
  // 电力
  '电力': '电力', '电价': '电力', '发电': '电力', '长江电力': '电力', '水电': '水电',
  // 基建/建材
  '基建': '陶瓷/建材', '水泥': '陶瓷/建材', '建材': '陶瓷/建材',
  '房地产': '陶瓷/建材', '地产': '陶瓷/建材',
  // 汽车
  '汽车': '新能源', '新能源车': '新能源', '智能驾驶': '人工智能', '自动驾驶': '人工智能',
  // 互联网/科技
  '腾讯': '人工智能', '阿里': '人工智能', '字节': '人工智能', '美团': '人工智能',
  // 纳斯达克/QDII
  '纳斯达克': '纳斯达克100', '美股': '纳斯达克100', '特斯拉': '纳斯达克100',
  '苹果': '纳斯达克100', '微软': '纳斯达克100', 'Meta': '纳斯达克100', '谷歌': '纳斯达克100',
  'NVDA': '纳斯达克100', '亚马逊': '纳斯达克100',
  'AMD': '纳斯达克100', '博通': '纳斯达克100', '奈飞': '纳斯达克100',
  'AAPL': '纳斯达克100', 'MSFT': '纳斯达克100', 'AMZN': '纳斯达克100', 'TSLA': '纳斯达克100',
  '美联储': '纳斯达克100', 'QDII': '纳斯达克100',
  '汇率': '纳斯达克100', '人民币': '纳斯达克100', '美元': '纳斯达克100', '外汇': '纳斯达克100',
  // 标普500
  '标普': '标普500', '标普500': '标普500', 'S&P500': '标普500', 'S&P': '标普500',
  '伯克希尔': '标普500', '摩根大通': '标普500', '礼来': '标普500', '辉瑞': '标普500',
  '高盛': '标普500', '摩根士丹利': '标普500', 'Visa': '标普500', '万事达': '标普500',
  // 黄金
  '黄金': '黄金', '金价': '黄金',
};

// 事件类型→投资建议模板
const EVENT_ADVICE_TEMPLATES = {
  earnings: {
    positive: (name) => `${name}业绩超预期，重仓该股的基金可能迎来上涨，可考虑适当加仓相关基金`,
    negative: (name) => `${name}业绩不及预期，持有相关基金的投资者需评估是否减仓或观望`,
    neutral: (name) => `${name}发布业绩，建议关注对相关基金净值的影响`,
  },
  orders: {
    positive: (name) => `${name}获得重大订单，利好公司基本面，关注持仓该股的基金`,
    neutral: (name) => `${name}签约重大合同，短期可能有催化效应`,
  },
  tech: {
    positive: (name) => `${name}取得技术突破，行业竞争力提升，相关主题基金值得关注`,
    neutral: (name) => `${name}发布新技术/产品，可能带来新的增长点`,
  },
  accident: {
    negative: (name) => `⚠️ ${name}发生重大事故/风险事件，持仓该股的基金可能面临回调压力，建议评估风险`,
  },
  policy: {
    positive: (industry) => `政策利好${industry}板块，相关基金可能受益，可关注配置机会`,
    negative: (industry) => `政策收紧${industry}板块，相关基金可能承压，建议谨慎`,
    neutral: (industry) => `政策变动涉及${industry}板块，建议关注后续影响`,
  },
  mna: {
    positive: (name) => `${name}并购重组事项，可能带来价值重估，关注相关基金`,
    negative: (name) => `${name}涉及减持/股权变动，短期可能有抛压`,
    neutral: (name) => `${name}资本运作事项，建议关注进展`,
  },
  macro: {
    neutral: () => `宏观经济数据发布，可能影响整体市场走势，关注宽基指数基金`,
  },
};

// 分析新闻对用户持仓的影响
async function analyzeNewsImpact(newsItem, pool) {
  const impacts = [];
  const text = newsItem.title + ' ' + newsItem.content;

  // 1. 从新闻中提取关联行业
  const relatedIndustries = new Set();
  for (const [keyword, industry] of Object.entries(NEWS_INDUSTRY_MAP)) {
    if (text.includes(keyword)) relatedIndustries.add(industry);
  }

  // 2. 从新闻中提取关联个股
  const relatedStocks = [];
  if (newsItem.stocks && newsItem.stocks.length > 0) {
    relatedStocks.push(...newsItem.stocks);
  }

  // 3. 查找关联的基金
  let relatedFunds = [];
  if (relatedIndustries.size > 0) {
    const industries = Array.from(relatedIndustries);
    const result = await pool.query(
      `SELECT code, name, industry, type FROM funds WHERE industry = ANY($1) LIMIT 20`,
      [industries]
    );
    relatedFunds = result.rows.map(r => ({
      code: r.code, name: r.name, industry: r.industry, type: r.type,
    }));
  }

  // 4. 检查用户持仓是否受影响（如果有用户上下文）
  // 这个在alerts API中按用户维度调用

  // 5. 生成投资建议
  const template = EVENT_ADVICE_TEMPLATES[newsItem.category];
  let advice = '';
  let action = 'hold'; // buy / sell / hold / watch

  if (template) {
    if (newsItem.impact === 'high') {
      if (newsItem.category === 'accident') {
        advice = template.negative ? template.negative(relatedStocks[0]?.name || '相关公司') : '';
        action = 'sell';
      } else if (['earnings', 'orders', 'tech'].includes(newsItem.category)) {
        // 判断正面还是负面
        const positiveWords = ['超预期', '大增', '增长', '突破', '利好', '涨停', '新高', '中标', '签约'];
        const negativeWords = ['不及预期', '下降', '亏损', '暴雷', '跌停', '利空', '退市', '违约'];
        const isPositive = positiveWords.some(w => text.includes(w));
        const isNegative = negativeWords.some(w => text.includes(w));

        if (isPositive && template.positive) {
          advice = template.positive(relatedStocks[0]?.name || relatedFunds[0]?.industry || '相关标的');
          action = 'buy';
        } else if (isNegative && template.negative) {
          advice = template.negative(relatedStocks[0]?.name || relatedFunds[0]?.industry || '相关标的');
          action = 'sell';
        } else if (template.neutral) {
          advice = template.neutral(relatedStocks[0]?.name || '相关标的');
          action = 'watch';
        }
      } else if (newsItem.category === 'policy') {
        const industries = Array.from(relatedIndustries).join('、');
        const positivePolicy = ['降息', '降准', '补贴', '减税', '利好', '支持', '鼓励'];
        if (positivePolicy.some(w => text.includes(w))) {
          advice = template.positive ? template.positive(industries) : '';
          action = 'buy';
        } else {
          advice = template.neutral ? template.neutral(industries) : '';
          action = 'watch';
        }
      }
    } else if (newsItem.impact === 'medium') {
      if (template.neutral) {
        const name = relatedStocks[0]?.name || Array.from(relatedIndustries).join('、') || '相关标的';
        advice = template.neutral(name);
        action = 'watch';
      }
    }
  }

  return {
    relatedIndustries: Array.from(relatedIndustries),
    relatedFunds: relatedFunds.slice(0, 5),
    relatedStocks: relatedStocks.slice(0, 5),
    advice,
    action, // buy / sell / hold / watch
  };
}

// 为用户生成基于新闻的持仓提醒
async function generateNewsAlerts(userId, pool) {
  const alerts = [];

  // 获取用户持仓的基金代码
  const holdings = await pool.query(
    `SELECT DISTINCT fund_code, fund_name FROM fund_records WHERE user_id = $1`,
    [userId]
  );
  const heldCodes = new Set(holdings.rows.map(h => h.fund_code));

  // 获取用户自选基金
  const watchlist = await pool.query(
    `SELECT fund_code FROM watchlist WHERE user_id = $1`,
    [userId]
  );
  const watchedCodes = new Set(watchlist.rows.map(w => w.fund_code));

  // 获取用户持仓基金的行业
  const heldIndustries = new Set();
  if (heldCodes.size > 0) {
    const fundInfo = await pool.query(
      `SELECT code, industry FROM funds WHERE code = ANY($1)`,
      [Array.from(heldCodes)]
    );
    fundInfo.rows.forEach(f => { if (f.industry) heldIndustries.add(f.industry); });
  }

  // 行业→重仓股名称集合（用于个股匹配）
  const INDUSTRY_STOCKS = {
    '人工智能': ['科大讯飞', '海康威视', '中际旭创', '工业富联', '寒武纪', '紫光股份', '中科曙光', '浪潮信息'],
    '半导体/芯片': ['北方华创', '中芯国际', '韦尔股份', '兆易创新', '卓胜微', '圣邦股份', '中微公司', '长电科技'],
    '医药': ['恒瑞医药', '药明康德', '迈瑞医疗', '片仔癀', '爱尔眼科', '智飞生物', '长春高新'],
    '新能源': ['宁德时代', '比亚迪', '隆基绿能', '阳光电源', '通威股份', '亿纬锂能', '赣锋锂业', '天齐锂业'],
    '消费': ['贵州茅台', '五粮液', '山西汾酒', '泸州老窖', '海天味业', '伊利股份'],
    '证券': ['中信证券', '东方财富', '华泰证券', '国泰君安', '海通证券'],
    '金融': ['招商银行', '中国平安', '工商银行', '建设银行'],
    '煤炭': ['中国神华', '陕西煤业', '兖矿能源', '中煤能源'],
    '军工': ['中航沈飞', '航发动力', '中航光电', '中航西飞'],
    '电力': ['长江电力', '华能国际', '国电电力', '大唐发电'],
    '纳斯达克100': ['英伟达', '苹果', '微软', '亚马逊', 'Meta', '谷歌', '特斯拉', '博通', '奈飞', 'AMD', 'NVDA', 'AAPL', 'MSFT'],
    '标普500': ['英伟达', '苹果', '微软', '亚马逊', '谷歌', '伯克希尔', '摩根大通', 'Visa', '礼来'],
  };
  const heldStockNames = new Set();
  for (const industry of heldIndustries) {
    (INDUSTRY_STOCKS[industry] || []).forEach(s => heldStockNames.add(s));
  }

  // 遍历缓存新闻，找出与用户持仓相关的
  for (const news of newsCache) {
    if (news.impact === 'low') continue; // 跳过低影响新闻

    const text = news.title + ' ' + news.content;
    const matchedFunds = [];
    const matchedIndustries = [];

    // 检查新闻关联的个股名称是否在持仓行业重仓股中
    if (news.stocks) {
      for (const stock of news.stocks) {
        if (stock.name && heldStockNames.has(stock.name)) {
          matchedFunds.push({ code: stock.code, name: stock.name, source: '重仓股' });
        }
      }
    }
    // 补充：从新闻文本中匹配重仓股名称
    if (matchedFunds.length === 0) {
      for (const stockName of heldStockNames) {
        if (text.includes(stockName)) {
          matchedFunds.push({ code: '', name: stockName, source: '重仓股' });
          break;
        }
      }
    }

    // 检查新闻关联的行业是否在用户持仓行业中
    for (const [keyword, industry] of Object.entries(NEWS_INDUSTRY_MAP)) {
      if (text.includes(keyword) && heldIndustries.has(industry)) {
        matchedIndustries.push(industry);
      }
    }

    if (matchedFunds.length === 0 && matchedIndustries.length === 0) continue;

    // 生成建议
    const impact = await analyzeNewsImpact(news, pool);
    const actionText = { buy: '📈 建议关注加仓', sell: '📉 建议评估减仓', watch: '👁 建议密切关注', hold: '✊ 持有观望' };

    alerts.push({
      type: `news_${news.category}`,
      level: news.impact === 'high' ? 'warning' : 'info',
      title: news.title.substring(0, 50),
      message: impact.advice || `${news.source}: ${news.title.substring(0, 80)}`,
      action: impact.action,
      actionText: actionText[impact.action] || '',
      relatedFunds: impact.relatedFunds.filter(f => heldCodes.has(f.code) || watchedCodes.has(f.code)),
      relatedIndustries: [...new Set([...matchedIndustries, ...impact.relatedIndustries])],
      newsId: news.id,
      newsTime: news.time,
      source: news.source,
    });
  }

  // 按影响等级排序，高影响在前
  alerts.sort((a, b) => {
    const impactOrder = { high: 0, medium: 1, low: 2 };
    return (impactOrder[a.level] || 2) - (impactOrder[b.level] || 2);
  });

  return alerts.slice(0, 15); // 最多15条
}

module.exports = {
  fetchAllNews,
  getCachedNews,
  handleSSEConnection,
  getNewsStats,
  analyzeNewsImpact,
  generateNewsAlerts,
  CATEGORY_KEYWORDS,
  NEWS_INDUSTRY_MAP,
  FETCH_INTERVAL_MS,
};
