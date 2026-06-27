const express = require('express');
const logger = require('../utils/logger.cjs');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { getPool } = require('../db.cjs');
const fundService = require('../fund-service.cjs');
const { getClient } = require('../utils/anthropicClient.cjs');
const { buildContext } = require('../services/aiContextProvider.cjs');

// 安全的 HTML 清理：转义 HTML 实体而非简单剥离标签（防止 XSS 变体绕过）
function sanitizeHtml(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// AI 聊天专用限流：每 IP 每分钟 30 次
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'AI 请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

const JWT_SECRET = process.env.JWT_SECRET;

// 可选认证：有 token 则解析用户，无 token 则继续（不拒绝）
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = { id: decoded.id, username: decoded.username, nickname: decoded.nickname, role: decoded.role || 'user' };
    } catch (e) { logger.error('JWT token验证失败:', e.message); }
  }
  next();
}

router.use(optionalAuth);

// ======================== 共享常量 ========================

// 系统提示（流式/非流式共用）
const SYSTEM_PROMPT = `你是 FinPilot，顶级AI投资研究助手，由 Claude AI 驱动。

## 🎯 分层能力体系

### 第一层：通用问答
- 基础金融知识科普、投资术语解释、理财入门指导
- 基金类型介绍（股票型/债券型/混合型/QDII/ETF/货币基金）

### 第二层：理财专属问答
- **基金诊断**：历史业绩、最大回撤、波动率、夏普比率、基金经理能力评估
- **费率分析**：管理费、托管费、销售服务费、综合费率对比
- **估值分析**：PE/PB分位、行业估值水平、低估/高估判断

### 第三层：选股策略解读
- 宽基指数配置策略（沪深300/中证500/中证1000）
- 行业轮动策略、主题投资方向
- 定投策略、止盈策略、资产配置策略

### 第四层：记账盈亏诊断
- **持仓深度分析**：集中度、行业分布、风险敞口、仓位分析
- **盈亏诊断**：亏损原因分析、止盈时机评估、换仓建议
- **收益归因**：收益来源分解、行业贡献度、择时能力评估

### 第五层：资产优化方案
- 持仓优化建议：分散度、行业平衡、风格均衡
- 费率优化：高费率基金替换方案
- 风险调整：根据风险偏好调整配置比例

### 第六层：市场行情解读
- 大盘走势研判、板块轮动分析、资金流向解读
- 宏观经济影响、政策解读、市场情绪判断

### 第七层：风险提示
- 集中度风险预警、行业过度集中提醒
- 高估值风险提示、流动性风险评估

## ⭐ VIP 专属能力
- **定制资产配置方案**：基于用户风险偏好、投资期限、收益目标的个性化配置
- **定期投资规划**：定投金额、频率、标的推荐，止盈点设置
- **个股深度研报解读**：基金持仓股票分析、基金经理投资风格分析
- **亏损专项分析**：亏损原因诊断、解套策略、止损建议
- **月度理财复盘**：月度收益回顾、持仓变动分析、下月配置建议

## 📋 回答格式要求（必须遵守）
1. **必须使用 Markdown**，充分利用表格、列表、标题、加粗、引用块
2. **涉及数据对比时必须用表格**，包含代码、名称、关键指标
3. **分析结构清晰**：📋 摘要 → 📊 数据展示 → 📈 分析解读 → 💡 操作建议 → ⚠️ 风险提示
4. **关键数据加粗**，重要结论用引用块高亮
5. **适当使用 emoji**（📈📉💰⚠️📊✅❌🔥💡🎯📋🏆💎🔍）
6. **结尾必须包含风险提示**
7. **长分析使用分节标题**，便于阅读

## 🔧 规则
- 基于用户提供的实际数据进行分析，不要编造数据
- 如果数据不足，主动说明并建议用户补充
- 专业但易懂，适合有一定投资经验的用户
- 包含风险提示，不构成具体投资建议
- 使用中文回答`;

