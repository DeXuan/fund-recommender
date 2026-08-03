# 贡献指南

欢迎提交 Issue 和 Pull Request！

## 开发环境

```bash
git clone git@github.com:DeXuan/fund-recommender.git
cd fund-recommender
npm install
cp .env.example .env  # 编辑数据库配置
npm run dev            # 前端 http://localhost:8866/web
npm run server         # 后端 http://localhost:3003
```

## 提交规范

- `feat:` 新功能
- `fix:` Bug 修复
- `chore:` 工程配置/文档/重构
- `test:` 测试相关

## 测试

```bash
npm test              # 前端 + 后端全部测试
npm run test:server   # 仅后端
npx vitest run --coverage  # 前端覆盖率
```

提交前请确保所有测试通过。

## 代码规范

- 前端：ESLint + Prettier（`npm run lint`、`npm run format`）
- 后端：`node --check` 语法校验
- SQL 全部使用参数化查询（`$1, $2` 占位符）
- 新增 API 端点需在 README API 接口表中补充说明

## 安全

- 敏感配置通过 `.env` 管理，**禁止提交到仓库**
- 用户输入需在路由层校验
- 数据库操作需事务保护（涉及多表修改时）
