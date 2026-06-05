const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, roleMiddleware } = require('../auth');
const { broadcastEvent } = require('../sse');
const { recalcBalance } = require('./companies');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');

const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

// GET /api/payments
router.get('/', authMiddleware, (req, res) => {
  const { company_id, type_id, direction, date_from, date_to, page = 1, page_size = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);

  let where = ['1=1'];
  let params = [];

  // Finance role: only see their companies
  if (req.user.role === 'finance') {
    const companyIds = req.user.company_ids && req.user.company_ids.length > 0
      ? req.user.company_ids : (req.user.company_id ? [req.user.company_id] : []);
    if (companyIds.length > 0) {
      const placeholders = companyIds.map(() => '?').join(',');
      where.push(`p.company_id IN (${placeholders})`);
      params.push(...companyIds);
    }
  } else if (company_id) {
    where.push('p.company_id = ?');
    params.push(company_id);
  }

  if (type_id) { where.push('p.type_id = ?'); params.push(type_id); }
  if (direction) { where.push('p.direction = ?'); params.push(direction); }
  if (date_from) { where.push('p.payment_date >= ?'); params.push(date_from); }
  if (date_to) { where.push('p.payment_date <= ?'); params.push(date_to); }

  const whereClause = where.join(' AND ');

  // Count
  const countResult = db.get(
    `SELECT COUNT(*) as count FROM payments p WHERE ${whereClause}`,
    params
  );

  // Data with joins
  const payments = db.all(
    `SELECT p.*, c.name as company_name, pt.name as type_name, pt.category as type_category,
            u.username as created_by_name
     FROM payments p
     LEFT JOIN companies c ON p.company_id = c.id
     LEFT JOIN payment_types pt ON p.type_id = pt.id
     LEFT JOIN users u ON p.created_by = u.id
     WHERE ${whereClause}
     ORDER BY p.payment_date DESC, p.id DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(page_size), offset]
  );

  res.json({
    data: payments,
    total: countResult.count,
    page: parseInt(page),
    page_size: parseInt(page_size),
  });
});

// POST /api/payments
router.post('/', authMiddleware, roleMiddleware('super_admin', 'admin', 'finance'), (req, res) => {
  const { company_id, type_id, amount, direction, description, payment_date } = req.body;

  if (!company_id || !type_id || !amount || !direction || !payment_date) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  if (!['expense', 'income'].includes(direction)) {
    return res.status(400).json({ error: '无效的方向' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: '金额必须大于0' });
  }

  // Verify company exists
  const company = db.get('SELECT id FROM companies WHERE id = ?', [company_id]);
  if (!company) return res.status(400).json({ error: '公司不存在' });

  // Verify type exists
  const type = db.get('SELECT id FROM payment_types WHERE id = ? AND is_active = 1', [type_id]);
  if (!type) return res.status(400).json({ error: '支付类型不存在或已停用' });

  // Finance role: only add to their own companies
  const userCompanyIds = req.user.company_ids && req.user.company_ids.length > 0
    ? req.user.company_ids : (req.user.company_id ? [req.user.company_id] : []);
  if (req.user.role === 'finance' && !userCompanyIds.includes(company_id)) {
    return res.status(403).json({ error: '只能为本公司添加记录' });
  }

  db.run(
    `INSERT INTO payments (company_id, type_id, amount, direction, description, payment_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [company_id, type_id, parsedAmount, direction, description || '', payment_date, req.user.id]
  );

  recalcBalance(company_id);

  const payment = db.get('SELECT * FROM payments ORDER BY id DESC LIMIT 1');
  broadcastEvent({ type: 'payment_created', data: { company_id } });
  res.status(201).json(payment);
});

// PUT /api/payments/:id
router.put('/:id', authMiddleware, roleMiddleware('super_admin', 'admin', 'finance'), (req, res) => {
  const payment = db.get('SELECT * FROM payments WHERE id = ?', [req.params.id]);
  if (!payment) return res.status(404).json({ error: '记录不存在' });

  // Finance role: only edit their company's records
  const editCompanyIds = req.user.company_ids && req.user.company_ids.length > 0
    ? req.user.company_ids : (req.user.company_id ? [req.user.company_id] : []);
  if (req.user.role === 'finance' && !editCompanyIds.includes(payment.company_id)) {
    return res.status(403).json({ error: '无权修改此记录' });
  }

  const { company_id, type_id, amount, direction, description, payment_date } = req.body;
  const updates = [];
  const params = [];

  if (company_id) { updates.push('company_id = ?'); params.push(company_id); }
  if (type_id) { updates.push('type_id = ?'); params.push(type_id); }
  if (amount !== undefined) { updates.push('amount = ?'); params.push(parseFloat(amount)); }
  if (direction) {
    if (!['expense', 'income'].includes(direction)) return res.status(400).json({ error: '无效的方向' });
    updates.push('direction = ?'); params.push(direction);
  }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (payment_date) { updates.push('payment_date = ?'); params.push(payment_date); }

  if (updates.length === 0) return res.status(400).json({ error: '没有需要更新的字段' });

  params.push(req.params.id);
  db.run(`UPDATE payments SET ${updates.join(', ')} WHERE id = ?`, params);

  // Recalc both old and new company if changed
  recalcBalance(payment.company_id);
  if (company_id && company_id !== payment.company_id) recalcBalance(company_id);

  const updated = db.get('SELECT * FROM payments WHERE id = ?', [req.params.id]);
  broadcastEvent({ type: 'payment_updated', data: { company_id: updated.company_id } });
  res.json(updated);
});

// DELETE /api/payments/:id
router.delete('/:id', authMiddleware, roleMiddleware('super_admin', 'admin', 'finance'), (req, res) => {
  const payment = db.get('SELECT * FROM payments WHERE id = ?', [req.params.id]);
  if (!payment) return res.status(404).json({ error: '记录不存在' });

  const delCompanyIds = req.user.company_ids && req.user.company_ids.length > 0
    ? req.user.company_ids : (req.user.company_id ? [req.user.company_id] : []);
  if (req.user.role === 'finance' && !delCompanyIds.includes(payment.company_id)) {
    return res.status(403).json({ error: '无权删除此记录' });
  }

  const companyId = payment.company_id;
  db.run('DELETE FROM payments WHERE id = ?', [req.params.id]);
  recalcBalance(companyId);
  broadcastEvent({ type: 'payment_deleted', data: { company_id: companyId } });
  res.json({ message: '删除成功' });
});

// GET /api/payments/template - 下载导入模板
router.get('/template', authMiddleware, (req, res) => {
  const workbook = XLSX.utils.book_new();
  const companies = db.all('SELECT id, name FROM companies');
  const types = db.all('SELECT id, name, category FROM payment_types WHERE is_active = 1');

  // Template sheet
  const templateData = [
    ['公司名称', '支付类型', '方向(income/expense)', '金额', '日期(YYYY-MM-DD)', '描述'],
    ['示例公司', '工资', 'expense', 10000, '2026-01-15', '1月工资'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(templateData);
  // Set column widths
  ws['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, ws, '导入模板');

  // Reference sheet
  const refData = [['公司ID', '公司名称']];
  companies.forEach(c => refData.push([c.id, c.name]));
  const ws2 = XLSX.utils.aoa_to_sheet(refData);
  XLSX.utils.book_append_sheet(workbook, ws2, '公司列表');

  const typeData = [['类型ID', '类型名称', '分类']];
  types.forEach(t => typeData.push([t.id, t.name, t.category]));
  const ws3 = XLSX.utils.aoa_to_sheet(typeData);
  XLSX.utils.book_append_sheet(workbook, ws3, '支付类型');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=import_template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// POST /api/payments/import - 导入数据
router.post('/import', authMiddleware, roleMiddleware('super_admin', 'admin', 'finance'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传文件' });

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length < 2) return res.status(400).json({ error: '文件为空' });

    // Preload references
    const companies = db.all('SELECT id, name FROM companies');
    const companyMap = {};
    companies.forEach(c => { companyMap[c.name] = c.id; });

    const types = db.all('SELECT id, name FROM payment_types WHERE is_active = 1');
    const typeMap = {};
    types.forEach(t => { typeMap[t.name] = t.id; });

    const batchId = 'BATCH_' + Date.now();
    const errors = [];
    let successCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 5) {
        errors.push({ row: i + 1, error: '数据不完整' });
        continue;
      }

      const [companyName, typeName, direction, amount, date, description] = row;
      const companyId = companyMap[companyName];
      const typeId = typeMap[typeName];

      if (!companyId) { errors.push({ row: i + 1, error: `公司"${companyName}"不存在` }); continue; }
      if (!typeId) { errors.push({ row: i + 1, error: `支付类型"${typeName}"不存在或已停用` }); continue; }
      if (!['income', 'expense'].includes(direction)) { errors.push({ row: i + 1, error: `方向"${direction}"无效` }); continue; }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) { errors.push({ row: i + 1, error: '金额必须大于0' }); continue; }

      // Finance role: only import to their company
      if (req.user.role === 'finance' && !userCompanyIds.includes(companyId)) {
        errors.push({ row: i + 1, error: '只能为本公司导入数据' });
        continue;
      }

      const dateStr = typeof date === 'number'
        ? XLSX.SSF.format('YYYY-MM-DD', date)
        : String(date);

      db.run(
        `INSERT INTO payments (company_id, type_id, amount, direction, description, payment_date, created_by, import_batch)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [companyId, typeId, parsedAmount, direction, description || '', dateStr, req.user.id, batchId]
      );
      successCount++;
    }

    // Recalc balances for affected companies
    const affectedCompanies = new Set();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row && row[0] && companyMap[row[0]]) affectedCompanies.add(companyMap[row[0]]);
    }
    affectedCompanies.forEach(cid => recalcBalance(cid));

    broadcastEvent({ type: 'payments_imported', data: { companies: [...affectedCompanies] } });

    // Clean up uploaded file
    const fs = require('fs');
    fs.unlinkSync(req.file.path);

    res.json({
      success: successCount,
      errors: errors,
      batch_id: batchId,
    });
  } catch (err) {
    res.status(500).json({ error: '文件解析失败: ' + err.message });
  }
});

// POST /api/payments/undo-batch/:batchId - 撤销整批导入
router.post('/undo-batch/:batchId', authMiddleware, roleMiddleware('super_admin', 'admin'), (req, res) => {
  const { batchId } = req.params;

  const payments = db.all('SELECT DISTINCT company_id FROM payments WHERE import_batch = ?', [batchId]);
  if (payments.length === 0) {
    return res.status(404).json({ error: '批次不存在' });
  }

  db.run('DELETE FROM payments WHERE import_batch = ?', [batchId]);

  payments.forEach(p => recalcBalance(p.company_id));
  const companyIds = payments.map(p => p.company_id);
  companyIds.forEach(cid => broadcastEvent({ type: 'payments_import_undone', data: { company_id: cid } }));

  res.json({ message: '撤销成功' });
});

module.exports = router;
