# 基金推荐助手

基于 React + Node.js 的公募基金分析与推荐平台，覆盖 100+ 只主流基金，支持行业分析、指数深度研究、基金对比、风险评估、定投模拟等功能。

## 功能一览

| 模块 | 路由 | 说明 |
|------|------|------|
| 首页看板 | `/web/` | 大盘行情、板块轮动、资金流向、估值温度计、每日操作建议 |
| 基金列表 | `/web/funds` | 全市场基金检索，按行业筛选、多维度排序 |
| 基金详情 | `/web/funds/:code` | 收益走势、费率明细、估值分析、重仓股、投资建议 |
| 基金对比 | `/web/compare` | 最多 5 只基金横向对比，30+ 指标，自动生成结论 |
| QDII 基金 | `/web/qdii` | 纳斯达克 100 / 标普 500 / 全部 QDII 专区 |
| 行业分析 | `/web/industry` | 7 大行业深度分析：费率对比、收益排名、综合推荐、分批建仓方案 |
| 沪深 300 | `/web/hs300` | 17 只沪深 300 基金对比、前 10 权重股基本面、投资策略 |
| 市场估值 | `/web/market` | 指数估值分位、行业推荐、分批建仓计划 |
| 风险评估 | `/web/risk-assessment` | 5 步问卷测评，输出风险类型 + 个性化资产配置方案 |
| 定投计算器 | `/web/dca-calculator` | 模拟定投收益，月度明细表 + 收益曲线图 |

## 技术栈

**前端**
- React 19 + TypeScript
- Vite 8（开发端口 5174，生产 base 路径 `/web/`）
- Ant Design 6 + @ant-design/icons
- React Router 7（basename `/web`）
- ECharts 6（图表可视化）

**后端**
- Express 5（端口 3003）
- 东方财富 API 实时获取基金净值（每 15 分钟自动更新）
- 内置 100+ 只基金静态数据

## 快速开始

```bash
# 安装依赖
npm install

# 启动后端（端口 3003）
npm run server

# 新开终端，启动前端（端口 5174）
npm run dev
```

访问 http://localhost:5174/web

## 生产构建

```bash
npm run build        # tsc 类型检查 + vite 构建 → dist/
npm run preview      # 本地预览构建产物
```

## 部署

项目支持一键部署到 Linux 服务器，详见 [DEPLOY.md](./DEPLOY.md)。

```bash
# 配置服务器信息（创建 .env.deploy）
echo 'DEPLOY_SERVER_IP=你的服务器IP' > .env.deploy

# 执行部署
chmod +x deploy.sh
./deploy.sh
```

部署后访问：`http://服务器IP:8688/web`

## 项目结构

```
fund-recommender/
├── server/
│   ├── index.cjs            # Express 后端，API 路由 + 定时更新
│   └── fund-data.cjs        # 基金静态数据（100+ 只）
├── src/
│   ├── App.tsx              # 路由配置
│   ├── main.tsx             # 入口，Ant Design 全局配置
│   ├── components/
│   │   ├── Navbar.tsx       # 响应式导航栏
│   │   └── DataStatus.tsx   # 数据更新状态栏
│   ├── pages/               # 10 个页面组件
│   ├── services/api.ts      # API 请求封装
│   ├── hooks/useApi.ts      # 通用数据请求 Hook
│   ├── utils/format.ts      # 格式化工具函数
│   └── types/index.ts       # TypeScript 类型定义
├── deploy.sh                # 一键部署脚本
├── DEPLOY.md                # 部署文档
├── vite.config.ts           # Vite 配置
└── package.json
```

## API 接口

后端运行在 3002 端口，前端通过 `/api` 代理访问。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/funds` | 基金列表（支持 industry/type/sort/order/search 参数） |
| GET | `/api/funds/:code` | 基金详情（6 位基金代码） |
| GET | `/api/funds/qdii` | QDII 基金列表 |
| GET | `/api/funds/hs300` | 沪深 300 基金列表 |
| GET | `/api/market/indices` | 市场指数估值 |
| GET | `/api/recommendations/industry` | 行业推荐 |
| GET | `/api/recommendations/batch-plans` | 分批建仓方案 |
| GET | `/api/industries` | 行业列表 |
| GET | `/api/industry-analysis/:industry` | 行业深度分析 |
| GET | `/api/hs300/analysis` | 沪深 300 深度分析 |
| POST | `/api/risk/profile` | 风险评估 |
| POST | `/api/tools/dca` | 定投计算器 |
| POST | `/api/tools/compare` | 基金对比 |
| GET | `/api/status` | 数据更新状态 |
| POST | `/api/update` | 手动触发数据更新 |

## 覆盖基金类型

ETF、ETF 联接、QDII、指数增强、LOF、债券型、混合型、货币型

覆盖行业：人工智能、半导体/芯片、纳斯达克 100、标普 500、医药、新能源、光伏、消费/白酒、军工、金融/银行、沪深 300、中证 500、创业板、科创 50、恒生科技、黄金、农业、地产、机器人 等

## 安全措施

- CORS 白名单限制
- 请求速率限制（通用 60 次/分钟，数据更新 3 次/15 分钟）
- 安全响应头（X-Content-Type-Options、X-Frame-Options、X-XSS-Protection）
- 请求体大小限制 10KB
- 输入参数校验（基金代码格式、搜索长度、数值范围）

## License

ISC
