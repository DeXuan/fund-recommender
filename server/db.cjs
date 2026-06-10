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
  max: 10,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 15000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  options: '--client_encoding=UTF8',
});

pool.on('error', (err) => {
  console.error('PostgreSQL 连接池错误:', err.message);
});

// 防止未处理的Promise rejection导致进程崩溃
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise rejection:', reason);
});

async function initDatabase(retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`,
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
      // 性能优化索引
      `CREATE INDEX IF NOT EXISTS idx_funds_industry ON funds(industry)`,
      `CREATE INDEX IF NOT EXISTS idx_sector_data_trade_date ON sector_data(trade_date DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_fund_nav_code_return_date ON fund_nav(fund_code, return_1y DESC NULLS LAST, nav_date DESC)`,
      // 持仓盈亏字段（如果不存在则添加）
      `DO $$ BEGIN
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS current_nav NUMERIC(12,6) DEFAULT 0;
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS market_value NUMERIC(15,2) DEFAULT 0;
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS pnl NUMERIC(15,2) DEFAULT 0;
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS pnl_percent NUMERIC(8,2) DEFAULT 0;
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS nav_updated_at TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$`,
      // 定投字段（如果不存在则添加）
      `DO $$ BEGIN
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS dca_enabled BOOLEAN DEFAULT false;
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS dca_amount NUMERIC(12,2);
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS dca_frequency VARCHAR(20) DEFAULT 'monthly';
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS dca_day_of_month INTEGER DEFAULT 1;
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS dca_day_of_week INTEGER DEFAULT 1;
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS dca_start_date DATE;
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS dca_end_date DATE;
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS dca_status VARCHAR(20) DEFAULT 'active';
        ALTER TABLE fund_records ADD COLUMN IF NOT EXISTS dca_last_executed DATE;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$`,
      // 基金经理字段
      `DO $$ BEGIN
        ALTER TABLE funds ADD COLUMN IF NOT EXISTS manager VARCHAR(50);
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$`,
      // 用户角色字段（admin / user）
      `DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$`,
      // 修复已有用户的 status 字段（排除正常值 active 和 disabled）
      `UPDATE users SET status = 'active' WHERE status IS NULL OR status NOT IN ('active', 'disabled')`,
      `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
      `CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)`,
      // 管理员操作审计日志
      `CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER NOT NULL REFERENCES users(id),
        admin_username VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        target_user_id INTEGER,
        target_username VARCHAR(50),
        detail TEXT DEFAULT '',
        ip_address VARCHAR(50) DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_audit_admin ON admin_audit_logs(admin_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_logs(action)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_time ON admin_audit_logs(created_at DESC)`,
      // 招商银行持仓理财产品表
      `CREATE TABLE IF NOT EXISTS cmb_products (
        product_code VARCHAR(20) PRIMARY KEY,
        product_name VARCHAR(200) NOT NULL,
        risk_level VARCHAR(20) DEFAULT '',
        product_status VARCHAR(20) DEFAULT '',
        investment_period VARCHAR(20) DEFAULT '',
        nav NUMERIC(10,4),
        nav_date DATE,
        return_1m NUMERIC(8,2),
        return_3m NUMERIC(8,2),
        return_6m NUMERIC(8,2),
        return_1y NUMERIC(8,2),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      // 确保 cmb_products 表有 investment_period 列
      `DO $$ BEGIN
        ALTER TABLE cmb_products ADD COLUMN IF NOT EXISTS investment_period VARCHAR(20) DEFAULT '';
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$`,
      // 招银理财净值表（确保存在）
      `CREATE TABLE IF NOT EXISTS cmb_zhaoyin_nav (
        id SERIAL PRIMARY KEY,
        product_code VARCHAR(20) NOT NULL,
        product_name VARCHAR(200),
        unit_nav NUMERIC(12,6),
        cumulative_nav NUMERIC(12,6),
        nav_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(product_code, nav_date)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_zhaoyin_nav_code ON cmb_zhaoyin_nav(product_code)`,
      `CREATE INDEX IF NOT EXISTS idx_zhaoyin_nav_date ON cmb_zhaoyin_nav(nav_date DESC)`,
      // 招银理财净值表年化收益率列
      `DO $$ BEGIN
        ALTER TABLE cmb_zhaoyin_nav ADD COLUMN IF NOT EXISTS return_1m_annualized NUMERIC(8,4);
        ALTER TABLE cmb_zhaoyin_nav ADD COLUMN IF NOT EXISTS return_3m_annualized NUMERIC(8,4);
        ALTER TABLE cmb_zhaoyin_nav ADD COLUMN IF NOT EXISTS return_6m_annualized NUMERIC(8,4);
        ALTER TABLE cmb_zhaoyin_nav ADD COLUMN IF NOT EXISTS return_ytd_annualized NUMERIC(8,4);
        ALTER TABLE cmb_zhaoyin_nav ADD COLUMN IF NOT EXISTS return_since_annualized NUMERIC(8,4);
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
      // 订阅套餐表
      `CREATE TABLE IF NOT EXISTS subscription_plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        duration_days INTEGER NOT NULL DEFAULT 30,
        features JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      // 订阅订单表
      `CREATE TABLE IF NOT EXISTS subscription_orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
        out_trade_no VARCHAR(64) UNIQUE NOT NULL,
        trade_no VARCHAR(64) DEFAULT '',
        amount NUMERIC(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_orders_user ON subscription_orders(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_trade_no ON subscription_orders(out_trade_no)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_status ON subscription_orders(status)`,
      // 用户订阅字段
      `DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'free';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan_id INTEGER;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$`,
      // 登录日志表
      `CREATE TABLE IF NOT EXISTS login_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username VARCHAR(50) NOT NULL,
        login_ip VARCHAR(50) DEFAULT '',
        user_agent TEXT DEFAULT '',
        browser VARCHAR(100) DEFAULT '',
        os VARCHAR(100) DEFAULT '',
        device VARCHAR(50) DEFAULT '',
        location VARCHAR(200) DEFAULT '',
        status VARCHAR(20) DEFAULT 'success',
        fail_reason TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_login_logs_time ON login_logs(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_login_logs_status ON login_logs(status)`,
      // 用户备注表（管理员对用户的备注）
      `CREATE TABLE IF NOT EXISTS user_notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        admin_id INTEGER NOT NULL REFERENCES users(id),
        admin_username VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_user_notes_user ON user_notes(user_id)`,
      // 告警规则表
      `CREATE TABLE IF NOT EXISTS alert_rules (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        metric VARCHAR(50) NOT NULL,
        operator VARCHAR(10) NOT NULL,
        threshold NUMERIC(12,2) NOT NULL,
        duration INTEGER DEFAULT 0,
        severity VARCHAR(20) DEFAULT 'warning',
        enabled BOOLEAN DEFAULT true,
        notify_channels JSONB DEFAULT '["web"]',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      // 告警历史表
      `CREATE TABLE IF NOT EXISTS alert_history (
        id SERIAL PRIMARY KEY,
        rule_id INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL,
        rule_name VARCHAR(100) NOT NULL,
        metric VARCHAR(50) NOT NULL,
        current_value NUMERIC(12,2),
        threshold NUMERIC(12,2),
        severity VARCHAR(20) DEFAULT 'warning',
        message TEXT DEFAULT '',
        status VARCHAR(20) DEFAULT 'firing',
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_alert_history_time ON alert_history(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history(status)`,
      // API 请求统计表（按小时聚合）
      `CREATE TABLE IF NOT EXISTS api_stats (
        id SERIAL PRIMARY KEY,
        hour_start TIMESTAMP NOT NULL,
        endpoint VARCHAR(200) NOT NULL,
        method VARCHAR(10) DEFAULT 'GET',
        request_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        avg_response_ms NUMERIC(10,2) DEFAULT 0,
        max_response_ms NUMERIC(10,2) DEFAULT 0,
        p95_response_ms NUMERIC(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(hour_start, endpoint, method)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_api_stats_hour ON api_stats(hour_start DESC)`,
      // 用户字段扩展：登录失败次数、锁定时间
      `DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS login_fail_count INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(50) DEFAULT '';
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$`,
      // 系统配置表
      `CREATE TABLE IF NOT EXISTS system_config (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT DEFAULT '',
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      // 系统事件表
      `CREATE TABLE IF NOT EXISTS system_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) DEFAULT 'info',
        title VARCHAR(200) NOT NULL,
        detail TEXT DEFAULT '',
        source VARCHAR(50) DEFAULT 'system',
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_system_events_time ON system_events(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type)`,
      // 种子数据：默认系统配置
      `INSERT INTO system_config (key, value, description) VALUES
        ('registration_enabled', 'true', '是否开放注册'),
        ('max_login_attempts', '5', '最大登录失败次数'),
        ('lockout_duration_minutes', '30', '账户锁定时长(分钟)'),
        ('password_min_length', '8', '密码最小长度'),
        ('session_timeout_hours', '168', '会话超时(小时)')
      ON CONFLICT (key) DO NOTHING`,
    ];

    for (const sql of createStatements) {
      try {
        await client.query(sql);
      } catch (e) {
        console.warn('建表警告:', e.message);
      }
    }

    // 种子数据：默认订阅套餐
    try {
      await client.query(`
        INSERT INTO subscription_plans (name, price, duration_days, features)
        VALUES ('月度会员', 9.90, 30, '["AI选股助手","基金深度对比","行业深度分析","批量建仓方案"]')
        ON CONFLICT DO NOTHING
      `);
    } catch (seedErr) {
      console.warn('订阅套餐种子数据警告:', seedErr.message);
    }

    console.log('PostgreSQL 数据库初始化完成');
      } finally {
        client.release();
      }
      return; // 成功则退出
    } catch (err) {
      lastError = err;
      console.error(`数据库初始化失败 (第${attempt}次):`, err.message);
      if (attempt < retries) {
        console.log(`等待3秒后重试...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  throw lastError;
}

function getPool() {
  return pool;
}

module.exports = { initDatabase, getPool };
