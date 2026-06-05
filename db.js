const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data', 'finance.db');
let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL-like behavior (sql.js is in-memory, we persist on writes)
  db.run('PRAGMA journal_mode=WAL;');
  db.run('PRAGMA foreign_keys=ON;');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'finance',
      company_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      initial_balance REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      remark TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payment_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      type_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      direction TEXT NOT NULL DEFAULT 'expense',
      description TEXT,
      payment_date TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      import_batch TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS receivables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      direction TEXT NOT NULL DEFAULT 'receivable',
      counterparty TEXT NOT NULL,
      amount REAL NOT NULL,
      settled_amount REAL DEFAULT 0,
      due_date TEXT,
      description TEXT,
      status TEXT DEFAULT 'pending',
      created_by INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_companies (
      user_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, company_id)
    )
  `);

  // Auto-migrate: add new columns to existing tables without losing data
  function addColumnIfNotExists(table, column, definition) {
    try {
      const result = db.exec(`PRAGMA table_info(${table})`);
      if (result[0]) {
        const columns = result[0].values.map(row => row[1]);
        if (!columns.includes(column)) {
          db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
          console.log(`  迁移: ${table} 表新增 ${column} 列`);
        }
      }
    } catch (err) {
      console.log(`  迁移跳过: ${table}.${column}`);
    }
  }

  addColumnIfNotExists('companies', 'remark', "TEXT DEFAULT ''");
  addColumnIfNotExists('companies', 'initial_balance', 'REAL DEFAULT 0');
  addColumnIfNotExists('payment_types', 'sort_order', 'INTEGER DEFAULT 0');

  // Seed super admin if not exists
  const userCount = db.exec("SELECT COUNT(*) FROM users WHERE username='admin'");
  if (userCount[0]?.values[0]?.[0] === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.run(
      `INSERT INTO users (username, password, role) VALUES ('admin', ?, 'super_admin')`,
      [hashedPassword]
    );
  }

  // Seed default payment types if not exists
  const typeCount = db.exec("SELECT COUNT(*) FROM payment_types");
  if (typeCount[0]?.values[0]?.[0] === 0) {
    const defaultTypes = [
      ['工资', 'expense'],
      ['房租', 'expense'],
      ['水电', 'expense'],
      ['物料采购', 'expense'],
      ['税费', 'expense'],
      ['服务收入', 'income'],
      ['其他收入', 'income'],
      ['其他支出', 'expense'],
    ];
    for (const [name, category] of defaultTypes) {
      db.run(`INSERT INTO payment_types (name, category) VALUES (?, ?)`, [name, category]);
    }
  }

  saveDatabase();
  console.log('数据库初始化完成');
  return db;
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDb() {
  return db;
}

// Helper: run a query and save
function run(query, params = []) {
  db.run(query, params);
  saveDatabase();
  return { changes: db.getRowsModified() };
}

// Helper: get all rows
function all(query, params = []) {
  const result = db.exec(query, params);
  if (!result[0]) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// Helper: get single row
function get(query, params = []) {
  const rows = all(query, params);
  return rows[0] || null;
}

module.exports = { initDatabase, getDb, saveDatabase, run, all, get };
