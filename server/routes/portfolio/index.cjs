const express = require('express');
const router = express.Router();

// Mount all portfolio sub-routers at root since original routes are
// at /records, /import, /dca-plans, /summary, etc. directly
router.use('/', require('./records.cjs'));
router.use('/', require('./import.cjs'));
router.use('/', require('./dca.cjs'));
router.use('/', require('./analytics.cjs'));
router.use('/', require('./insights.cjs'));
router.use('/', require('./transactions.cjs'));
router.use('/', require('./reports.cjs'));
router.use('/', require('./health-score.cjs'));
router.use('/', require('./alert-lines.cjs'));
router.use('/', require('./backtest.cjs'));
router.use('/', require('./allocation-advice.cjs'));
router.use('/asset-accounts', require('./asset-accounts.cjs'));

module.exports = router;
