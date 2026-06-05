const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, roleMiddleware, hashPassword } = require('../auth');

// Helper: get company list for a user
function getUserCompanies(userId) {
  const links = db.all('SELECT company_id FROM user_companies WHERE user_id = ?', [userId]);
  const companies = links.map(l => {
    const c = db.get('SELECT id, name FROM companies WHERE id = ?', [l.company_id]);
    return c ? { id: c.id, name: c.name } : null;
  }).filter(Boolean);
  return companies;
}

// GET /api/users - 用户列表
router.get('/', authMiddleware, roleMiddleware('super_admin'), (req, res) => {
  const users = db.all('SELECT id, username, role, company_id, created_at FROM users ORDER BY id');
  const result = users.map(u => {
    u.companies = getUserCompanies(u.id);
    // Keep backward compat: company_name from first linked company
    if (u.companies.length > 0) {
      u.company_names = u.companies.map(c => c.name).join('、');
    }
    if (u.company_id) {
      const company = db.get('SELECT name FROM companies WHERE id = ?', [u.company_id]);
      u.company_name = company ? company.name : null;
    }
    return u;
  });
  res.json(result);
});

// POST /api/users - 创建用户
router.post('/', authMiddleware, roleMiddleware('super_admin'), (req, res) => {
  const { username, password, role, company_ids } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (!['super_admin', 'admin', 'finance'].includes(role)) {
    return res.status(400).json({ error: '无效的角色' });
  }

  const existing = db.get('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    return res.status(400).json({ error: '用户名已存在' });
  }

  const hashedPassword = hashPassword(password);
  try {
    db.run(
      'INSERT INTO users (username, password, role, company_id) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, role, null]
    );
    const user = db.get('SELECT id, username, role, created_at FROM users WHERE username = ?', [username]);

    // Link companies
    if (Array.isArray(company_ids) && company_ids.length > 0) {
      for (const cid of company_ids) {
        db.run('INSERT OR IGNORE INTO user_companies (user_id, company_id) VALUES (?, ?)', [user.id, cid]);
      }
      // Set primary company_id to first one for backward compat
      db.run('UPDATE users SET company_id = ? WHERE id = ?', [company_ids[0], user.id]);
    }

    user.companies = getUserCompanies(user.id);
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: '创建用户失败' });
  }
});

// PUT /api/users/:id - 编辑用户
router.put('/:id', authMiddleware, roleMiddleware('super_admin'), (req, res) => {
  const { username, password, role, company_ids } = req.body;
  const user = db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const updates = [];
  const params = [];

  if (username) { updates.push('username = ?'); params.push(username); }
  if (password) { updates.push('password = ?'); params.push(hashPassword(password)); }
  if (role) {
    if (!['super_admin', 'admin', 'finance'].includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }
    updates.push('role = ?'); params.push(role);
  }

  if (updates.length > 0) {
    params.push(req.params.id);
    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  // Update company links
  if (Array.isArray(company_ids)) {
    db.run('DELETE FROM user_companies WHERE user_id = ?', [req.params.id]);
    for (const cid of company_ids) {
      db.run('INSERT OR IGNORE INTO user_companies (user_id, company_id) VALUES (?, ?)', [parseInt(req.params.id), cid]);
    }
    // Set primary company_id
    if (company_ids.length > 0) {
      db.run('UPDATE users SET company_id = ? WHERE id = ?', [company_ids[0], req.params.id]);
    } else {
      db.run('UPDATE users SET company_id = NULL WHERE id = ?', [req.params.id]);
    }
  }

  const updated = db.get('SELECT id, username, role, company_id, created_at FROM users WHERE id = ?', [req.params.id]);
  updated.companies = getUserCompanies(updated.id);
  res.json(updated);
});

// DELETE /api/users/:id - 删除用户
router.delete('/:id', authMiddleware, roleMiddleware('super_admin'), (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: '不能删除自己' });
  }
  const user = db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  db.run('DELETE FROM user_companies WHERE user_id = ?', [req.params.id]);
  db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ message: '删除成功' });
});

module.exports = router;
