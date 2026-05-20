const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const fs = require('fs');

const app = express();
const port = 8000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// База данных SQLite
const db = new sqlite3.Database(path.join(__dirname, 'ecoshyna.sqlite'));

// ==================== ИНИЦИАЛИЗАЦИЯ ТАБЛИЦ ====================
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
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

  db.run(`CREATE TABLE IF NOT EXISTS requests (
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

  db.run(`CREATE TABLE IF NOT EXISTS chat_dialogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_name TEXT NOT NULL,
    guest_id TEXT UNIQUE,
    user_id INTEGER,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
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

  db.run(`CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    doc_type TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const adminUser = 'admin';
  const adminPass = 'artur9090';
  bcrypt.hash(adminPass, 10, (err, hash) => {
    if (err) return console.error('Ошибка хеширования пароля админа', err);
    db.get("SELECT * FROM users WHERE username = ?", [adminUser], (err, row) => {
      if (!row) {
        db.run("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
          [adminUser, 'admin@ecoshyna.ru', hash, 'admin']);
        console.log('✅ Администратор создан: admin / artur9090');
      } else {
        db.run("UPDATE users SET password = ?, role = 'admin' WHERE username = ?", [hash, adminUser]);
        console.log('✅ Пароль администратора обновлён');
      }
    });
  });
});

// ==================== НАСТРОЙКА ЗАГРУЗКИ ФАЙЛОВ ====================
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

// ==================== АВТОРИЗАЦИЯ ====================
app.post('/api/auth/login', (req, res) => {
  const { login, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? OR email = ?", [login, login], async (err, user) => {
    if (err || !user) return res.status(401).json({ success: false, message: 'Пользователь не найден' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ success: false, message: 'Неверный пароль' });
    const { password: _, ...userData } = user;
    res.json({ success: true, user: userData });
  });
});

app.post('/api/auth/register', [
  body('username').notEmpty().withMessage('Имя пользователя обязательно'),
  body('email').isEmail().withMessage('Некорректный email'),
  body('password').isLength({ min: 8 }).withMessage('Пароль должен быть минимум 8 символов')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });

  const { username, email, password, role, company_name, inn, ogrn, address_jur } = req.body;
  const hashedPass = await bcrypt.hash(password, 10);
  db.run(`INSERT INTO users (username, email, password, role, company_name, inn, ogrn, address_jur)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [username, email, hashedPass, role || 'user', company_name, inn, ogrn, address_jur],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ success: false, message: 'Логин или email уже существует' });
        return res.status(500).json({ success: false, message: 'Ошибка регистрации' });
      }
      res.json({ success: true, message: 'Регистрация успешна' });
    });
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
  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ success: false, message: 'Ошибка обновления' });
    db.get("SELECT id, username, email, role, avatar FROM users WHERE id = ?", [userId], (err, user) => {
      res.json({ success: true, user });
    });
  });
});

