'use strict';

const cors = require('cors');
const helmet = require('helmet');
const express = require('express');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger.cjs');
const { createRateLimit } = require('../utils/rate-limiter.cjs');
const { incrementRequestCount, resetQpsCounter, recordApiStat } = require('../utils/metrics.cjs');

function setupCORS(app) {
  const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3003', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:8866'];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.some(o => {
        if (origin === o) return true;
        try {
          const allowedUrl = new URL(o);
          const originUrl = new URL(origin);
          if (!o.includes(':', o.indexOf('//') + 2) && allowedUrl.hostname === originUrl.hostname) return true;
        } catch {}
        return false;
      })) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    maxAge: 86400,
  }));
}

function setupSecurity(app) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }));

  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
}

function setupStaticFiles(app) {
  const distPath = path.join(__dirname, '..', '..', 'dist');
  const distPathResolved = path.resolve(distPath);
  if (!fs.existsSync(distPathResolved)) {
    logger.warn('[静态文件] dist/ 目录不存在，请先运行 npm run build');
    return;
  }
  const indexPath = path.join(distPathResolved, 'index.html');
  app.use('/web', (req, res, next) => {
    const reqPath = req.path === '/' ? '/index.html' : req.path;
    const filePath = path.join(distPathResolved, reqPath);
    if (!filePath.startsWith(distPathResolved)) return next();
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    res.sendFile(indexPath);
  });
  logger.info(`[静态文件] 已挂载 /web/ → dist/ ${distPathResolved}`);
}

function setupRateLimiting(app) {
  const generalLimiter = createRateLimit(60 * 1000, 300, 'general');
  const updateLimiter = createRateLimit(15 * 60 * 1000, 3, 'update');
  app.use('/api/', generalLimiter);
  app.use('/api/update', updateLimiter);
  return { generalLimiter, updateLimiter };
}

function setupRequestCounter(app) {
  app.use((req, res, next) => {
    incrementRequestCount();
    const startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      if (req.path.startsWith('/api/')) {
        recordApiStat(req.method, req.path, res.statusCode, duration);
      }
    });
    next();
  });
  setInterval(resetQpsCounter, 60 * 1000);
}

module.exports = { setupCORS, setupSecurity, setupStaticFiles, setupRateLimiting, setupRequestCounter };