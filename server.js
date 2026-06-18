const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const fs = require('fs');

const app = express();
const port = 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const db = new Database(path.join(__dirname, 'ecoshyna.sqlite'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Миграции: добавляем отсутствующие колонки если нужно
try { db.exec("ALTER TABLE chat_dialogs ADD COLUMN user_id INTEGER"); } catch(e) {}
try { db.exec("ALTER TABLE chat_dialogs ADD COLUMN guest_id TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE users ADD COLUMN company_name TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE users ADD COLUMN inn TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE users ADD COLUMN ogrn TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE users ADD COLUMN address_jur TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE users ADD COLUMN avatar TEXT"); } catch(e) {}

db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  avatar TEXT,
  company_name TEXT,
  inn TEXT,
  ogrn TEXT,
  address_jur TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT NOT NULL,
  street TEXT NOT NULL,
  house TEXT NOT NULL,
  weight REAL NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  address TEXT,
  status TEXT DEFAULT 'pending',
  submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS chat_dialogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_name TEXT NOT NULL,
  guest_id TEXT UNIQUE,
  user_id INTEGER,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dialog_id INTEGER,
  user_id INTEGER,
  user_name TEXT,
  text TEXT NOT NULL,
  is_operator BOOLEAN DEFAULT 0,
  file_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(dialog_id) REFERENCES chat_dialogs(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  doc_type TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

(async () => {
  const adminUser = 'admin';
  const adminPass = 'artur9090';
  const hash = await bcrypt.hash(adminPass, 10);
  const existing = db.prepare("SELECT * FROM users WHERE username = ?").get(adminUser);
  if (!existing) {
    db.prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)").run(adminUser, 'admin@ecoshyna.ru', hash, 'admin');
    console.log('✅ Администратор создан: admin / artur9090');
  } else {
    db.prepare("UPDATE users SET password = ?, role = 'admin' WHERE username = ?").run(hash, adminUser);
    console.log('✅ Пароль администратора обновлён');
  }
})();

const chatUploadDir = path.join(__dirname, 'public', 'chat_uploads');
if (!fs.existsSync(chatUploadDir)) {
  fs.mkdirSync(chatUploadDir, { recursive: true });
}

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Можно отправлять только изображения (JPEG, PNG, GIF, WEBP)'), false);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, chatUploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

app.post('/api/auth/login', async (req, res) => {
  const { login, password } = req.body;
  try {
    const user = db.prepare("SELECT * FROM users WHERE username = ? OR email = ?").get(login, login);
    if (!user) return res.status(401).json({ success: false, message: 'Пользователь не найден' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ success: false, message: 'Неверный пароль' });
    const { password: _, ...userData } = user;
    res.json({ success: true, user: userData });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

app.post('/api/auth/register', [
  body('username').notEmpty().withMessage('Имя пользователя обязательно'),
  body('email').isEmail().withMessage('Некорректный email'),
  body('password').isLength({ min: 8 }).withMessage('Пароль должен быть минимум 8 символов')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });

  const { username, email, password, role, company_name, inn, ogrn, address_jur } = req.body;
  try {
    const hashedPass = await bcrypt.hash(password, 10);
    db.prepare(`INSERT INTO users (username, email, password, role, company_name, inn, ogrn, address_jur) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(username, email, hashedPass, role || 'user', company_name, inn, ogrn, address_jur);
    res.json({ success: true, message: 'Регистрация успешна' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ success: false, message: 'Логин или email уже существует' });
    res.status(500).json({ success: false, message: 'Ошибка регистрации' });
  }
});

app.post('/api/auth/update', async (req, res) => {
  const { userId, username, email, password } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: 'ID пользователя не указан' });

  const updates = [], params = [];
  if (username) { updates.push('username = ?'); params.push(username); }
  if (email) { updates.push('email = ?'); params.push(email); }
  if (password) {
    const hashed = await bcrypt.hash(password, 10);
    updates.push('password = ?');
    params.push(hashed);
  }
  if (updates.length === 0) return res.status(400).json({ success: false, message: 'Нет данных для обновления' });
  params.push(userId);
  try {
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const user = db.prepare("SELECT id, username, email, role, avatar FROM users WHERE id = ?").get(userId);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Ошибка обновления' });
  }
});

app.post('/api/request', [
  body('name').notEmpty(),
  body('phone').notEmpty(),
  body('city').notEmpty(),
  body('street').notEmpty(),
  body('house').notEmpty(),
  body('weight').isFloat({ min: 1 }),
  body('date').notEmpty(),
  body('time').notEmpty()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

  const { name, phone, email, city, street, house, weight, date, time, userId, submittedAt } = req.body;
  const address = `${city}, ул. ${street}, д. ${house}`;
  const submissionTime = submittedAt || new Date().toISOString();
  try {
    db.prepare(`INSERT INTO requests (user_id, name, phone, email, city, street, house, weight, date, time, address, submittedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(userId || null, name, phone, email, city, street, house, weight, date, time, address, submissionTime);
    res.status(201).send('Заявка успешно принята');
  } catch (err) {
    res.status(500).send('Ошибка сохранения заявки');
  }
});

app.get('/api/requests', (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM requests ORDER BY submittedAt DESC").all();
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

app.put('/api/requests/status', (req, res) => {
  const { id, status } = req.body;
  if (!id || !status) return res.status(400).json({ error: 'Неверные данные' });
  try {
    db.prepare("UPDATE requests SET status = ? WHERE id = ?").run(status, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

app.post('/api/chat/start', (req, res) => {
  const { guestId, guestName, userId } = req.body;
  if (!guestId) return res.status(400).json({ error: 'guestId обязателен' });
  try {
    const row = db.prepare("SELECT id FROM chat_dialogs WHERE guest_id = ? AND status = 'active'").get(guestId);
    if (row) {
      db.prepare("UPDATE chat_dialogs SET guest_name = ? WHERE id = ?").run(guestName || 'Гость', row.id);
      return res.json({ dialogId: row.id });
    }
    const result = db.prepare("INSERT INTO chat_dialogs (guest_name, guest_id, user_id) VALUES (?, ?, ?)").run(guestName || 'Гость', guestId, userId || null);
    res.json({ dialogId: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chat/dialogs', (req, res) => {
  try {
    const rows = db.prepare(`SELECT d.*, (SELECT COUNT(*) FROM chat_messages WHERE dialog_id = d.id) as messageCount FROM chat_dialogs d WHERE d.status = 'active' ORDER BY d.created_at DESC`).all();
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

app.get('/api/chat/messages/:dialogId', (req, res) => {
  const { dialogId } = req.params;
  try {
    const rows = db.prepare("SELECT * FROM chat_messages WHERE dialog_id = ? ORDER BY created_at ASC").all(dialogId);
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/chat', (req, res) => {
  const { message, userId, dialogId, userName } = req.body;
  if (!message) return res.status(400).json({ error: 'Пустое сообщение' });

  const displayName = userName || (userId ? `user_${userId}` : 'Гость');

  try {
    db.prepare(`INSERT INTO chat_messages (dialog_id, user_id, user_name, text, is_operator) VALUES (?, ?, ?, ?, 0)`).run(dialogId, userId || null, displayName, message);
  } catch (err) { console.error(err); }

  let reply = '';
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('цена') || lowerMsg.includes('стоимост') || lowerMsg.includes('деньг')) {
    reply = '💰 Стоимость рассчитывается индивидуально! Мы платим от 12 руб. за кг резиновой крошки. Воспользуйтесь калькулятором на главной странице!';
  } else if (lowerMsg.includes('вывоз') || lowerMsg.includes('забрат')) {
    reply = '🚚 Мы осуществляем вывоз шин от 20 кг. Просто оставьте заявку на сайте, и наша машина приедет в выбранное время.';
  } else if (lowerMsg.includes('нвос') || lowerMsg.includes('документ') || lowerMsg.includes('справк') || lowerMsg.includes('акт')) {
    reply = '📄 Да, мы работаем с юрлицами! После сдачи шин мы выдаем официальную справку о НВОС и акт приема-передачи для вашей эко-отчетности.';
  } else if (lowerMsg.includes('адрес') || lowerMsg.includes('находит') || lowerMsg.includes('куд')) {
    reply = '📍 Мы находимся по адресу: Аграрная ул., 1, пгт. Стройкерамика, Самарская обл. Привозите!';
  } else if (lowerMsg.includes('спасибо')) {
    reply = '🙌 Всегда рады помочь! Если что — пишите.';
  } else {
    reply = '🤖 Я пока только учусь и не знаю точного ответа. Перевожу диалог на специалиста 👨‍💼. Пожалуйста, подождите немного!';
  }

  try {
    db.prepare(`INSERT INTO chat_messages (dialog_id, user_name, text, is_operator) VALUES (?, ?, ?, 1)`).run(dialogId, '🤖 EcoBot', reply);
  } catch (err) { console.error(err); }

  res.json({ reply });
});

app.post('/api/chat/operator', (req, res) => {
  const { dialogId, message } = req.body;
  if (!dialogId || !message) return res.status(400).json({ error: 'Нет данных' });
  try {
    db.prepare(`INSERT INTO chat_messages (dialog_id, user_name, text, is_operator) VALUES (?, ?, ?, 1)`).run(dialogId, '👨‍💼 Оператор', message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat/upload', upload.single('file'), (req, res) => {
  const { dialogId } = req.body;
  if (!dialogId || !req.file) return res.status(400).json({ error: 'Нет файла' });
  const fileUrl = `/chat_uploads/${req.file.filename}`;
  try {
    db.prepare(`INSERT INTO chat_messages (dialog_id, user_name, text, is_operator, file_url) VALUES (?, ?, ?, ?, ?)`).run(dialogId, '👨‍💼 Оператор', `📷 Фото: ${req.file.originalname}`, 1, fileUrl);
    res.json({ success: true, fileUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat/user-upload', upload.single('file'), (req, res) => {
  const { dialogId, userName } = req.body;
  if (!dialogId || !req.file) return res.status(400).json({ error: 'Нет файла' });
  const fileUrl = `/chat_uploads/${req.file.filename}`;
  try {
    db.prepare(`INSERT INTO chat_messages (dialog_id, user_name, text, is_operator, file_url) VALUES (?, ?, ?, ?, ?)`).run(dialogId, userName || 'Пользователь', `📷 Фото: ${req.file.originalname}`, 0, fileUrl);
    res.json({ success: true, fileUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat/close/:dialogId', (req, res) => {
  const { dialogId } = req.params;
  try {
    db.prepare("UPDATE chat_dialogs SET status = 'closed' WHERE id = ?").run(dialogId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/update-avatar', async (req, res) => {
  const { userId, avatar } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: 'ID пользователя не указан' });
  if (!avatar) return res.status(400).json({ success: false, message: 'Аватар не передан' });
  try {
    db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(avatar, userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Ошибка сохранения аватара' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  const { login, password } = req.body;
  try {
    const user = db.prepare("SELECT * FROM users WHERE (username = ? OR email = ?) AND role = 'admin'").get(login, login);
    if (!user) return res.status(401).json({ success: false, message: 'Доступ запрещён' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ success: false, message: 'Неверный пароль' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/about.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'about.html')); });
app.get('/documents.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'documents.html')); });
app.get('/admin.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin.html')); });

app.listen(port, '0.0.0.0', () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   🚀 EcoShyna сервер запущен!         ║`);
  console.log(`║   🌐 http://0.0.0.0:${port}              ║`);
  console.log(`║   👨‍💼 Админ: admin / artur9090         ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
});
