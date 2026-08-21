'use strict';

// 轻 logger mock，避免测试产生日志文件副作用
module.exports = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  verbose: () => {},
  silly: () => {},
};
