const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, roleMiddleware } = require('../auth');
const { broadcastEvent } = require('../sse');

// Recalculate company balance
function recalcBalance(companyId) {
  const company = db.get('SELECT initial_balance FROM companies WHERE id = ?', [companyId]);
  if (!company) return;

  const incomeResult = db.get(
    "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE company_id = ? AND direction = 'income'",
    [companyId]
  );
  const expenseResult = db.get(
    "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE company_id = ? AND direction = 'expense'",
    [companyId]
  );

  const balance = company.initial_balance + (incomeResult.total || 0) - (expenseResult.total || 0);
  db.run('UPDATE companies SET balance = ? WHERE id = ?', [balance, companyId]);
  return balance;
}

// GET /api/companies
router.get('/', authMiddleware, (req, res) => {
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
  res.json(companies);
});

// POST /api/companies
router.post('/', authMiddleware, roleMiddleware('super_admin', 'admin'), (req, res) => {
  const { name, initial_balance, remark } = req.body;
  if (!name) {
    return res.status(400).json({ error: '公司名称不能为空' });
  }

  const existing = db.get('SELECT id FROM companies WHERE name = ?', [name]);
  if (existing) {
    return res.status(400).json({ error: '公司名称已存在' });
  }

  const balance = parseFloat(initial_balance) || 0;
  const remarkText = remark || '';
  db.run(
    'INSERT INTO companies (name, initial_balance, balance, remark) VALUES (?, ?, ?, ?)',
    [name, balance, balance, remarkText]
  );

  const company = db.get('SELECT * FROM companies WHERE name = ?', [name]);
  broadcastEvent({ type: 'company_created', data: company });
  res.status(201).json(company);
});

// PUT /api/companies/:id
router.put('/:id', authMiddleware, roleMiddleware('super_admin', 'admin'), (req, res) => {
  const { name, initial_balance, remark } = req.body;
  const company = db.get('SELECT * FROM companies WHERE id = ?', [req.params.id]);
  if (!company) {
    return res.status(404).json({ error: '公司不存在' });
  }

  if (name) {
    const dup = db.get('SELECT id FROM companies WHERE name = ? AND id != ?', [name, req.params.id]);
    if (dup) return res.status(400).json({ error: '公司名称已存在' });
  }

  const newName = name || company.name;
  const newInitialBalance = initial_balance !== undefined ? parseFloat(initial_balance) : company.initial_balance;
  const newRemark = remark !== undefined ? remark : company.remark;

  db.run('UPDATE companies SET name = ?, initial_balance = ?, remark = ? WHERE id = ?', [newName, newInitialBalance, newRemark, req.params.id]);
  recalcBalance(req.params.id);

  const updated = db.get('SELECT * FROM companies WHERE id = ?', [req.params.id]);
  broadcastEvent({ type: 'company_updated', data: updated });
  res.json(updated);
});

// DELETE /api/companies/:id
router.delete('/:id', authMiddleware, roleMiddleware('super_admin'), (req, res) => {
  const company = db.get('SELECT * FROM companies WHERE id = ?', [req.params.id]);
  if (!company) {
    return res.status(404).json({ error: '公司不存在' });
  }

  // Check for related payments
  const paymentCount = db.get('SELECT COUNT(*) as count FROM payments WHERE company_id = ?', [req.params.id]);
  if (paymentCount.count > 0) {
    return res.status(400).json({ error: '该公司存在支付记录，无法删除' });
  }

  db.run('DELETE FROM companies WHERE id = ?', [req.params.id]);
  broadcastEvent({ type: 'company_deleted', data: { id: parseInt(req.params.id) } });
  res.json({ message: '删除成功' });
});

module.exports = { router, recalcBalance };
