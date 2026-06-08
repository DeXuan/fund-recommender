const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getPool } = require('./db.cjs');
const { encrypt: encryptToken, decrypt: decryptToken } = require('./utils/crypto.cjs');
const { getOAuthToken, getUserInfo, isAlipayConfigured } = require('./utils/alipay.cjs');

const router = express.Router();

// Fail loudly if JWT_SECRET is not set or is the default template value
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'change-me-to-a-random-string-at-least-32-chars' || JWT_SECRET.length < 32) {
  console.error('[FATAL] JWT_SECRET is not set, is the template value, or is too short (<32 chars).');
  console.error('Generate a secure secret: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
  process.exit(1);
}

// Rate limiting for auth endpoints (with TTL cleanup)
const authRateLimitMap = new Map();
function authRateLimit(windowMs, max) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const record = authRateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };
    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }
    record.count++;
    authRateLimitMap.set(ip, record);
    if (record.count > max) {
      return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    }
    next();
  };
}

// Evict stale auth rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of authRateLimitMap) {
    if (now > record.resetTime + 60000) {
      authRateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

const strictLimit = authRateLimit(60 * 1000, 10);

// JWT middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, username: decoded.username, nickname: decoded.nickname };
    next();
  } catch (e) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

// POST /api/auth/register
router.post('/register', strictLimit, async (req, res) => {
  try {
    const { username, password, nickname } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: '用户名长度为3-20个字符' });
    }
    if (!/^[a-zA-Z0-9_一-龥]+$/.test(username)) {
      return res.status(400).json({ error: '用户名只能包含字母、数字、下划线和中文' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: '密码长度不能少于8个字符' });
    }

    const pool = getPool();
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const displayName = nickname || username;

    const result = await pool.query(
      'INSERT INTO users (username, password_hash, nickname) VALUES ($1, $2, $3) RETURNING id',
      [username, passwordHash, displayName]
    );
    const userId = result.rows[0].id;

    const token = jwt.sign(
      { id: userId, username, nickname: displayName },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: userId, username, nickname: displayName } });
  } catch (error) {
    console.error('注册失败:', error.message);
    res.status(500).json({ error: '注册失败' });
  }
});

// POST /api/auth/login
router.post('/login', strictLimit, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const pool = getPool();
    const result = await pool.query(
      'SELECT id, username, password_hash, nickname, avatar_url FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: '用户名或密码错误' });
    }

    const { id, username: uname, password_hash: hash, nickname, avatar_url: avatarUrl } = result.rows[0];
    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      return res.status(400).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { id, username: uname, nickname },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id, username: uname, nickname, avatar_url: avatarUrl || '' },
    });
  } catch (error) {
    console.error('登录失败:', error.message);
    res.status(500).json({ error: '登录失败' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, username, nickname, avatar_url, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = result.rows[0];

    const oauthResult = await pool.query(
      'SELECT provider, created_at FROM oauth_accounts WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      user: { id: user.id, username: user.username, nickname: user.nickname, avatar_url: user.avatar_url || '', created_at: user.created_at },
      oauthAccounts: oauthResult.rows,
    });
  } catch (error) {
    console.error('获取用户信息失败:', error.message);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, strictLimit, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '旧密码和新密码不能为空' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: '新密码长度不能少于8个字符' });
    }

    const pool = getPool();
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const valid = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
    if (!valid) {
      return res.status(400).json({ error: '旧密码错误' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user.id]);

    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码失败:', error.message);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// GET /api/auth/alipay/qrcode
router.get('/alipay/qrcode', (req, res) => {
  const appId = process.env.ALIPAY_APP_ID;
  // 开发环境：启用模拟登录时直接返回 mock 模式
  if (process.env.ENABLE_MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    return res.json({ mock: true });
  }
  if (!appId) {
    return res.status(503).json({ error: '支付宝登录暂未配置，请联系管理员', mock: true });
  }

  // 使用后端回调地址（优先从环境变量读取）
  const returnUrl = process.env.ALIPAY_RETURN_URL || 'http://47.116.77.67:8688/api/auth/alipay/callback';
  // Use cryptographically secure random for OAuth state parameter
  const state = crypto.randomBytes(16).toString('hex');

  // Sign the state with HMAC to prevent CSRF (full 256-bit signature)
  const stateSignature = crypto.createHmac('sha256', JWT_SECRET).update(state).digest('hex');
  const signedState = `${state}.${stateSignature}`;

  const url = `https://openauth.alipay.com/oauth2/publicAppAuthorize.htm?app_id=${appId}&scope=auth_user&redirect_uri=${encodeURIComponent(returnUrl)}&state=${signedState}`;

  res.json({ url, state: signedState, mock: false });
});

// POST /api/auth/alipay/mock-login — 模拟支付宝登录（仅开发环境，需显式启用）
router.post('/alipay/mock-login', strictLimit, async (req, res) => {
  if (process.env.ENABLE_MOCK_AUTH !== 'true' || process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    const pool = getPool();
    const mockUserId = 'mock_alipay_001';
    const nickname = '支付宝演示用户';
    const avatarUrl = '';

    const existing = await pool.query(
      'SELECT u.id, u.username, u.nickname FROM oauth_accounts oa JOIN users u ON oa.user_id = u.id WHERE oa.provider = $1 AND oa.provider_user_id = $2',
      ['alipay', mockUserId]
    );

    let userId, username;

    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      username = existing.rows[0].username;
    } else {
      username = 'alipay_demo_user';
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      const userResult = await pool.query(
        'INSERT INTO users (username, password_hash, nickname, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id',
        [username, passwordHash, nickname, avatarUrl]
      );
      userId = userResult.rows[0].id;
      await pool.query(
        'INSERT INTO oauth_accounts (user_id, provider, provider_user_id, access_token) VALUES ($1, $2, $3, $4)',
        [userId, 'alipay', mockUserId, encryptToken('mock_token')]
      );
    }

    const token = jwt.sign(
      { id: userId, username, nickname },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: userId, username, nickname, avatar_url: avatarUrl },
      mock: true,
    });
  } catch (error) {
    console.error('模拟登录失败:', error.message);
    res.status(500).json({ error: '模拟登录失败' });
  }
});

