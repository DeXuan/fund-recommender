const { Pool } = require('pg');

// Fail loudly if required env vars are missing
const requiredEnvVars = ['PG_HOST', 'PG_PORT', 'PG_DATABASE', 'PG_USER', 'PG_PASSWORD'];
const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
  console.error('Please set these in your .env file. See .env.example for reference.');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL 连接池错误:', err.message);
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    const createStatements = [
      // 用户表
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        nickname VARCHAR(100) DEFAULT '',
        avatar_url TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      // 第三方登录表
      `CREATE TABLE IF NOT EXISTS oauth_accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        provider VARCHAR(20) NOT NULL,
        provider_user_id VARCHAR(100) NOT NULL,
        access_token TEXT DEFAULT '',
        refresh_token TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(provider, provider_user_id)
      )`,
      // 持仓记录表（含定投功能）
      `CREATE TABLE IF NOT EXISTS fund_records (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        fund_code VARCHAR(10) NOT NULL,
        fund_name VARCHAR(200) NOT NULL,
        shares NUMERIC(15,4) NOT NULL,
        cost_price NUMERIC(12,6) NOT NULL,
        buy_date DATE NOT NULL,
        buy_fee NUMERIC(10,4) DEFAULT 0,
        notes TEXT DEFAULT '',
        -- 定投相关字段
        dca_enabled BOOLEAN DEFAULT false,
        dca_amount NUMERIC(12,2),
        dca_frequency VARCHAR(20) DEFAULT 'monthly',
        dca_day_of_month INTEGER DEFAULT 1,
        dca_day_of_week INTEGER DEFAULT 1,
        dca_start_date DATE,
        dca_end_date DATE,
        dca_status VARCHAR(20) DEFAULT 'active',
        dca_last_executed DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      // 保留dca_plans表用于兼容旧数据
      `CREATE TABLE IF NOT EXISTS dca_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        fund_code VARCHAR(10) NOT NULL,
        fund_name VARCHAR(200) NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
        day_of_month INTEGER DEFAULT 1,
        day_of_week INTEGER DEFAULT 1,
        start_date DATE NOT NULL,
        end_date DATE,
        status VARCHAR(20) DEFAULT 'active',
        last_executed DATE,
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      // 基金基本信息表
      `CREATE TABLE IF NOT EXISTS funds (
        code VARCHAR(10) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        type VARCHAR(50) NOT NULL,
        industry VARCHAR(100) NOT NULL,
        index_name VARCHAR(100),
        management_fee NUMERIC(5,2) DEFAULT 0,
        custody_fee NUMERIC(5,2) DEFAULT 0,
        service_fee NUMERIC(5,2) DEFAULT 0,
        total_fee NUMERIC(5,2) DEFAULT 0,
        scale NUMERIC(10,2) DEFAULT 0,
        rating INTEGER DEFAULT 3,
        buy_suggestion VARCHAR(50),
        valuation VARCHAR(50),
        trend VARCHAR(50),
        logic TEXT,
        is_gold_selected BOOLEAN DEFAULT false,
        daily_limit INTEGER DEFAULT 0,
        manager VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      // 基金净值历史表
      `CREATE TABLE IF NOT EXISTS fund_nav (
        id SERIAL PRIMARY KEY,
        fund_code VARCHAR(10) NOT NULL REFERENCES funds(code),
        nav NUMERIC(10,4) NOT NULL,
        total_nav NUMERIC(10,4),
        nav_date DATE NOT NULL,
        return_1w NUMERIC(8,2),
        return_1m NUMERIC(8,2),
        return_3m NUMERIC(8,2),
        return_6m NUMERIC(8,2),
        return_1y NUMERIC(8,2),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(fund_code, nav_date)
      )`,
      // 市场指数表
      `CREATE TABLE IF NOT EXISTS market_indices (
        code VARCHAR(10) PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        price NUMERIC(10,2),
        change_amount NUMERIC(10,2),
        change_percent NUMERIC(8,2),
        pe NUMERIC(8,2),
        pb NUMERIC(8,2),
        pe_percentile NUMERIC(8,2),
        pb_percentile NUMERIC(8,2),
        valuation VARCHAR(50),
        suggestion VARCHAR(100),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      // 板块轮动表
      `CREATE TABLE IF NOT EXISTS sector_data (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        change_percent NUMERIC(8,2),
        volume VARCHAR(20),
        leading_stock VARCHAR(50),
        trade_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(name, trade_date)
      )`,
      // 风险评估结果表
      `CREATE TABLE IF NOT EXISTS risk_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        age VARCHAR(20) NOT NULL,
        investment_amount VARCHAR(20) NOT NULL,
        investment_period VARCHAR(20) NOT NULL,
        risk_tolerance VARCHAR(20) NOT NULL,
        loss_tolerance VARCHAR(20) NOT NULL,
        score INTEGER NOT NULL,
        risk_type VARCHAR(20) NOT NULL,
        risk_level VARCHAR(10) NOT NULL,
        expected_return VARCHAR(20) NOT NULL,
        allocation JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_risk_profiles_user ON risk_profiles(user_id)`,
      // 索引
      // 自选基金表
      `CREATE TABLE IF NOT EXISTS watchlist (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        fund_code VARCHAR(10) NOT NULL,
        fund_name VARCHAR(200) DEFAULT '',
        group_name VARCHAR(50) DEFAULT '默认分组',
        notes TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, fund_code)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_fund_records_user ON fund_records(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_dca_plans_user ON dca_plans(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts(provider, provider_user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_fund_nav_code_date ON fund_nav(fund_code, nav_date DESC)`,
      // 持仓盈亏字段（如果不存在则添加）
      `DO $$ BEGIN
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS current_nav NUMERIC(12,6) DEFAULT 0;
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS market_value NUMERIC(15,2) DEFAULT 0;
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS pnl NUMERIC(15,2) DEFAULT 0;
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS pnl_percent NUMERIC(8,2) DEFAULT 0;
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS nav_updated_at TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$`,
      // 基金经理字段
      `DO $$ BEGIN
        ALTER TABLE funds ADD COLUMN IF NOT EXISTS manager VARCHAR(50);
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$`,
      // 沪深300基金详情表（申购费、超额收益等）
      `CREATE TABLE IF NOT EXISTS hs300_fund_details (
        fund_code VARCHAR(10) PRIMARY KEY,
        fund_name VARCHAR(200) NOT NULL,
        fund_type VARCHAR(50),
        is_enhanced BOOLEAN DEFAULT false,
        purchase_fee NUMERIC(5,2) DEFAULT 0,
        purchase_fee_original NUMERIC(5,2) DEFAULT 0,
        alpha NUMERIC(8,2) DEFAULT 0,
        management_fee NUMERIC(5,2) DEFAULT 0,
        custody_fee NUMERIC(5,2) DEFAULT 0,
        total_fee NUMERIC(5,2) DEFAULT 0,
        scale NUMERIC(10,2) DEFAULT 0,
        rating INTEGER DEFAULT 3,
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
    ];

    for (const sql of createStatements) {
      try {
        await client.query(sql);
      } catch (e) {
        console.warn('建表警告:', e.message);
      }
    }

    console.log('PostgreSQL 数据库初始化完成');
  } finally {
    client.release();
  }
}

function getPool() {
  return pool;
}

module.exports = { initDatabase, getPool };