// ==================== ЗАЯВКИ ====================
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
  db.run(`INSERT INTO requests (user_id, name, phone, email, city, street, house, weight, date, time, address, submittedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId || null, name, phone, email, city, street, house, weight, date, time, address, submissionTime],
    function(err) {
      if (err) return res.status(500).send('Ошибка сохранения заявки');
      res.status(201).send('Заявка успешно принята');
    });
});

app.get('/api/requests', (req, res) => {
  db.all("SELECT * FROM requests ORDER BY submittedAt DESC", (err, rows) => {
    res.json(rows || []);
  });
});

app.put('/api/requests/status', (req, res) => {
  const { id, status } = req.body;
  if (!id || !status) return res.status(400).json({ error: 'Неверные данные' });
  db.run("UPDATE requests SET status = ? WHERE id = ?", [status, id], function(err) {
    if (err) return res.status(500).json({ error: 'Ошибка обновления' });
    res.json({ success: true });
  });
});

// ==================== УМНЫЙ ЧАТ ====================
app.post('/api/chat/start', (req, res) => {
  const { guestId, guestName, userId } = req.body;
  if (!guestId) return res.status(400).json({ error: 'guestId обязателен' });
  
  db.get("SELECT id FROM chat_dialogs WHERE guest_id = ? AND status = 'active'", [guestId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) {
      // Обновляем имя, если оно изменилось (например, юзер залогинился)
      db.run("UPDATE chat_dialogs SET guest_name = ? WHERE id = ?", [guestName || 'Гость', row.id]);
      return res.json({ dialogId: row.id });
    }
    
    db.run("INSERT INTO chat_dialogs (guest_name, guest_id, user_id) VALUES (?, ?, ?)",
      [guestName || 'Гость', guestId, userId || null], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ dialogId: this.lastID });
      });
  });
});

app.get('/api/chat/dialogs', (req, res) => {
  db.all(`SELECT d.*, (SELECT COUNT(*) FROM chat_messages WHERE dialog_id = d.id) as messageCount 
          FROM chat_dialogs d WHERE d.status = 'active' ORDER BY d.created_at DESC`, (err, rows) => {
    res.json(rows || []);
  });
});

app.get('/api/chat/messages/:dialogId', (req, res) => {
  const { dialogId } = req.params;
  db.all("SELECT * FROM chat_messages WHERE dialog_id = ? ORDER BY created_at ASC", [dialogId], (err, rows) => {
    res.json(rows || []);
  });
});

app.post('/api/chat', (req, res) => {
  const { message, userId, dialogId, userName } = req.body;
  if (!message) return res.status(400).json({ error: 'Пустое сообщение' });
  
  const displayName = userName || (userId ? `user_${userId}` : 'Гость');
  
  // Сохраняем сообщение пользователя
  db.run(`INSERT INTO chat_messages (dialog_id, user_id, user_name, text, is_operator) VALUES (?, ?, ?, ?, 0)`,
    [dialogId, userId || null, displayName, message], (err) => { if (err) console.error(err); });

  // ЛОГИКА БОТА
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

  // Сохраняем ответ бота
  db.run(`INSERT INTO chat_messages (dialog_id, user_name, text, is_operator) VALUES (?, ?, ?, 1)`,
    [dialogId, '🤖 EcoBot', reply], (err) => { if (err) console.error(err); });

  res.json({ reply });
});

app.post('/api/chat/operator', (req, res) => {
  const { dialogId, message } = req.body;
  if (!dialogId || !message) return res.status(400).json({ error: 'Нет данных' });
  db.run(`INSERT INTO chat_messages (dialog_id, user_name, text, is_operator) VALUES (?, ?, ?, 1)`,
    [dialogId, '👨‍💼 Оператор', message], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
});

app.post('/api/chat/upload', upload.single('file'), (req, res) => {
  const { dialogId } = req.body;
  if (!dialogId || !req.file) return res.status(400).json({ error: 'Нет файла' });
  const fileUrl = `/chat_uploads/${req.file.filename}`;
  db.run(`INSERT INTO chat_messages (dialog_id, user_name, text, is_operator, file_url) VALUES (?, ?, ?, ?, ?)`,
    [dialogId, '👨‍💼 Оператор', `📷 Фото: ${req.file.originalname}`, 1, fileUrl], (err) => {
      res.json({ success: true, fileUrl });
    });
});

app.post('/api/chat/user-upload', upload.single('file'), (req, res) => {
  const { dialogId, userName } = req.body;
  if (!dialogId || !req.file) return res.status(400).json({ error: 'Нет файла' });
  const fileUrl = `/chat_uploads/${req.file.filename}`;
  db.run(`INSERT INTO chat_messages (dialog_id, user_name, text, is_operator, file_url) VALUES (?, ?, ?, ?, ?)`,
    [dialogId, userName || 'Пользователь', `📷 Фото: ${req.file.originalname}`, 0, fileUrl], (err) => {
      res.json({ success: true, fileUrl });
    });
});

app.post('/api/chat/close/:dialogId', (req, res) => {
  const { dialogId } = req.params;
  db.run("UPDATE chat_dialogs SET status = 'closed' WHERE id = ?", [dialogId], (err) => {
    res.json({ success: true });
  });
});

// ==================== АДМИН ЛОГИН ====================
app.post('/api/admin/login', (req, res) => {
  const { login, password } = req.body;
  db.get("SELECT * FROM users WHERE (username = ? OR email = ?) AND role = 'admin'", [login, login], async (err, user) => {
    if (err || !user) return res.status(401).json({ success: false, message: 'Доступ запрещён' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ success: false, message: 'Неверный пароль' });
    res.json({ success: true });
  });
});

// ==================== СТАТИЧЕСКИЕ ФАЙЛЫ ====================
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/about.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'about.html')); });
app.get('/documents.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'documents.html')); });
app.get('/admin.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin.html')); });

// ==================== ЗАПУСК ====================
app.listen(port, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   🚀 EcoShyna сервер запущен!         ║`);
  console.log(`║   🌐 http://localhost:${port}            ║`);
  console.log(`║   👨‍💼 Админ: admin / artur9090         ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
});

// 🍪🍪🍪 ПЕЧЕНЬКИ! ВСЁ РАБОТАЕТ! 🍪🍪🍪