// Pending auth results store (state -> { token, user, createdAt })
const pendingAuth = new Map();

// Evict stale pending auth entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingAuth) {
    if (now - data.createdAt > 5 * 60 * 1000) {
      pendingAuth.delete(state);
    }
  }
}, 5 * 60 * 1000);

// GET /api/auth/alipay/callback
router.get('/alipay/callback', async (req, res) => {
  try {
    const { auth_code, state } = req.query;
    if (!auth_code || typeof auth_code !== 'string' || auth_code.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(auth_code)) {
      return res.status(400).send('<h1>缺少授权码</h1>');
    }

    // Validate OAuth state parameter (CSRF protection)
    if (!state || typeof state !== 'string' || !state.includes('.')) {
      return res.status(400).send('<h1>无效的state参数</h1>');
    }
    const lastDot = state.lastIndexOf('.');
    const stateValue = state.slice(0, lastDot);
    const stateSig = state.slice(lastDot + 1);
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(stateValue).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(stateSig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      return res.status(400).send('<h1>state参数验证失败</h1>');
    }

    if (!isAlipayConfigured()) {
      return res.status(503).send('<h1>支付宝登录暂未配置</h1>');
    }

    const tokenData = await getOAuthToken(auth_code);
    const { access_token, user_id } = tokenData.alipay_system_oauth_token_response || {};
    if (!access_token || !user_id) {
      return res.status(400).send('<h1>获取支付宝token失败</h1>');
    }

    const pool = getPool();

    const existing = await pool.query(
      'SELECT u.id, u.username, u.nickname, u.avatar_url FROM oauth_accounts oa JOIN users u ON oa.user_id = u.id WHERE oa.provider = $1 AND oa.provider_user_id = $2',
      ['alipay', user_id]
    );

    let userId, username, nickname, avatarUrl;

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      userId = row.id; username = row.username; nickname = row.nickname; avatarUrl = row.avatar_url;
      await pool.query('UPDATE oauth_accounts SET access_token = $1 WHERE provider = $2 AND provider_user_id = $3',
        [encryptToken(access_token), 'alipay', user_id]);
    } else {
      try {
        const userInfoRes = await getUserInfo(access_token);
        const userInfo = userInfoRes.alipay_user_info_share_response || {};
        nickname = userInfo.nick_name || `支付宝用户${user_id.slice(-4)}`;
        avatarUrl = userInfo.avatar || '';
      } catch {
        nickname = `支付宝用户${user_id.slice(-4)}`;
        avatarUrl = '';
      }

      username = `alipay_${user_id}`;
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      const userResult = await pool.query(
        'INSERT INTO users (username, password_hash, nickname, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id',
        [username, passwordHash, nickname, avatarUrl]
      );
      userId = userResult.rows[0].id;
      await pool.query(
        'INSERT INTO oauth_accounts (user_id, provider, provider_user_id, access_token) VALUES ($1, $2, $3, $4)',
        [userId, 'alipay', user_id, encryptToken(access_token)]
      );
    }

    const token = jwt.sign({ id: userId, username, nickname }, JWT_SECRET, { expiresIn: '7d' });

    // Store the result so the PC frontend can poll for it
    pendingAuth.set(state, {
      token,
      user: { id: userId, username, nickname, avatar_url: avatarUrl || '' },
      createdAt: Date.now(),
    });

    // Return a simple success page for the phone browser
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登录成功</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; }
    .box { text-align: center; padding: 32px; }
    .icon { font-size: 64px; } h1 { margin: 16px 0 8px; } p { opacity: 0.8; }
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">✅</div>
    <h1>授权成功</h1>
    <p>请返回电脑端查看登录状态</p>
  </div>
</body>
</html>`);
  } catch (error) {
    console.error('支付宝登录失败:', error.message);
    res.status(500).send('<h1>支付宝登录失败</h1>');
  }
});

// GET /api/auth/alipay/check?state=xxx — PC frontend polls this to check if auth completed
router.get('/alipay/check', (req, res) => {
  const { state } = req.query;
  if (!state || typeof state !== 'string' || state.length > 200 || !/^[a-zA-Z0-9_.]+$/.test(state)) {
    return res.status(400).json({ error: '无效的state参数' });
  }

  const result = pendingAuth.get(state);
  if (!result) {
    return res.json({ status: 'pending' });
  }

  // Remove the result after retrieval (one-time use)
  pendingAuth.delete(state);
  res.json({ status: 'success', token: result.token, user: result.user });
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
