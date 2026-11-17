const winston = require('winston');
const path = require('path');

const logDir = path.join(__dirname, '..', '..', 'logs');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error', maxsize: 10 * 1024 * 1024, maxFiles: 5 }),
    new winston.transports.File({ filename: path.join(logDir, 'warn.log'), level: 'warn', maxsize: 10 * 1024 * 1024, maxFiles: 3 }),
    new winston.transports.File({ filename: path.join(logDir, 'combined.log'), maxsize: 10 * 1024 * 1024, maxFiles: 5 }),
    new winston.transports.Console({ format: winston.format.combine(winston.format.colorize(), winston.format.simple()) }),
  ],
});

// printf 只输出 message（第一个参数），`logger.warn('xx失败:', e.message)` 这类
// 调用的错误详情会被静默丢弃（128 处调用点，逐处改模板字符串不现实）。
// 在出口处包装常用级别，把额外参数拼回 message。
for (const level of ['error', 'warn', 'info', 'debug', 'http']) {
  const original = logger[level].bind(logger);
  logger[level] = (message, ...rest) => {
    if (!rest.length) return original(message);
    const extra = rest
      .map((r) => {
        if (typeof r === 'string') return r;
        try {
          return JSON.stringify(r);
        } catch {
          return String(r);
        }
      })
      .join(' ');
    return original(`${message} ${extra}`);
  };
}

module.exports = logger;