// 斜杠命令专属提示
const COMMAND_PROMPTS = {
  '/diagnose': `你正在执行【基金深度诊断】模式。
用户指定的基金代码：{args}
请从以下维度进行深度分析：
1. 历史业绩归因（Alpha/Beta分解）
2. 风险指标（最大回撤、波动率、夏普比率、Sortino比率）
3. 基金经理能力评估（任职年限、管理规模、投资风格）
4. 费率分析（管理费、托管费、综合费率与同类对比）
5. 持仓分析（前十大重仓、行业集中度、风格漂移）
6. 估值水平（PE/PB分位、行业比较）
7. 综合评分与投资建议
使用表格展示关键数据，结尾给出明确的诊断结论。`,

  '/portfolio': `你正在执行【持仓综合分析】模式。
请基于用户提供的实时持仓数据，进行以下分析：
1. 持仓总览（总市值、总收益、收益率）
2. 持仓集中度分析（单只基金占比、行业分布）
3. 风险敞口评估（股票/债券/混合比例、行业暴露）
4. 收益归因（哪些基金贡献最大收益/最大亏损）
5. 优化建议（分散度改善、费率优化、风格均衡）
6. 调仓建议（具体到基金代码和调整比例）
使用表格展示持仓明细，用饼图数据展示行业分布。`,

  '/market': `你正在执行【市场行情解读】模式。
用户关注的行业/指数：{args}
请提供：
1. 大盘走势研判（上证/深证/创业板最新走势）
2. 指数估值水平（PE/PB分位、历史百分位）
3. 行业轮动分析（当前热点板块、资金流向）
4. 宏观经济影响因素（政策面、资金面、情绪面）
5. 短期/中期/长期市场展望
6. 行业基金推荐（如果用户指定了行业）
使用数据表格展示关键指标。`,

  '/stockpick': `你正在执行【AI智能选股】模式。
用户目标行业/主题：{args}
请基于量化筛选逻辑：
1. 筛选该行业/主题下的所有基金
2. 按综合评分排序（收益40% + 风险30% + 费率15% + 规模15%）
3. 展示前10只基金的详细对比表（代码、名称、收益率、费率、规模、评级）
4. 推荐Top 3并说明推荐理由
5. 提供分批建仓方案（3个月分批投入）
必须使用表格对比展示。`,

  '/risk': `你正在执行【风险评估分析】模式。
请基于用户的持仓数据进行：
1. 持仓整体风险等级评估
2. 波动率分析（年化波动率、下行波动率）
3. 最大回撤风险（历史最大回撤、当前回撤水平）
4. 集中度风险（单只基金占比、行业集中度）
5. 流动性风险（基金规模、赎回限制）
6. 市场风险（Beta暴露、系统性风险敞口）
7. 风险预警（超过安全阈值的指标）
8. 风险调整建议
用红/黄/绿标识风险等级。`,

  '/dca': `你正在执行【定投方案规划】模式。
用户需求：{args}
请提供：
1. 推荐定投标的（宽基指数为主，行业为辅）
2. 定投金额建议（基于收入和风险承受能力）
3. 定投频率建议（周投/月投对比分析）
4. 定投时间选择（每月最佳定投日分析）
5. 止盈策略（目标收益率止盈 vs 估值止盈）
6. 历史回测数据（近3年/5年定投收益率）
7. 具体执行方案表（标的、金额、频率、止盈点）
使用表格展示完整方案。`,
};

// 生成会话ID（使用安全随机数）
function generateSessionId() {
  return 'chat_' + Date.now() + '_' + crypto.randomBytes(8).toString('hex');
}

// 获取用户ID（支持匿名）
function getUserId(req) {
  return req.user?.id || null;
}

// 安全的基金过滤器：处理 type 和 industry 字段可能不匹配的情况
async function getFundsByType(typeKeyword) {
  const result = await fundService.getAllFundsWithNav({ type: typeKeyword });
  const funds = result.data || result || [];
  if (funds.length === 0) {
    const searchResult = await fundService.getAllFundsWithNav({ search: typeKeyword });
    return (searchResult.data || searchResult || []);
  }
  return funds;
}

