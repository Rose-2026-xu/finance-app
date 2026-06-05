const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, roleMiddleware } = require('../auth');
const { broadcastEvent } = require('../sse');

// GET /api/payment-types
router.get('/', authMiddleware, (req, res) => {
  const types = db.all('SELECT * FROM payment_types ORDER BY sort_order ASC, id ASC');
  res.json(types);
});

// POST /api/payment-types
router.post('/', authMiddleware, roleMiddleware('super_admin', 'admin'), (req, res) => {
  const { name, category, sort_order } = req.body;
  if (!name) {
    return res.status(400).json({ error: '类型名称不能为空' });
  }
  if (category && !['expense', 'income', 'other'].includes(category)) {
    return res.status(400).json({ error: '无效的分类' });
  }

  // Get max sort_order
  const maxResult = db.get('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM payment_types');
  const order = sort_order !== undefined ? parseInt(sort_order) : maxResult.max_order + 1;

  db.run(
    'INSERT INTO payment_types (name, category, sort_order) VALUES (?, ?, ?)',
    [name, category || 'other', order]
  );

  const type = db.get('SELECT * FROM payment_types WHERE name = ? ORDER BY id DESC LIMIT 1', [name]);
  broadcastEvent({ type: 'payment_type_created', data: type });
  res.status(201).json(type);
});

// PUT /api/payment-types/:id
router.put('/:id', authMiddleware, roleMiddleware('super_admin', 'admin'), (req, res) => {
  const { name, category, is_active, sort_order } = req.body;
  const type = db.get('SELECT * FROM payment_types WHERE id = ?', [req.params.id]);
  if (!type) {
    return res.status(404).json({ error: '支付类型不存在' });
  }

  const updates = [];
  const params = [];

  if (name) { updates.push('name = ?'); params.push(name); }
  if (category) {
    if (!['expense', 'income', 'other'].includes(category)) {
      return res.status(400).json({ error: '无效的分类' });
    }
    updates.push('category = ?'); params.push(category);
  }
  if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(parseInt(sort_order)); }

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' });
  }

  params.push(req.params.id);
  db.run(`UPDATE payment_types SET ${updates.join(', ')} WHERE id = ?`, params);

  const updated = db.get('SELECT * FROM payment_types WHERE id = ?', [req.params.id]);
  broadcastEvent({ type: 'payment_type_updated', data: updated });
  res.json(updated);
});

// POST /api/payment-types/reorder - batch reorder
router.post('/reorder', authMiddleware, roleMiddleware('super_admin', 'admin'), (req, res) => {
  const { orders } = req.body; // [{id: 1, sort_order: 0}, {id: 2, sort_order: 1}, ...]
  if (!Array.isArray(orders)) {
    return res.status(400).json({ error: '无效的排序数据' });
  }

  for (const item of orders) {
    db.run('UPDATE payment_types SET sort_order = ? WHERE id = ?', [item.sort_order, item.id]);
  }

  broadcastEvent({ type: 'payment_type_updated', data: {} });
  res.json({ message: '排序已更新' });
});

// DELETE /api/payment-types/:id (soft delete - set is_active = 0)
router.delete('/:id', authMiddleware, roleMiddleware('super_admin', 'admin'), (req, res) => {
  const type = db.get('SELECT * FROM payment_types WHERE id = ?', [req.params.id]);
  if (!type) {
    return res.status(404).json({ error: '支付类型不存在' });
  }

  db.run('UPDATE payment_types SET is_active = 0 WHERE id = ?', [req.params.id]);
  broadcastEvent({ type: 'payment_type_updated', data: { id: parseInt(req.params.id), is_active: 0 } });
  res.json({ message: '已停用' });
});

module.exports = router;
