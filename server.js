const express = require('express');
   const fs = require('fs').promises;
   const path = require('path');
   const { body, validationResult } = require('express-validator');
   const rateLimit = require('express-rate-limit');
   const sanitizeHtml = require('sanitize-html');

   const app = express();
   const port = process.env.PORT || 7373;

   // Middleware
   app.use(express.urlencoded({ extended: true }));
   app.use(express.json());
   app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'public' directory

   // Rate limiting for API endpoints
   const apiLimiter = rateLimit({
       windowMs: 15 * 60 * 1000, // 15 minutes
       max: 100, // Limit each IP to 100 requests per windowMs
       message: 'Слишком много запросов с вашего IP, попробуйте снова через 15 минут.'
   });
   app.use('/api/', apiLimiter);

   // Admin credentials (in a real app, use a database and hash passwords)
   const adminCredentials = {
       login: 'admin',
       password: 'artur9090' // Replace with a strong password or use environment variables
   };

   // Validation middleware for request form
   const requestValidation = [
       body('name').trim().notEmpty().withMessage('ФИО обязательно для заполнения'),
       body('phone').trim().matches(/\+?[0-9\s\-\(\)]+/).withMessage('Некорректный номер телефона'),
       body('email').optional().isEmail().withMessage('Некорректный email'),
       body('city').trim().notEmpty().withMessage('Город обязателен для заполнения'),
       body('street').trim().notEmpty().withMessage('Улица обязательна для заполнения'),
       body('house').trim().notEmpty().withMessage('Номер дома обязателен для заполнения'),
       body('weight').isFloat({ min: 1 }).withMessage('Вес должен быть больше 0 кг'),
       body('date').isISO8601().withMessage('Некорректный формат даты'),
       body('time').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Некорректный формат времени'),
       body('submittedAt').isISO8601().withMessage('Некорректный формат времени подачи заявки'),
       body('date', 'Дата и время должны быть не ранее чем через 3 часа от текущего времени и не позже 19:00').custom((date, { req }) => {
           const selectedDateTime = new Date(`${date}T${req.body.time}:00+04:00`); // Samara time (UTC+4)
           const now = new Date();
           now.setHours(now.getHours() + 4); // Adjust to Samara time
           const minDateTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3-hour buffer
           const maxTime = new Date(`${date}T19:00:00+04:00`);

           if (selectedDateTime < minDateTime) {
               throw new Error('Дата и время должны быть не ранее чем через 3 часа от текущего времени');
           }
           if (selectedDateTime > maxTime) {
               throw new Error('Время вывоза не может быть позже 19:00');
           }
           return true;
       })
   ];

   // Sanitize input function
   function sanitizeInput(input) {
       return sanitizeHtml(input, {
           allowedTags: [],
           allowedAttributes: {}
       });
   }

   // API Endpoints
   app.post('/api/request', requestValidation, async (req, res) => {
       try {
           const errors = validationResult(req);
           if (!errors.isEmpty()) {
               return res.status(400).json({ errors: errors.array() });
           }

           const { name, phone, email, city, street, house, weight, date, time, submittedAt } = req.body;

           // Sanitize inputs
           const sanitizedData = {
               name: sanitizeInput(name),
               phone: sanitizeInput(phone),
               email: email ? sanitizeInput(email) : '',
               city: sanitizeInput(city),
               street: sanitizeInput(street),
               house: sanitizeInput(house),
               weight: parseFloat(weight).toFixed(1),
               date: sanitizeInput(date),
               time: sanitizeInput(time),
               submittedAt: new Date(submittedAt).toISOString()
           };

           // Format request data
           const requestData = `
   Имя: ${sanitizedData.name}
   Телефон: ${sanitizedData.phone}
   Email: ${sanitizedData.email || 'Не указан'}
   Адрес: ${sanitizedData.city}, ${sanitizedData.street}, ${sanitizedData.house}
   Вес шин: ${sanitizedData.weight} кг
   Дата вывоза: ${sanitizedData.date}
   Время вывоза: ${sanitizedData.time}
   Подача: ${sanitizedData.submittedAt}
   --------------------`;

           // Append to file
           await fs.appendFile(path.join(__dirname, 'requests.txt'), requestData + '\n');

           res.send('Заявка успешно отправлена! Мы свяжемся с вами для подтверждения.');
       } catch (error) {
           console.error('Ошибка при обработке заявки:', error);
           res.status(500).send('Произошла ошибка при отправке заявки.');
       }
   });

   app.post('/api/admin/login', [
       body('login').trim().notEmpty().withMessage('Логин обязателен'),
       body('password').notEmpty().withMessage('Пароль обязателен')
   ], async (req, res) => {
       try {
           const errors = validationResult(req);
           if (!errors.isEmpty()) {
               return res.status(400).json({ success: false, message: errors.array()[0].msg });
           }

           const { login, password } = req.body;

           if (login === adminCredentials.login && password === adminCredentials.password) {
               return res.json({ success: true });
           } else {
               return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
           }
       } catch (error) {
           console.error('Ошибка при авторизации:', error);
           res.status(500).json({ success: false, message: 'Произошла ошибка сервера' });
       }
   });

   app.get('/api/admin/requests', async (req, res) => {
       try {
           const data = await fs.readFile(path.join(__dirname, 'requests.txt'), 'utf8');
           res.send(data);
       } catch (error) {
           if (error.code === 'ENOENT') {
               res.send('Заявок пока нет.');
           } else {
               console.error('Ошибка при чтении заявок:', error);
               res.status(500).send('Произошла ошибка при загрузке заявок.');
           }
       }
   });

   // Serve HTML files
   app.get('/', (req, res) => {
       fs.readFile(path.join(__dirname, 'public', 'index.html'), 'utf8', (err, data) => {
           if (err) {
               console.error(err);
               return res.status(500).send('Error reading index.html');
           }
           // Замените плейсхолдер на переменную окружения
           const apiKey = process.env.YANDEX_MAPS_API_KEY || '4dbf074a-96ae-455e-a980-a20e4a3da478'; // Use your key as a default for local testing
           const updatedHtml = data.replace('ВАШ_API_КЛЮЧ_ЯНДЕКС_КАРТ', apiKey);
           res.send(updatedHtml);
       });
   });

   app.get('/admin.html', (req, res) => {
       res.sendFile(path.join(__dirname, 'public', 'admin.html'));
   });

   // Start server
   app.listen(port, () => {
       console.log(`Сервер запущен на http://localhost:${port}`);
   });