// ======================== 规则引擎兜底 ========================
async function ruleEngineFallback(msg, userId) {
  const pool = getPool();
  const lowerMsg = msg.trim().toLowerCase();
  let reply = '';
  let data = null;

  if (/推荐|有什么|哪些|什么基金/.test(lowerMsg) && /qdii|海外|美股|纳斯达克|标普|美国|日本|越南|印度/.test(lowerMsg)) {
    const funds = await getFundsByType('QDII');
    const top = funds.filter(f => (f.return1y || 0) > 0).sort((a, b) => b.return1y - a.return1y).slice(0, 10);
    data = top;
    reply = `为您找到 ${top.length} 只表现较好的QDII基金，按近1年收益排序：\n\n这些基金投资海外市场，适合分散单一市场风险。`;
  }
  else if (/推荐|有什么|哪些/.test(lowerMsg) && /沪深300|hs300/.test(lowerMsg)) {
    const result = await fundService.getAllFundsWithNav({ industry: '沪深300' });
    const funds = (result.data || result || []).sort((a, b) => (b.return1y || 0) - (a.return1y || 0)).slice(0, 10);
    data = funds;
    reply = `为您找到 ${funds.length} 只沪深300基金，按近1年收益排序：\n\n沪深300是A股核心宽基指数，适合长期配置。`;
  }
  else if (/推荐|有什么|哪些/.test(lowerMsg) && /中证500|中证1000|创业板|科创板|科创50/.test(lowerMsg)) {
    let keyword = '中证500';
    if (/中证1000/.test(lowerMsg)) keyword = '中证1000';
    else if (/创业板/.test(lowerMsg)) keyword = '创业板';
    else if (/科创板|科创50/.test(lowerMsg)) keyword = '科创板';
    const result = await fundService.getAllFundsWithNav({ search: keyword });
    const funds = (result.data || result || []).sort((a, b) => (b.return1y || 0) - (a.return1y || 0)).slice(0, 10);
    data = funds;
    reply = `为您找到 ${funds.length} 只${keyword}相关基金，按近1年收益排序：`;
  }
  else if (/费率.*低|低.*费率|便宜|省钱/.test(lowerMsg)) {
    const result = await fundService.getAllFundsWithNav({});
    const funds = (result.data || result || []).filter(f => (f.totalFee || 0) > 0 && (f.totalFee || 0) < 0.8).sort((a, b) => (a.totalFee || 0) - (b.totalFee || 0)).slice(0, 10);
    data = funds;
    reply = `为您找到 ${funds.length} 只低费率基金（综合费率<0.8%）：\n\n低费率长期能节省不少成本，适合定投。`;
  }
  else if (/收益.*高|高.*收益|赚钱|最好|涨幅|涨得好|表现好/.test(lowerMsg)) {
    const result = await fundService.getAllFundsWithNav({});
    const funds = (result.data || result || []).filter(f => (f.return1y || 0) > 0).sort((a, b) => b.return1y - a.return1y).slice(0, 10);
    data = funds;
    reply = `为您找到近1年收益最高的 ${funds.length} 只基金：\n\n提示：历史收益不代表未来表现，请结合风险指标综合判断。`;
  }
  else if (/规模.*大|大.*规模/.test(lowerMsg)) {
    const result = await fundService.getAllFundsWithNav({});
    const funds = (result.data || result || []).filter(f => (f.scale || 0) > 50).sort((a, b) => (b.scale || 0) - (a.scale || 0)).slice(0, 10);
    data = funds;
    reply = `为您找到 ${funds.length} 只大规模基金（>50亿）：\n\n大规模基金通常流动性好、运作稳定。`;
  }
  else if (/金选|精选|优选/.test(lowerMsg)) {
    const result = await fundService.getAllFundsWithNav({});
    const funds = (result.data || result || []).filter(f => f.isGoldSelected);
    data = funds;
    reply = `为您找到 ${funds.length} 只金选基金：\n\n金选基金是平台精选的优质基金，仅供参考。`;
  }
  else if (/估值|高估|低估|分位|pe|市盈率/.test(lowerMsg)) {
    const indices = await fundService.getMarketIndices();
    data = { type: 'valuation', indices };
    reply = '当前主要指数估值情况：\n\nPE分位低于30%为低估区间，高于70%为高估区间，仅供参考。';
  }
  else if (/指数|大盘|行情|市场/.test(lowerMsg) && !/基金|推荐|有哪些/.test(lowerMsg)) {
    const indices = await fundService.getMarketIndices();
    data = { type: 'indices', indices };
    reply = '当前主要指数行情：';
  }
  else if (/搜索|查找|找/.test(lowerMsg)) {
    const keywords = lowerMsg.replace(/搜索|查找|找|基金|帮我|的|了|一下|有没有/g, '').trim();
    if (keywords.length > 0) {
      const result = await fundService.getAllFundsWithNav({ search: keywords });
      const funds = (result.data || result || []).slice(0, 10);
      data = funds;
      reply = funds.length > 0
        ? `搜索"${keywords}"找到 ${funds.length} 只相关基金：`
        : `抱歉，没有找到"${keywords}"相关的基金。您可以试试：\n- 按行业搜索："搜索医药基金"\n- 按类型搜索："搜索ETF基金"\n- 按指数搜索："搜索沪深300"`;
    } else {
      reply = '请告诉我您想搜索什么，例如"搜索医药基金"或"搜索半导体"';
    }
  }
  else if (/行业|板块|赛道/.test(lowerMsg) && !/基金|推荐|有哪些|搜索/.test(lowerMsg)) {
    const result = await pool.query('SELECT DISTINCT industry FROM funds WHERE industry IS NOT NULL AND industry != \'\' ORDER BY industry');
    const industries = result.rows.map(r => r.industry);
    data = { type: 'industries', industries };
    reply = `目前系统收录了 ${industries.length} 个行业分类，点击标签可查看该行业基金：`;
  }
  else if (/债|债券|固收|稳健|保守/.test(lowerMsg) && /基金|推荐|有哪些/.test(lowerMsg)) {
    const funds = await getFundsByType('债券型');
    const top = funds.sort((a, b) => (b.return1y || 0) - (a.return1y || 0)).slice(0, 10);
    data = top.length > 0 ? top : null;
    reply = top.length > 0
      ? `为您找到 ${top.length} 只债券型基金，按近1年收益排序：\n\n债券基金风险较低，适合稳健型投资者。`
      : '暂未找到债券型基金数据，您可以尝试搜索"固收"或"稳健"相关关键词。';
  }
  else if (/etf|指数基金|被动/.test(lowerMsg)) {
    const funds = await getFundsByType('ETF');
    const top = funds.sort((a, b) => (b.return1y || 0) - (a.return1y || 0)).slice(0, 10);
    data = top.length > 0 ? top : null;
    reply = top.length > 0
      ? `为您找到 ${top.length} 只ETF基金，按近1年收益排序：\n\nETF费率低、透明度高，适合长期投资。`
      : '暂未找到ETF基金数据，您可以尝试搜索具体指数名称如"沪深300ETF"。';
  }
  else if (/混合|灵活配置|偏股|偏债/.test(lowerMsg) && /基金|推荐|有哪些/.test(lowerMsg)) {
    const funds = await getFundsByType('混合型');
    const top = funds.sort((a, b) => (b.return1y || 0) - (a.return1y || 0)).slice(0, 10);
    data = top.length > 0 ? top : null;
    reply = top.length > 0
      ? `为您找到 ${top.length} 只混合型基金，按近1年收益排序：\n\n混合基金股债灵活配置，攻守兼备。`
      : '暂未找到混合型基金数据。';
  }
  else if (/股票|主动|成长/.test(lowerMsg) && /基金|推荐|有哪些/.test(lowerMsg)) {
    const funds = await getFundsByType('股票型');
    const top = funds.sort((a, b) => (b.return1y || 0) - (a.return1y || 0)).slice(0, 10);
    data = top.length > 0 ? top : null;
    reply = top.length > 0
      ? `为您找到 ${top.length} 只股票型基金，按近1年收益排序：\n\n股票基金波动较大，适合风险承受能力较高的投资者。`
      : '暂未找到股票型基金数据。';
  }
  else if (/货币|余额宝|零钱|活期|现金/.test(lowerMsg)) {
    reply = '货币基金信息暂未收录到系统中。货币基金风险极低，适合存放短期闲置资金，典型代表有余额宝、零钱通等。';
  }
  else if (/定投|定期|长期投资/.test(lowerMsg)) {
    reply = '定投建议：\n\n1. 选择宽基指数基金（如沪深300、中证500）作为核心配置\n2. 坚持长期投资，至少3年以上\n3. 市场下跌时不要停止定投，反而是低成本买入的机会\n4. 设置止盈点，达到目标收益后可分批止盈\n5. A类基金适合长期持有，C类适合短期\n\n您可以在「理财记账」页面创建定投计划，系统会自动提醒执行。';
  }
  else if (/风险|亏损|回撤|波动/.test(lowerMsg) && /基金|投资/.test(lowerMsg)) {
    reply = '基金风险等级参考：\n\n1. 低风险：货币基金、短债基金 - 年化波动<3%\n2. 中低风险：中长期债券基金 - 年化波动3-8%\n3. 中风险：混合型基金 - 年化波动8-20%\n4. 中高风险：股票型基金 - 年化波动15-30%\n5. 高风险：行业主题基金、QDII - 年化波动>20%\n\n建议根据自身风险承受能力选择合适的基金，不要把鸡蛋放在一个篮子里。';
  }
  else if (/我的|持仓|收益|赚了|亏了|亏多少|赚多少|投了多少|本金|回本|盈亏|亏损|我的基金|基金收益|账户/.test(lowerMsg)
    && /收益|赚|亏|持仓|基金|投了|本金|回本|盈亏|账户|多少|情况|怎么样|如何/.test(lowerMsg)) {
    if (!userId) {
      reply = '请先登录后查看您的个人持仓和收益情况。\n\n登录后我可以帮您分析理财记账中的持仓数据、盈亏情况和收益表现。';
    } else {
      const noiseWords = /我|的|收益|赚了|亏了|多少|怎么样|如何|情况|持仓|基金|看看|帮我|查查|一下|吧|呢|吗|啊|想|分别|各个|各自|每|都/g;
      const cleaned = lowerMsg.replace(noiseWords, '').trim();
      const keywords = cleaned.split(/[、，,；;、\s]+/).map(s => s.trim()).filter(s => s.length >= 1);

      let nameFilterClause = '';
      let nameFilterParams = [];
      if (keywords.length > 0) {
        const conditions = keywords.map((_, i) => `fund_name ILIKE $${i + 2}`);
        nameFilterClause = ` AND (${conditions.join(' OR ')})`;
        nameFilterParams = keywords.map(k => `%${k}%`);
      }

      const holdingsQuery = `
        SELECT fund_code, fund_name,
               SUM(CASE WHEN record_type != 'sell' THEN shares ELSE 0 END) as total_shares,
               SUM(CASE WHEN record_type != 'sell' THEN shares * cost_price + buy_fee ELSE 0 END) as total_cost
        FROM fund_records
        WHERE user_id = $1${nameFilterClause}
        GROUP BY fund_code, fund_name
        HAVING SUM(CASE WHEN record_type != 'sell' THEN shares ELSE 0 END) > 0`;
      const holdingsResult = await pool.query(holdingsQuery, [userId, ...nameFilterParams]);

      const realizedQuery = `
        SELECT fund_name, SUM(realized_pnl) as realized_pnl
        FROM fund_records
        WHERE user_id = $1 AND record_type = 'sell' AND realized_pnl IS NOT NULL${nameFilterClause}
        GROUP BY fund_name`;
      const realizedResult = await pool.query(realizedQuery, [userId, ...nameFilterParams]);

      // 批量查询所有持仓的最新NAV数据（避免N+1）
      const fundCodes = holdingsResult.rows.map(h => h.fund_code);
      const navResult = await pool.query(
        `SELECT DISTINCT ON (fund_code) fund_code, current_nav, market_value, pnl, pnl_percent, nav_updated_at
         FROM fund_records WHERE user_id = $1 AND fund_code = ANY($2) AND record_type != 'sell'
         ORDER BY fund_code, updated_at DESC`, [userId, fundCodes]
      );
      const navMap = new Map(navResult.rows.map(r => [r.fund_code, r]));

      let enrichedHoldings = [];
      for (const h of holdingsResult.rows) {
        const nav = navMap.get(h.fund_code) || {};
        enrichedHoldings.push({
          fund_code: h.fund_code, fund_name: h.fund_name,
          total_shares: parseFloat(h.total_shares), total_cost: parseFloat(h.total_cost),
          market_value: parseFloat(nav.market_value || 0), pnl: parseFloat(nav.pnl || 0),
          pnl_percent: parseFloat(nav.pnl_percent || 0), current_nav: parseFloat(nav.current_nav || 0),
          nav_updated_at: nav.nav_updated_at,
        });
      }

      if (enrichedHoldings.length === 0 && realizedResult.rows.length === 0) {
        reply = keywords.length > 0
          ? `没有找到"${keywords.join('、')}"相关的持仓记录。\n\n请前往「理财记账」页面记录您的交易，之后我就能帮您分析收益了。`
          : '您还没有在「理财记账」中记录任何持仓哦。\n\n前往理财记账页面记录您的基金交易，我就能帮您分析收益情况了！';
      } else {
        enrichedHoldings.sort((a, b) => b.pnl_percent - a.pnl_percent);
        const totalCost = enrichedHoldings.reduce((s, h) => s + h.total_cost, 0);
        const totalValue = enrichedHoldings.reduce((s, h) => s + h.market_value, 0);
        const totalPnl = totalValue - totalCost;
        const totalReturn = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

        let lines = [];
        lines.push(keywords.length > 0 ? `📊 "${keywords.join('、')}" 持仓收益情况：` : '📊 您的投资收益总览：');
        lines.push('');
        lines.push(`💰 投入本金：¥${totalCost.toFixed(2)}`);
        lines.push(`📈 当前市值：¥${totalValue.toFixed(2)}`);
        lines.push(`${totalPnl >= 0 ? '🟢' : '🔴'} 浮动盈亏：${totalPnl >= 0 ? '+' : ''}¥${totalPnl.toFixed(2)}（${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%）`);
        lines.push('');
        lines.push('📋 各基金表现：');
        for (const h of enrichedHoldings.slice(0, 8)) {
          const icon = h.pnl >= 0 ? '🟢' : '🔴';
          lines.push(`${icon} ${h.fund_name}：${h.pnl >= 0 ? '+' : ''}${h.pnl.toFixed(2)}元（${h.pnl_percent >= 0 ? '+' : ''}${h.pnl_percent.toFixed(2)}%）`);
        }
        if (enrichedHoldings.length > 1) {
          const best = enrichedHoldings[0];
          const worst = enrichedHoldings[enrichedHoldings.length - 1];
          lines.push('');
          lines.push(`🏆 表现最好：${best.fund_name}（+${best.pnl_percent.toFixed(2)}%）`);
          if (best.fund_code !== worst.fund_code) {
            lines.push(`📉 表现最差：${worst.fund_name}（${worst.pnl_percent >= 0 ? '+' : ''}${worst.pnl_percent.toFixed(2)}%）`);
          }
        }
        if (realizedResult.rows.length > 0) {
          const totalRealized = realizedResult.rows.reduce((s, r) => s + parseFloat(r.realized_pnl || 0), 0);
          lines.push('');
          lines.push(`💎 已实现收益（卖出）：${totalRealized >= 0 ? '+' : ''}¥${totalRealized.toFixed(2)}`);
          for (const r of realizedResult.rows.slice(0, 3)) {
            const rpnl = parseFloat(r.realized_pnl);
            lines.push(`  · ${r.fund_name}：${rpnl >= 0 ? '+' : ''}¥${rpnl.toFixed(2)}`);
          }
        }
        lines.push('');
        lines.push('👉 前往「理财记账」查看完整持仓分析');
        reply = lines.join('\n');
        data = {
          type: 'portfolio', holdings: enrichedHoldings.slice(0, 8),
          totalCost: parseFloat(totalCost.toFixed(2)), totalValue: parseFloat(totalValue.toFixed(2)),
          totalPnl: parseFloat(totalPnl.toFixed(2)), totalReturn: parseFloat(totalReturn.toFixed(2)),
        };
      }
    }
  }
  else if (/你好|hi|hello|帮助|help|你是谁|功能|能做什么/.test(lowerMsg)) {
    reply = '您好！我是 AI 投资助手，可以帮您：\n\n' +
      '1. 我的收益 - "看看我的持仓收益"（需登录）\n' +
      '2. 基金推荐 - "推荐低费率的沪深300基金"\n' +
      '3. 收益排行 - "哪些基金收益最高？"\n' +
      '4. 估值查询 - "当前指数估值怎么样？"\n' +
      '5. 行业查询 - "有哪些行业分类？"\n' +
      '6. QDII基金 - "推荐QDII基金"\n' +
      '7. 债券基金 - "推荐债券基金"\n' +
      '8. 定投建议 - "怎么定投？"\n' +
      '9. 风险评估 - "基金风险大吗？"\n\n' +
      '直接输入您的问题即可，支持自然语言！\n\n' +
      '💡 斜杠命令：/diagnose /portfolio /market /stockpick /risk /dca';
  }
  else {
    const keywords = lowerMsg.replace(/基金|帮我|的|了|什么|哪些|推荐|找|搜索|有没有|一下|吧|呢|吗|啊|想|看看|查查/g, '').trim();
    if (keywords.length >= 2) {
      const result = await fundService.getAllFundsWithNav({ search: keywords });
      const funds = (result.data || result || []).slice(0, 10);
      if (funds.length > 0) {
        data = funds;
        reply = `为您找到 ${funds.length} 只与"${keywords}"相关的基金：`;
      } else {
        reply = `抱歉，没有找到"${keywords}"相关的基金。您可以试试：\n- 按行业搜索："推荐医药基金"\n- 按类型搜索："有哪些QDII基金？"\n- 按指标搜索："低费率基金"\n- 输入"帮助"查看完整功能列表`;
      }
    } else {
      reply = '您好！我是 AI 投资助手，请告诉我您想了解什么基金信息？\n\n' +
        '例如：\n- "推荐低费率的沪深300基金"\n- "哪些QDII基金收益好？"\n- "当前指数估值怎么样？"\n\n' +
        '输入"帮助"可查看完整功能列表。';
    }
  }

  return { reply, data };
}

