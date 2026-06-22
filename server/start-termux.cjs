// Termux startup wrapper - patches db module to skip PostgreSQL
const Module = require('module');
const path = require('path');

// Patch require to redirect db.cjs to db-nopg.cjs
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request === './db.cjs' || request.endsWith('/db.cjs') || request.endsWith('\\db.cjs')) {
    return path.join(__dirname, 'db-nopg.cjs');
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

// Now load the real server
require('./index.cjs');
