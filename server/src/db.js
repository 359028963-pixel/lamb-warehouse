import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATABASE_DIR
  ? process.env.DATABASE_DIR
  : path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DATABASE_PATH
  ? process.env.DATABASE_PATH
  : path.join(dataDir, 'warehouse.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('in','out')),
    kilograms REAL NOT NULL CHECK(kilograms > 0),
    note TEXT,
    moved_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    created_by INTEGER REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_movements_moved_at ON movements(moved_at);
  CREATE INDEX IF NOT EXISTS idx_movements_type ON movements(type);
`);

function seedAdmin() {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existing) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
    ).run('admin', hash, 'admin');
    console.log('[db] 已创建默认超级管理员: admin / admin123');
  }
}

seedAdmin();

export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function getUserById(id) {
  return db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(id);
}

export function getStock() {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type='in' THEN kilograms ELSE 0 END), 0) AS inbound,
      COALESCE(SUM(CASE WHEN type='out' THEN kilograms ELSE 0 END), 0) AS outbound
    FROM movements
  `).get();
  return {
    inbound: round2(row.inbound),
    outbound: round2(row.outbound),
    stock: round2(row.inbound - row.outbound),
  };
}

export function addMovement({ type, kilograms, note, moved_at, created_by }) {
  const kg = Number(kilograms);
  if (!Number.isFinite(kg) || kg <= 0) {
    throw Object.assign(new Error('公斤数必须大于 0'), { status: 400 });
  }
  if (!['in', 'out'].includes(type)) {
    throw Object.assign(new Error('类型无效'), { status: 400 });
  }
  const date = (moved_at || todayStr()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw Object.assign(new Error('日期格式无效'), { status: 400 });
  }

  if (type === 'out') {
    const { stock } = getStock();
    if (kg > stock + 1e-9) {
      throw Object.assign(
        new Error(`库存不足：当前 ${stock} kg，无法出库 ${kg} kg`),
        { status: 400 }
      );
    }
  }

  const info = db.prepare(`
    INSERT INTO movements (type, kilograms, note, moved_at, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(type, kg, note || null, date, created_by || null);

  return getMovementById(info.lastInsertRowid);
}

export function getMovementById(id) {
  return db.prepare('SELECT * FROM movements WHERE id = ?').get(id);
}

export function listMovementsByDate(date) {
  return db.prepare(`
    SELECT * FROM movements WHERE moved_at = ? ORDER BY id DESC
  `).all(date);
}

export function deleteMovement(id) {
  const row = getMovementById(id);
  if (!row) {
    throw Object.assign(new Error('记录不存在'), { status: 404 });
  }
  if (row.type === 'in') {
    const { stock } = getStock();
    if (stock - row.kilograms < -1e-9) {
      throw Object.assign(
        new Error('删除该入库记录会导致库存为负，无法删除'),
        { status: 400 }
      );
    }
  }
  db.prepare('DELETE FROM movements WHERE id = ?').run(id);
  return true;
}

export function statsToday(date = todayStr()) {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type='in' THEN kilograms ELSE 0 END), 0) AS inbound,
      COALESCE(SUM(CASE WHEN type='out' THEN kilograms ELSE 0 END), 0) AS outbound
    FROM movements WHERE moved_at = ?
  `).get(date);
  const stock = getStock();
  return {
    date,
    inbound: round2(row.inbound),
    outbound: round2(row.outbound),
    net: round2(row.inbound - row.outbound),
    stock: stock.stock,
  };
}

export function statsRange(startDate, endDate) {
  const days = db.prepare(`
    SELECT
      moved_at AS date,
      COALESCE(SUM(CASE WHEN type='in' THEN kilograms ELSE 0 END), 0) AS inbound,
      COALESCE(SUM(CASE WHEN type='out' THEN kilograms ELSE 0 END), 0) AS outbound
    FROM movements
    WHERE moved_at >= ? AND moved_at <= ?
    GROUP BY moved_at
    ORDER BY moved_at
  `).all(startDate, endDate);

  const map = new Map(days.map((d) => [d.date, d]));
  const series = [];
  let cur = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (cur <= end) {
    const key = formatDate(cur);
    const d = map.get(key);
    const inbound = d ? round2(d.inbound) : 0;
    const outbound = d ? round2(d.outbound) : 0;
    series.push({ date: key, inbound, outbound, net: round2(inbound - outbound) });
    cur.setDate(cur.getDate() + 1);
  }

  const inbound = round2(series.reduce((s, x) => s + x.inbound, 0));
  const outbound = round2(series.reduce((s, x) => s + x.outbound, 0));
  return {
    startDate,
    endDate,
    inbound,
    outbound,
    net: round2(inbound - outbound),
    stock: getStock().stock,
    series,
  };
}

export function statsMonth(year, month) {
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const start = `${ym}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${ym}-${String(lastDay).padStart(2, '0')}`;
  return { ...statsRange(start, end), year, month };
}

export function statsYear(year) {
  const rows = db.prepare(`
    SELECT
      substr(moved_at, 1, 7) AS month,
      COALESCE(SUM(CASE WHEN type='in' THEN kilograms ELSE 0 END), 0) AS inbound,
      COALESCE(SUM(CASE WHEN type='out' THEN kilograms ELSE 0 END), 0) AS outbound
    FROM movements
    WHERE moved_at >= ? AND moved_at <= ?
    GROUP BY substr(moved_at, 1, 7)
    ORDER BY month
  `).all(`${year}-01-01`, `${year}-12-31`);

  const map = new Map(rows.map((r) => [r.month, r]));
  const series = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    const r = map.get(key);
    const inbound = r ? round2(r.inbound) : 0;
    const outbound = r ? round2(r.outbound) : 0;
    series.push({ month: key, label: `${m}月`, inbound, outbound, net: round2(inbound - outbound) });
  }

  const inbound = round2(series.reduce((s, x) => s + x.inbound, 0));
  const outbound = round2(series.reduce((s, x) => s + x.outbound, 0));
  return {
    year,
    inbound,
    outbound,
    net: round2(inbound - outbound),
    stock: getStock().stock,
    series,
  };
}

export function todayStr() {
  return formatDate(new Date());
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export default db;
