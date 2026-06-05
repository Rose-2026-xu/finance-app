const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { broadcastEvent, addSSEClient, removeSSEClient } = require('./sse');
const { authMiddleware } = require('./auth');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const companyRoutes = require('./routes/companies');
const paymentTypeRoutes = require('./routes/payment-types');
const paymentRoutes = require('./routes/payments');
const receivableRoutes = require('./routes/receivables');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes.router);
app.use('/api/payment-types', paymentTypeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/receivables', receivableRoutes);

// SSE endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  addSSEClient(res);
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
    } catch (err) {
      clearInterval(heartbeat);
      removeSSEClient(res);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeSSEClient(res);
  });
});

// Dashboard summary endpoint - per-company, with date filter
app.get('/api/dashboard', authMiddleware, (req, res) => {
  const { date_from, date_to, group_by } = req.query;

  let companies;
  if (req.user.role === 'finance') {
    const companyIds = req.user.company_ids && req.user.company_ids.length > 0
      ? req.user.company_ids : (req.user.company_id ? [req.user.company_id] : []);
    if (companyIds.length > 0) {
      const placeholders = companyIds.map(() => '?').join(',');
      companies = db.all(`SELECT * FROM companies WHERE id IN (${placeholders}) ORDER BY id`, companyIds);
    } else {
      companies = [];
    }
  } else {
    companies = db.all('SELECT * FROM companies ORDER BY id');
  }

  // Build date filter
  let dateFilter = '';
  let dateParams = [];
  if (date_from && date_to) {
    dateFilter = 'AND payment_date >= ? AND payment_date <= ?';
    dateParams = [date_from, date_to];
  } else if (date_from) {
    dateFilter = 'AND payment_date >= ?';
    dateParams = [date_from];
  } else if (date_to) {
    dateFilter = 'AND payment_date <= ?';
    dateParams = [date_to];
  }

  // Per-company summary
  const companySummaries = companies.map(c => {
    const incResult = db.get(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE company_id = ? AND direction = 'income' ${dateFilter}`,
      [c.id, ...dateParams]
    );
    const expResult = db.get(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE company_id = ? AND direction = 'expense' ${dateFilter}`,
      [c.id, ...dateParams]
    );
    return {
      company_id: c.id,
      company_name: c.name,
      balance: c.balance,
      remark: c.remark,
      income: incResult.total || 0,
      expense: expResult.total || 0,
      net: (incResult.total || 0) - (expResult.total || 0),
    };
  });

  // Recent payments with company filter
  let companyFilter = '';
  let companyParams = [];
  if (req.user.role === 'finance') {
    const cids = req.user.company_ids && req.user.company_ids.length > 0
      ? req.user.company_ids : (req.user.company_id ? [req.user.company_id] : []);
    if (cids.length > 0) {
      const placeholders = cids.map(() => '?').join(',');
      companyFilter = `WHERE p.company_id IN (${placeholders})`;
      companyParams = [...cids];
    }
  }

  let dateFilterJoin = '';
  if (date_from && date_to) {
    dateFilterJoin = companyFilter ? ` AND p.payment_date >= ? AND p.payment_date <= ?` : `WHERE p.payment_date >= ? AND p.payment_date <= ?`;
    companyParams.push(date_from, date_to);
  } else if (date_from) {
    dateFilterJoin = companyFilter ? ` AND p.payment_date >= ?` : `WHERE p.payment_date >= ?`;
    companyParams.push(date_from);
  } else if (date_to) {
    dateFilterJoin = companyFilter ? ` AND p.payment_date <= ?` : `WHERE p.payment_date <= ?`;
    companyParams.push(date_to);
  }

  const recentPayments = db.all(
    `SELECT p.*, c.name as company_name, pt.name as type_name
     FROM payments p
     LEFT JOIN companies c ON p.company_id = c.id
     LEFT JOIN payment_types pt ON p.type_id = pt.id
     ${companyFilter}${dateFilterJoin}
     ORDER BY p.payment_date DESC, p.id DESC
     LIMIT 50`,
    companyParams
  );

  // Receivables summary per company
  const receivableSummaries = companies.map(c => {
    const recResult = db.get(
      `SELECT COALESCE(SUM(amount - settled_amount), 0) as total FROM receivables WHERE company_id = ? AND direction = 'receivable' AND status != 'settled'`,
      [c.id]
    );
    const payResult = db.get(
      `SELECT COALESCE(SUM(amount - settled_amount), 0) as total FROM receivables WHERE company_id = ? AND direction = 'payable' AND status != 'settled'`,
      [c.id]
    );
    return {
      company_id: c.id,
      receivable_unsettled: recResult.total || 0,
      payable_unsettled: payResult.total || 0,
    };
  });

  res.json({
    companies: companySummaries,
    recent_payments: recentPayments,
    receivables: receivableSummaries,
  });
});

// Serve static frontend files (production)
// Disable cache for index.html so updates take effect immediately
app.use(express.static(path.join(__dirname, 'client', 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
  }
});

// Initialize database and start server
async function start() {
  await db.initDatabase();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`财务管理应用已启动:`);
    console.log(`  本机访问: http://localhost:${PORT}`);
    console.log(`  局域网访问: http://192.168.20.99:${PORT}`);
    console.log(`默认超管账号: admin / admin123`);
  });
}

start();

module.exports = { broadcastEvent };
