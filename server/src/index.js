import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import {
  getUserByUsername,
  getUserById,
  getStock,
  addMovement,
  listMovementsByDate,
  deleteMovement,
  statsToday,
  statsRange,
  statsMonth,
  statsYear,
  todayStr,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3847;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(cors({
  origin: isProd ? false : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json());
app.use(session({
  name: 'lamb.sid',
  secret: process.env.SESSION_SECRET || 'lamb-warehouse-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: isProd || process.env.COOKIE_SECURE === '1',
  },
}));

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: '未登录' });
  }
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }
    const user = getUserByUsername(String(username).trim());
    if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '登录失败' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('lamb.sid');
    res.json({ ok: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: '未登录' });
  }
  const user = getUserById(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: '未登录' });
  }
  res.json({ user });
});

app.get('/api/stock', requireAuth, (_req, res) => {
  res.json(getStock());
});

app.get('/api/movements', requireAuth, (req, res) => {
  const date = (req.query.date || todayStr()).toString().slice(0, 10);
  res.json({ date, items: listMovementsByDate(date), stock: getStock() });
});

app.post('/api/movements', requireAuth, (req, res) => {
  try {
    const { type, kilograms, note, moved_at } = req.body || {};
    const item = addMovement({
      type,
      kilograms,
      note,
      moved_at,
      created_by: req.session.userId,
    });
    res.status(201).json({ item, stock: getStock() });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || '保存失败' });
  }
});

app.delete('/api/movements/:id', requireAuth, (req, res) => {
  try {
    deleteMovement(Number(req.params.id));
    res.json({ ok: true, stock: getStock() });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || '删除失败' });
  }
});

app.get('/api/stats/today', requireAuth, (req, res) => {
  const date = (req.query.date || todayStr()).toString().slice(0, 10);
  res.json(statsToday(date));
});

app.get('/api/stats/week', requireAuth, (req, res) => {
  const end = (req.query.end || todayStr()).toString().slice(0, 10);
  const endDate = new Date(end + 'T00:00:00');
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);
  const start = formatYmd(startDate);
  res.json(statsRange(start, end));
});

app.get('/api/stats/month', requireAuth, (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getFullYear();
  const month = Number(req.query.month) || now.getMonth() + 1;
  res.json(statsMonth(year, month));
});

app.get('/api/stats/year', requireAuth, (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  res.json(statsYear(year));
});

function formatYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

if (isProd) {
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: '服务器错误' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] 羊肉仓库 API 运行于 http://localhost:${PORT}`);
});