// AI投资助手 - 流式聊天（SSE）
router.post('/api/ai/chat/stream', aiLimiter, async (req, res) => {
  try {
    const { message, sessionId, command, args } = req.body;
    if (!message || typeof message !== 'string' || message.length > 2000) {
      return res.status(400).json({ error: '请输入有效问题' });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI 服务未配置' });
    }

    const pool = getPool();
    const userId = getUserId(req);
    const sid = sessionId || generateSessionId();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Session-Id', sid);
    res.flushHeaders();

    const [context, historyResult] = await Promise.all([
      buildContext(message.trim(), userId, command, args),
      pool.query(`SELECT role, content FROM chat_history WHERE session_id = $1 ORDER BY id DESC LIMIT 10`, [sid]).catch(() => ({ rows: [] })),
    ]);

    const historyMessages = historyResult.rows.reverse().map(r => ({ role: r.role, content: r.content }));
    const messages = [...historyMessages, { role: 'user', content: message.trim() }];

    // 拼接系统提示：基础 + 命令专属 + 实时数据上下文
    let commandPrompt = '';
    if (command && COMMAND_PROMPTS[command]) {
      commandPrompt = '\n\n' + COMMAND_PROMPTS[command].replace('{args}', args || '');
    }
    const fullSystemPrompt = SYSTEM_PROMPT + commandPrompt + (context ? `\n\n--- 实时数据上下文 ---\n${context}` : '');

    const client = getClient();
    let fullReply = '';

    const stream = await client.messages.stream({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: fullSystemPrompt,
      messages,
    });

    stream.on('text', (text) => {
      fullReply += text;
      res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
    });

    stream.on('error', async (err) => {
      logger.warn('[AI Stream] 错误:', err.message);
      // 规则引擎兜底
      try {
        const fallback = await ruleEngineFallback(message.trim(), userId);
        if (fallback.reply) {
          res.write(`data: ${JSON.stringify({ type: 'text', content: fallback.reply })}\n\n`);
          await pool.query(
            `INSERT INTO chat_history (user_id, session_id, role, content, data) VALUES ($1, $2, 'user', $3, $4)`,
            [userId, sid, message.trim(), command ? JSON.stringify({ command, args }) : null]
          ).catch(() => {});
          await pool.query(
            `INSERT INTO chat_history (user_id, session_id, role, content, data) VALUES ($1, $2, 'assistant', $3, $4)`,
            [userId, sid, fallback.reply, fallback.data ? JSON.stringify(fallback.data) : null]
          ).catch(() => {});
        } else {
          res.write(`data: ${JSON.stringify({ type: 'error', content: 'AI 服务异常' })}\n\n`);
        }
      } catch (fallbackErr) {
        res.write(`data: ${JSON.stringify({ type: 'error', content: 'AI 服务异常' })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    });

    stream.on('end', async () => {
      fullReply = sanitizeHtml(fullReply);
      try {
        await pool.query(
          `INSERT INTO chat_history (user_id, session_id, role, content, data) VALUES ($1, $2, 'user', $3, $4)`,
          [userId, sid, message.trim(), command ? JSON.stringify({ command, args }) : null]
        );
        await pool.query(
          `INSERT INTO chat_history (user_id, session_id, role, content, data) VALUES ($1, $2, 'assistant', $3, $4)`,
          [userId, sid, fullReply, null]
        );
      } catch (e) {
        logger.warn('[AI Stream] 保存记录失败:', e.message);
      }
      res.write(`data: ${JSON.stringify({ type: 'done', sessionId: sid })}\n\n`);
      res.end();
    });

    req.on('close', () => {
      stream.abort();
    });

  } catch (error) {
    logger.error('[AI Stream] 错误:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: '处理请求失败' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', content: '服务异常' })}\n\n`);
      res.end();
    }
  }
});

// AI投资助手 - 非流式聊天（兼容旧版）
router.post('/api/ai/chat', aiLimiter, async (req, res) => {
  try {
    const { message, sessionId, command, args } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: '请输入问题' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: '问题长度不能超过2000字' });
    }

    const pool = getPool();
    const userId = getUserId(req);
    const sid = sessionId || generateSessionId();
    let reply = '';
    let data = null;

    // ========== Claude API 智能问答（优先） ==========
    let useClaude = !!process.env.ANTHROPIC_API_KEY;
    if (useClaude) {
      try {
        const client = getClient();
        const context = await buildContext(message.trim(), userId, command, args);

        let historyMessages = [];
        try {
          const historyResult = await pool.query(
            `SELECT role, content FROM chat_history WHERE session_id = $1 ORDER BY id DESC LIMIT 10`, [sid]
          );
          historyMessages = historyResult.rows.reverse().map(r => ({ role: r.role, content: r.content }));
        } catch (e) { logger.error('查询聊天历史记录失败:', e.message); }

        let commandPrompt = '';
        if (command && COMMAND_PROMPTS[command]) {
          commandPrompt = '\n\n' + COMMAND_PROMPTS[command].replace('{args}', args || '');
        }
        const fullSystemPrompt = SYSTEM_PROMPT + commandPrompt + (context ? `\n\n--- 实时数据上下文 ---\n${context}` : '');

        const messages = [...historyMessages, { role: 'user', content: message.trim() }];

        const response = await client.messages.create({
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: fullSystemPrompt,
          messages,
        });

        reply = sanitizeHtml(response.content[0].text);
      } catch (claudeErr) {
        logger.warn('[AI] Claude API 调用失败，回退到规则引擎:', claudeErr.message);
        useClaude = false;
      }
    }

    // ========== 规则引擎（Claude 不可用时的 fallback） ==========
    if (!useClaude || !reply) {
      const fallback = await ruleEngineFallback(message.trim(), userId);
      reply = fallback.reply;
      data = fallback.data;
    }

    // 保存用户消息到数据库
    try {
      await pool.query(
        `INSERT INTO chat_history (user_id, session_id, role, content, data) VALUES ($1, $2, 'user', $3, $4)`,
        [userId, sid, message.trim(), command ? JSON.stringify({ command, args }) : null]
      );
      await pool.query(
        `INSERT INTO chat_history (user_id, session_id, role, content, data) VALUES ($1, $2, 'assistant', $3, $4)`,
        [userId, sid, reply, data ? JSON.stringify(data) : null]
      );
    } catch (e) {
      logger.warn('保存聊天记录失败:', e.message);
    }

    res.json({ reply, data, sessionId: sid, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('AI助手错误:', error.message);
    res.status(500).json({ error: '处理请求失败，请稍后重试' });
  }
});

// 获取聊天历史记录（分页）
router.get('/api/ai/history', async (req, res) => {
  try {
    const pool = getPool();
    const userId = getUserId(req);
    const { sessionId, limit = 20, before } = req.query;

    let query = `SELECT id, session_id, role, content, data, created_at FROM chat_history WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (userId) {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(userId);
    } else if (sessionId) {
      query += ` AND session_id = $${paramIndex++}`;
      params.push(sessionId);
    } else {
      return res.json({ messages: [], hasMore: false });
    }

    if (before) {
      query += ` AND id < $${paramIndex++}`;
      params.push(parseInt(before));
    }

    query += ` ORDER BY id DESC LIMIT $${paramIndex++}`;
    params.push(parseInt(limit) + 1);

    const result = await pool.query(query, params);
    const messages = result.rows;
    const hasMore = messages.length > parseInt(limit);
    if (hasMore) messages.pop();

    messages.reverse();

    res.json({
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        data: m.data,
        timestamp: m.created_at,
        sessionId: m.session_id,
      })),
      hasMore,
    });
  } catch (error) {
    logger.error('获取聊天历史失败:', error.message);
    res.status(500).json({ error: '获取历史记录失败' });
  }
});

// 获取会话列表
router.get('/api/ai/sessions', async (req, res) => {
  try {
    const pool = getPool();
    const userId = getUserId(req);

    if (!userId) {
      return res.json({ sessions: [] });
    }

    const result = await pool.query(
      `SELECT session_id, MIN(created_at) as started_at, MAX(created_at) as last_message_at,
              COUNT(*) as message_count,
              (SELECT content FROM chat_history h2 WHERE h2.session_id = chat_history.session_id AND h2.role = 'user' ORDER BY h2.created_at ASC LIMIT 1) as first_message
       FROM chat_history WHERE user_id = $1 GROUP BY session_id ORDER BY MAX(created_at) DESC LIMIT 20`,
      [userId]
    );

    res.json({
      sessions: result.rows.map(r => ({
        sessionId: r.session_id,
        startedAt: r.started_at,
        lastMessageAt: r.last_message_at,
        messageCount: parseInt(r.message_count),
        firstMessage: r.first_message,
      })),
    });
  } catch (error) {
    logger.error('获取会话列表失败:', error.message);
    res.status(500).json({ error: '获取会话列表失败' });
  }
});

// 消息反馈（点赞/点踩）
router.post('/api/ai/feedback', async (req, res) => {
  try {
    const pool = getPool();
    const userId = getUserId(req);
    const { messageId, sessionId, rating } = req.body; // rating: 'up' | 'down'

    if (!messageId || !['up', 'down'].includes(rating)) {
      return res.status(400).json({ error: '参数无效' });
    }

    // 存储到 chat_history 的 data 字段中（通过更新）
    await pool.query(
      `UPDATE chat_history SET data = COALESCE(data, '{}')::jsonb || $1 WHERE id = $2`,
      [JSON.stringify({ feedback: rating }), messageId]
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('保存反馈失败:', error.message);
    res.status(500).json({ error: '保存反馈失败' });
  }
});

// 收藏消息
router.post('/api/ai/favorites', async (req, res) => {
  try {
    const pool = getPool();
    const userId = getUserId(req);
    const { messageId, sessionId, content } = req.body;

    if (!userId) return res.status(401).json({ error: '请先登录' });
    if (!messageId) return res.status(400).json({ error: '参数无效' });

    await pool.query(
      `INSERT INTO ai_favorites (user_id, message_id, session_id, content) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, message_id) DO NOTHING`,
      [userId, messageId, sessionId || '', content || '']
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('收藏失败:', error.message);
    // 如果表不存在，尝试创建
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      try {
        const pool = getPool();
        await pool.query(`CREATE TABLE IF NOT EXISTS ai_favorites (
          id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, message_id BIGINT NOT NULL,
          session_id TEXT, content TEXT, created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, message_id)
        )`);
        await pool.query(
          `INSERT INTO ai_favorites (user_id, message_id, session_id, content) VALUES ($1, $2, $3, $4)`,
          [userId, messageId, sessionId || '', content || '']
        );
        return res.json({ success: true });
      } catch (e2) {
        logger.error('创建收藏表失败:', e2.message);
      }
    }
    res.status(500).json({ error: '收藏失败' });
  }
});

// 获取收藏列表
router.get('/api/ai/favorites', async (req, res) => {
  try {
    const pool = getPool();
    const userId = getUserId(req);
    if (!userId) return res.json({ favorites: [] });

    // 先检查表是否存在
    const tableCheck = await pool.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_favorites')`
    );
    if (!tableCheck.rows[0].exists) return res.json({ favorites: [] });

    const result = await pool.query(
      `SELECT id, message_id, session_id, content, created_at FROM ai_favorites WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    res.json({ favorites: result.rows });
  } catch (error) {
    logger.error('获取收藏失败:', error.message);
    res.json({ favorites: [] });
  }
});

// 取消收藏
router.delete('/api/ai/favorites/:messageId', async (req, res) => {
  try {
    const pool = getPool();
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: '请先登录' });

    await pool.query(
      `DELETE FROM ai_favorites WHERE user_id = $1 AND message_id = $2`,
      [userId, req.params.messageId]
    );
    res.json({ success: true });
  } catch (error) {
    logger.error('取消收藏失败:', error.message);
    res.status(500).json({ error: '取消收藏失败' });
  }
});

// 清空聊天记录
router.delete('/api/ai/history', async (req, res) => {
  try {
    const pool = getPool();
    const userId = getUserId(req);
    const { sessionId } = req.query;

    if (userId) {
      await pool.query('DELETE FROM chat_history WHERE user_id = $1', [userId]);
    } else if (sessionId) {
      await pool.query('DELETE FROM chat_history WHERE session_id = $1', [sessionId]);
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('清空聊天记录失败:', error.message);
    res.status(500).json({ error: '清空失败' });
  }
});

module.exports = router;
