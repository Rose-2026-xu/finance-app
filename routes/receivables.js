const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, roleMiddleware } = require('../auth');
const { broadcastEvent } = require('../sse');

// GET /api/receivables
router.get('/', authMiddleware, (req, res) => {
  const { company_id, direction, status } = req.query;
  let where = ['1=1'];
  let params = [];

  if (req.user.role === 'finance') {
    const cids = req.user.company_ids && req.user.company_ids.length > 0
      ? req.user.company_ids : (req.user.company_id ? [req.user.company_id] : []);
    if (cids.length > 0) {
      const placeholders = cids.map(() => '?').join(',');
      where.push(`r.company_id IN (${placeholders})`);
      params.push(...cids);
    }
  } else if (company_id) {
    where.push('r.company_id = ?');
    params.push(company_id);
  }

  if (direction) { where.push('r.direction = ?'); params.push(direction); }
  if (status) { where.push('r.status = ?'); params.push(status); }

  const whereClause = where.join(' AND ');
  const items = db.all(
    `SELECT r.*, c.name as company_name, u.username as created_by_name
     FROM receivables r
     LEFT JOIN companies c ON r.company_id = c.id
     LEFT JOIN users u ON r.created_by = u.id
     WHERE ${whereClause}
     ORDER BY r.due_date ASC, r.id DESC`,
    params
  );
  res.json(items);
});

// POST /api/receivables
router.post('/', authMiddleware, roleMiddleware('super_admin', 'admin', 'finance'), (req, res) => {
  const { company_id, direction, counterparty, amount, due_date, description, status, settled_amount } = req.body;

  if (!company_id || !direction || !counterparty || !amount) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  if (!['receivable', 'payable'].includes(direction)) {
    return res.status(400).json({ error: '方向无效，应为 receivable 或 payable' });
  }

  const validStatus = ['pending', 'partial', 'settled'].includes(status) ? status : 'pending';
  const settledAmount = settled_amount !== undefined ? parseFloat(settled_amount) : 0;

  const userCids = req.user.company_ids && req.user.company_ids.length > 0
    ? req.user.company_ids : (req.user.company_id ? [req.user.company_id] : []);
  if (req.user.role === 'finance' && !userCids.includes(company_id)) {
    return res.status(403).json({ error: '只能为本公司添加记录' });
  }

  db.run(
    `INSERT INTO receivables (company_id, direction, counterparty, amount, settled_amount, due_date, description, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [company_id, direction, counterparty, parseFloat(amount), settledAmount, due_date || null, description || '', validStatus, req.user.id]
  );

  const item = db.get('SELECT * FROM receivables ORDER BY id DESC LIMIT 1');
  broadcastEvent({ type: 'receivable_created', data: { company_id } });
  res.status(201).json(item);
});

// PUT /api/receivables/:id
router.put('/:id', authMiddleware, roleMiddleware('super_admin', 'admin', 'finance'), (req, res) => {
  const item = db.get('SELECT * FROM receivables WHERE id = ?', [req.params.id]);
  if (!item) return res.status(404).json({ error: '记录不存在' });

  if (req.user.role === 'finance' && !userCids.includes(item.company_id)) {
    return res.status(403).json({ error: '无权修改此记录' });
  }

  const { counterparty, amount, settled_amount, due_date, description, status } = req.body;
  const updates = [];
  const params = [];

  if (counterparty) { updates.push('counterparty = ?'); params.push(counterparty); }
  if (amount !== undefined) { updates.push('amount = ?'); params.push(parseFloat(amount)); }
  if (settled_amount !== undefined) { updates.push('settled_amount = ?'); params.push(parseFloat(settled_amount)); }
  if (due_date !== undefined) { updates.push('due_date = ?'); params.push(due_date); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (status) {
    if (!['pending', 'partial', 'settled'].includes(status)) return res.status(400).json({ error: '无效状态' });
    updates.push('status = ?'); params.push(status);
  }

  if (updates.length === 0) return res.status(400).json({ error: '没有需要更新的字段' });

  params.push(req.params.id);
  db.run(`UPDATE receivables SET ${updates.join(', ')} WHERE id = ?`, params);

  const updated = db.get('SELECT * FROM receivables WHERE id = ?', [req.params.id]);
  broadcastEvent({ type: 'receivable_updated', data: { company_id: updated.company_id } });
  res.json(updated);
});

// DELETE /api/receivables/:id
router.delete('/:id', authMiddleware, roleMiddleware('super_admin', 'admin'), (req, res) => {
  const item = db.get('SELECT * FROM receivables WHERE id = ?', [req.params.id]);
  if (!item) return res.status(404).json({ error: '记录不存在' });

  db.run('DELETE FROM receivables WHERE id = ?', [req.params.id]);
  broadcastEvent({ type: 'receivable_deleted', data: { company_id: item.company_id } });
  res.json({ message: '删除成功' });
});

module.exports = router;
