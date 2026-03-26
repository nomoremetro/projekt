const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const app = express();
const port = 8000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// База данных SQLite
const db = new sqlite3.Database(path.join(__dirname, 'ecoshyna.sqlite'));

// Инициализация таблиц
db.serialize(() => {
  // Пользователи
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

  // Заявки
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

  // Сообщения чата
  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT,
    text TEXT NOT NULL,
    is_operator BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Документы NVOS (простая таблица для сгенерированных документов)
  db.run(`CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    doc_type TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Создание/обновление администратора
  const adminUser = 'admin';
  const adminPass = 'artur9090';
  bcrypt.hash(adminPass, 10, (err, hash) => {
    if (err) return console.error('Ошибка хеширования пароля админа', err);
    db.get("SELECT * FROM users WHERE username = ?", [adminUser], (err, row) => {
      if (err) return console.error(err);
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

// ==================== АВТОРИЗАЦИЯ ====================
app.post('/api/auth/login', (req, res) => {
  const { login, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? OR email = ?", [login, login], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ success: false, message: 'Пользователь не найден' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Неверный пароль' });
    }
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
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { username, email, password, role, company_name, inn, ogrn, address_jur } = req.body;
  const hashedPass = await bcrypt.hash(password, 10);

  db.run(`INSERT INTO users (username, email, password, role, company_name, inn, ogrn, address_jur)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [username, email, hashedPass, role || 'user', company_name, inn, ogrn, address_jur],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ success: false, message: 'Пользователь с таким именем или email уже существует' });
        }
        return res.status(500).json({ success: false, message: 'Ошибка регистрации' });
      }
      res.json({ success: true, message: 'Регистрация успешна' });
    });
});

app.post('/api/auth/update', async (req, res) => {
  const { userId, username, email, password } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: 'ID пользователя не указан' });

  const updates = [];
  const params = [];
  if (username) { updates.push('username = ?'); params.push(username); }
  if (email) { updates.push('email = ?'); params.push(email); }
  if (password) {
    const hashed = await bcrypt.hash(password, 10);
    updates.push('password = ?');
    params.push(hashed);
  }
  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: 'Нет данных для обновления' });
  }
  params.push(userId);
  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ success: false, message: 'Имя пользователя или email уже заняты' });
      }
      return res.status(500).json({ success: false, message: 'Ошибка обновления' });
    }
    db.get("SELECT id, username, email, role, avatar FROM users WHERE id = ?", [userId], (err, user) => {
      if (err) return res.status(500).json({ success: false });
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
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { name, phone, email, city, street, house, weight, date, time, userId, submittedAt } = req.body;
  const address = `${city}, ул. ${street}, д. ${house}`;
  const submissionTime = submittedAt || new Date().toISOString();

  db.run(`INSERT INTO requests (user_id, name, phone, email, city, street, house, weight, date, time, address, submittedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId || null, name, phone, email, city, street, house, weight, date, time, address, submissionTime],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).send('Ошибка сохранения заявки');
      }
      res.status(201).send('Заявка успешно принята');
    });
});

app.get('/api/requests', (req, res) => {
  db.all("SELECT * FROM requests ORDER BY submittedAt DESC", (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
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

// ==================== ЧАТ ====================
app.post('/api/chat', (req, res) => {
  const { message, userId, userName } = req.body;
  if (!message) return res.status(400).json({ error: 'Пустое сообщение' });

  // Сохраняем сообщение пользователя
  const userNameForDb = userName || (userId ? `user_${userId}` : 'Гость');
  db.run(`INSERT INTO chat_messages (user_id, user_name, text, is_operator) VALUES (?, ?, ?, 0)`,
    [userId || null, userNameForDb, message], function(err) {
      if (err) console.error(err);
    });

  // Генерация ответа бота (ключевые слова)
  let reply = 'Спасибо за сообщение! Наш оператор свяжется с вами в ближайшее время.';
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes('цена') || lowerMsg.includes('стоимость')) {
    reply = 'Стоимость вывоза шин рассчитывается индивидуально. Оставьте заявку, и мы свяжемся с вами для уточнения.';
  } else if (lowerMsg.includes('вывоз') || lowerMsg.includes('приехать')) {
    reply = 'Мы осуществляем вывоз шин от 20 кг. Оставьте заявку на сайте, и мы согласуем время.';
  } else if (lowerMsg.includes('документ') || lowerMsg.includes('нвос')) {
    reply = 'Для юридических лиц мы предоставляем полный пакет документов НВОС. Заполните заявку, и мы подготовим документы.';
  } else if (lowerMsg.includes('спасибо')) {
    reply = 'Всегда рады помочь! Обращайтесь :)';
  }

  // Сохраняем ответ бота (как операторский)
  db.run(`INSERT INTO chat_messages (user_id, user_name, text, is_operator) VALUES (?, ?, ?, 1)`,
    [userId || null, 'Bot', reply], (err) => {
      if (err) console.error(err);
    });

  res.json({ reply });
});

app.get('/api/chat/messages', (req, res) => {
  db.all("SELECT * FROM chat_messages ORDER BY created_at ASC", (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
  });
});

app.post('/api/chat/operator', (req, res) => {
  const { message, userId } = req.body;
  if (!message) return res.status(400).json({ error: 'Пустое сообщение' });
  db.run(`INSERT INTO chat_messages (user_id, user_name, text, is_operator) VALUES (?, ?, ?, 1)`,
    [userId || null, 'Оператор', message], function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка' });
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

// ==================== ГЕНЕРАЦИЯ ДОКУМЕНТОВ (NVOS) ====================
app.post('/api/documents/generate', (req, res) => {
  const { userId, companyName, inn, ogrn, address } = req.body;
  if (!userId) return res.status(400).json({ error: 'Необходима авторизация' });

  // Имитация генерации текста нейросетью (заглушка)
  const docContent = `
    Документ об утверждении нормативов образования отходов и лимитов на их размещение (НВОС)
    
    Организация: ${companyName || 'Индивидуальный предприниматель'}
    ИНН: ${inn || '—'}
    ОГРН: ${ogrn || '—'}
    Юридический адрес: ${address || '—'}
    
    На основании предоставленных данных и расчётов, утверждены следующие нормативы:
    - Отходы шин: 0.5 тонн в год
    - Резиновая крошка: 0.3 тонн в год
    - Металлокорд: 0.05 тонн в год
    
    Документ сгенерирован автоматически. Для получения официального бланка обратитесь к оператору.
  `;

  db.run(`INSERT INTO documents (user_id, doc_type, content) VALUES (?, 'nvos', ?)`,
    [userId, docContent], function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка сохранения документа' });
      res.json({ success: true, content: docContent });
    });
});

app.get('/api/documents/:userId', (req, res) => {
  const { userId } = req.params;
  db.all("SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC", [userId], (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
  });
});

// ==================== СТАТИЧЕСКИЕ ФАЙЛЫ ====================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/about.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/documents.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'documents.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

//  ЗАПУСК СЕРВЕРА
app.listen(port, () => {
  console.log(`🚀 Сервер EcoShyna запущен на http://localhost:${port}`);
});

// печеньки
