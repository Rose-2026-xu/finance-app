const express = require('express');
const router = express.Router();
const db = require('../db');
const { comparePassword, generateToken, authMiddleware } = require('../auth');

// Helper
function getUserCompanyIds(userId) {
  const links = db.all('SELECT company_id FROM user_companies WHERE user_id = ?', [userId]);
  return links.map(l => l.company_id);
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const user = db.get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  if (!comparePassword(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const companyIds = getUserCompanyIds(user.id);
  const token = generateToken({ ...user, company_ids: companyIds });
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      company_id: user.company_id,
      company_ids: companyIds,
    }
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = db.get('SELECT id, username, role, company_id, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  user.company_ids = getUserCompanyIds(user.id);
  res.json(user);
});

module.exports = router;
