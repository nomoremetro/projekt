// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let users = JSON.parse(localStorage.getItem('users')) || [];
let loggedInUser = localStorage.getItem('loggedInUser') ? JSON.parse(localStorage.getItem('loggedInUser')) : null;
const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';

const modalBg = document.getElementById('modal-bg');
const modalContentWrapper = document.getElementById('modal-content-wrapper');

let totalTyresProcessed = parseInt(localStorage.getItem('totalTyresProcessed') || '0');
if (document.getElementById('stat-tyres')) {
    document.getElementById('stat-tyres').innerText = totalTyresProcessed;
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function showError(element, message, type = 'error-message') {
    if (!element) return;
    element.textContent = message;
    element.className = `request-result ${type}`;
    element.style.display = 'block';
}

function updateStatsDisplay(value) {
    const statElement = document.getElementById('stat-tyres');
    if (statElement) statElement.textContent = value.toString();
    localStorage.setItem('totalTyresProcessed', value);
}

function updateUsersStorage() {
    localStorage.setItem('users', JSON.stringify(users));
}

function updateLoggedInUserStorage() {
    localStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}

// ==================== МОДАЛЬНЫЕ ОКНА ====================
function openModal(htmlContent) {
    if (!modalContentWrapper || !modalBg) return;
    modalContentWrapper.innerHTML = `<div class="modal">${htmlContent}<button class="close-modal" onclick="closeModal()">&times;</button></div>`;
    modalBg.classList.add('active');
    modalContentWrapper.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    if (!modalContentWrapper || !modalBg) return;
    modalBg.classList.remove('active');
    modalContentWrapper.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => {
        if (modalContentWrapper && !modalContentWrapper.classList.contains('active')) {
            modalContentWrapper.innerHTML = '';
        }
    }, 300);
}

if (modalBg) {
    modalBg.addEventListener('click', (event) => {
        if (event.target === modalBg) closeModal();
    });
}
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modalBg && modalBg.classList.contains('active')) {
        closeModal();
    }
});

// ==================== БОКОВАЯ ПАНЕЛЬ ====================
function openSideNav() {
    const sideNav = document.getElementById('sideNav');
    if (sideNav) sideNav.style.width = '250px';
}

function closeSideNav() {
    const sideNav = document.getElementById('sideNav');
    if (sideNav) sideNav.style.width = '0';
}

// ==================== ПРОКРУТКА ====================
function scrollToSection(sectionId, isFromSideNav = false) {
    if (isFromSideNav) {
        const targetUrl = `index.html#${sectionId}`;
        const currentPath = window.location.pathname.split('/').pop();
        if (currentPath === 'index.html' || currentPath === '') {
            const element = document.getElementById(sectionId);
            if (element) element.scrollIntoView({ behavior: 'smooth' });
        } else {
            window.location.href = targetUrl;
        }
        closeSideNav();
    } else {
        const element = document.getElementById(sectionId);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
    }
}

// ==================== ЛОАДЕР ====================
function showLoader(showMario = false) {
    const overlay = document.getElementById('loader-overlay');
    const gif = document.getElementById('loader-gif');
    const text = document.getElementById('loader-text');
    const fill = document.getElementById('progress-fill');
    if (!overlay) return;
    overlay.style.display = 'flex';
    gif.src = showMario ? 'mario-and-luigi.gif' : '16.gif';
    text.innerHTML = showMario ? 'Успешно!' : 'Загрузка<span class="dots">...</span>';
    fill.style.width = '0%';
    let width = 0;
    const interval = setInterval(() => {
        if (width >= 100) clearInterval(interval);
        else {
            width += 10;
            fill.style.width = width + '%';
        }
    }, 80);
    if (showMario) setTimeout(() => hideLoader(), 1500);
}

function hideLoader() {
    const overlay = document.getElementById('loader-overlay');
    if (overlay) overlay.style.display = 'none';
}

// ==================== АВТОРИЗАЦИЯ ====================
function openLogin() {
    openModal(`
        <h2>Вход в аккаунт</h2>
        <form id="login-form" onsubmit="return login(event)">
            <div class="form-group">
                <label for="login-username">Имя пользователя или Email</label>
                <input id="login-username" type="text" required>
            </div>
            <div class="form-group">
                <label for="login-pass">Пароль</label>
                <input id="login-pass" type="password" required>
            </div>
            <button class="btn-main" type="submit" style="width:100%;">Войти</button>
        </form>
        <div id="login-error" class="request-result error-message" style="display:none;"></div>
    `);
}

async function login(e) {
    e.preventDefault();
    const loginVal = document.getElementById('login-username').value.trim();
    const passVal = document.getElementById('login-pass').value;
    const errorDiv = document.getElementById('login-error');

    showLoader(false);
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: loginVal, password: passVal })
        });
        const data = await response.json();
        if (data.success) {
            loggedInUser = data.user;
            updateLoggedInUserStorage();
            showProfileDisplay();
            closeModal();
            showLoader(true);
            setTimeout(() => {
                hideLoader();
                location.reload();
            }, 1500);
        } else {
            hideLoader();
            showError(errorDiv, data.message || 'Ошибка входа');
        }
    } catch (err) {
        hideLoader();
        showError(errorDiv, 'Ошибка соединения с сервером');
    }
    return false;
}

function openRegister() {
    openModal(`
        <h2>Регистрация</h2>
        <form id="register-form" onsubmit="return register(event)">
            <div class="form-group">
                <label for="reg-role">Тип аккаунта</label>
                <select id="reg-role" onchange="toggleLegalFields(this.value)">
                    <option value="physical">Физическое лицо</option>
                    <option value="legal">Юридическое лицо</option>
                </select>
            </div>
            <div class="form-group">
                <label for="reg-username">Имя пользователя</label>
                <input id="reg-username" type="text" required>
            </div>
            <div class="form-group">
                <label for="reg-email">Email</label>
                <input id="reg-email" type="email" required>
            </div>
            <div class="form-group">
                <label for="reg-pass">Пароль (мин. 8 символов, 1 цифра)</label>
                <input id="reg-pass" type="password" minlength="8" pattern="^(?=.*\\d).{8,}$" required>
            </div>
            <div id="legal-fields" style="display:none;">
                <div class="form-group"><label for="reg-company">Название компании</label><input id="reg-company" type="text"></div>
                <div class="form-group"><label for="reg-inn">ИНН</label><input id="reg-inn" type="text"></div>
                <div class="form-group"><label for="reg-ogrn">ОГРН</label><input id="reg-ogrn" type="text"></div>
                <div class="form-group"><label for="reg-address">Юридический адрес</label><input id="reg-address" type="text"></div>
            </div>
            <button class="btn-main" type="submit" style="width:100%;">Зарегистрироваться</button>
        </form>
        <div id="register-error" class="request-result error-message" style="display:none;"></div>
    `);
}

window.toggleLegalFields = function(role) {
    const legalFields = document.getElementById('legal-fields');
    if (legalFields) legalFields.style.display = role === 'legal' ? 'block' : 'none';
};

async function register(e) {
    e.preventDefault();
    const role = document.getElementById('reg-role').value;
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const password = document.getElementById('reg-pass').value;
    const errorDiv = document.getElementById('register-error');

    showLoader(false);
    const data = {
        username, email, password, role,
        company_name: role === 'legal' ? document.getElementById('reg-company').value : null,
        inn: role === 'legal' ? document.getElementById('reg-inn').value : null,
        ogrn: role === 'legal' ? document.getElementById('reg-ogrn').value : null,
        address_jur: role === 'legal' ? document.getElementById('reg-address').value : null
    };

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) {
            showLoader(true);
            setTimeout(() => {
                hideLoader();
                alert('Регистрация успешна! Теперь войдите.');
                closeModal();
            }, 1500);
        } else {
            hideLoader();
            showError(errorDiv, result.message || 'Ошибка регистрации');
        }
    } catch (err) {
        hideLoader();
        showError(errorDiv, 'Ошибка соединения с сервером');
    }
    return false;
}

function logout() {
    localStorage.removeItem('loggedInUser');
    loggedInUser = null;
    showProfileDisplay();
    location.reload();
}

// ==================== ОТОБРАЖЕНИЕ ПРОФИЛЯ ====================
function showProfileDisplay() {
    const authLinksSidenav = document.getElementById('auth-links-sidenav');
    const profileSidenav = document.getElementById('profile-sidenav');
    const profileNameSidenavSpan = document.getElementById('profileNameSidenav');
    const profileImageSidenavElem = document.getElementById('profileImageSidenav');
    const adminLink = document.querySelector('.sidenav a[href="admin.html"]');

    if (loggedInUser) {
        if (profileNameSidenavSpan) profileNameSidenavSpan.textContent = loggedInUser.username;
        if (profileImageSidenavElem) {
            profileImageSidenavElem.src = loggedInUser.avatar || defaultAvatar;
        }
        if (authLinksSidenav) authLinksSidenav.style.display = 'none';
        if (profileSidenav) profileSidenav.style.display = 'flex';
        if (adminLink) adminLink.style.display = loggedInUser.role === 'admin' ? 'block' : 'none';
        document.body.classList.add('logged-in');
    } else {
        if (authLinksSidenav) authLinksSidenav.style.display = 'block';
        if (profileSidenav) profileSidenav.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
        document.body.classList.remove('logged-in');
    }
}

// ==================== НАСТРОЙКИ ПРОФИЛЯ ====================
function handleProfileImageUpload(event) {
    const file = event.target.files[0];
    if (file && loggedInUser) {
        if (file.size > 2 * 1024 * 1024) {
            alert('Файл слишком большой. Максимум 2MB.');
            event.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const newAvatar = e.target.result;
            loggedInUser.avatar = newAvatar;
            updateLoggedInUserStorage();
            const userIndex = users.findIndex(u => u.username === loggedInUser.username);
            if (userIndex !== -1) users[userIndex].avatar = newAvatar;
            updateUsersStorage();
            document.getElementById('profileImageSidenav').src = newAvatar;
        };
        reader.readAsDataURL(file);
    }
}

function openProfileSettings() {
    if (!loggedInUser) return;
    openModal(`
        <h2>Настройки профиля</h2>
        <form id="profile-settings-form" onsubmit="return saveProfileSettings(event)">
            <div style="text-align:center; margin-bottom:1rem;">
                <img id="profileImageModal" src="${loggedInUser.avatar || defaultAvatar}" alt="Аватар" style="width:80px; height:80px; border-radius:50%; object-fit:cover;">
                <input type="file" id="profileImageUploadModal" accept="image/*" style="display:none;">
                <button type="button" class="btn-secondary" style="font-size:0.8rem;" onclick="document.getElementById('profileImageUploadModal').click()">Сменить фото</button>
            </div>
            <div class="form-group"><label>Имя пользователя</label><input type="text" id="settings-username" value="${loggedInUser.username}" required></div>
            <div class="form-group"><label>Email</label><input type="email" id="settings-email" value="${loggedInUser.email}" required></div>
            <div class="form-group"><label>Новый пароль</label><input type="password" id="settings-new-pass" minlength="8" pattern="^(?=.*\\d).{8,}$"></div>
            <div class="form-group"><label>Текущий пароль</label><input type="password" id="settings-current-pass" required></div>
            <button class="btn-main" type="submit">Сохранить</button>
        </form>
        <div id="settings-feedback" style="display:none; margin-top:1rem;"></div>
    `);
    const uploadInput = document.getElementById('profileImageUploadModal');
    if (uploadInput) uploadInput.onchange = handleProfileImageUpload;
}

async function saveProfileSettings(e) {
    e.preventDefault();
    const currentPass = document.getElementById('settings-current-pass').value;
    const newUsername = document.getElementById('settings-username').value.trim();
    const newEmail = document.getElementById('settings-email').value.trim().toLowerCase();
    const newPass = document.getElementById('settings-new-pass').value;
    const feedback = document.getElementById('settings-feedback');

    if (!currentPass) {
        showError(feedback, 'Введите текущий пароль.', 'error-message');
        return false;
    }

    const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loggedInUser.username, password: currentPass })
    });
    const loginData = await loginResponse.json();
    if (!loginData.success) {
        showError(feedback, 'Неверный текущий пароль.', 'error-message');
        return false;
    }

    const updates = {};
    if (newUsername !== loggedInUser.username) updates.username = newUsername;
    if (newEmail !== loggedInUser.email) updates.email = newEmail;
    if (newPass) updates.password = newPass;

    if (Object.keys(updates).length === 0) {
        showError(feedback, 'Нет изменений.', 'success');
        return false;
    }

    const response = await fetch('/api/auth/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: loggedInUser.id, ...updates })
    });
    const result = await response.json();
    if (result.success) {
        loggedInUser = { ...loggedInUser, ...result.user };
        updateLoggedInUserStorage();
        showProfileDisplay();
        showError(feedback, 'Изменения сохранены.', 'success');
        setTimeout(closeModal, 1500);
    } else {
        showError(feedback, result.message || 'Ошибка сохранения.', 'error-message');
    }
    return false;
}

// ==================== КАЛЬКУЛЯТОР ====================
function calcTyres(e) {
    e.preventDefault();
    const weightInput = document.getElementById('tyre-weight');
    const resultDiv = document.getElementById('calc-result');
    if (!weightInput || !resultDiv) return false;
    const w = parseFloat(weightInput.value);
    if (isNaN(w) || w <= 0) {
        resultDiv.innerHTML = 'Пожалуйста, введите корректный вес.';
        resultDiv.style.display = 'block';
        return false;
    }
    const crumb = (w * 0.65).toFixed(1);
    const metal = (w * 0.15).toFixed(1);
    const textile = (w * 0.05).toFixed(1);
    const money = (crumb * 12).toFixed(0);
    resultDiv.innerHTML = `
        Из <strong>${w} кг</strong> шин ориентировочно получится:
        <ul><li><strong>Резиновая крошка:</strong> ${crumb} кг</li>
        <li><strong>Металлокорд:</strong> ${metal} кг</li>
        <li><strong>Текстильный корд:</strong> ${textile} кг</li></ul>
        <p>Примерная выгода от сдачи: <strong>${money} руб.</strong></p>
    `;
    resultDiv.style.display = 'block';
    totalTyresProcessed += w;
    updateStatsDisplay(totalTyresProcessed);
    return false;
}

// ==================== ОТПРАВКА ЗАЯВКИ ====================
async function sendRequest(e) {
    e.preventDefault();
    const form = document.getElementById('request-form-data');
    const resultDiv = document.getElementById('request-result');
    if (!form) return false;

    const weight = parseFloat(document.getElementById('req-weight').value);
    if (weight < 20) {
        if (!confirm('Минимальный вес для вывоза — 20 кг. Вы можете привезти шины сами. Продолжить оформление?')) {
            return false;
        }
    }

    showLoader(false);
    const formData = new URLSearchParams(new FormData(form));
    formData.append('submittedAt', new Date().toISOString());
    if (loggedInUser) formData.append('userId', loggedInUser.id);

    try {
        const response = await fetch('/api/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        if (response.ok) {
            const text = await response.text();
            showLoader(true);
            setTimeout(() => {
                hideLoader();
                showError(resultDiv, text, 'success');
                form.reset();
                setMinDateForRequestForm();
            }, 1500);
        } else {
            hideLoader();
            const err = await response.json();
            showError(resultDiv, err.message || 'Ошибка отправки', 'error-message');
        }
    } catch (err) {
        hideLoader();
        showError(resultDiv, 'Ошибка соединения', 'error-message');
    }
    return false;
}

// ==================== ДАТА/ВРЕМЯ ====================
function setMinDateForRequestForm() {
    const dateInput = document.getElementById('req-date');
    const timeInput = document.getElementById('req-time');
    if (!dateInput) return;
    const today = new Date();
    today.setHours(today.getHours() + 4);
    const yyyy = today.getFullYear();
    let mm = today.getMonth() + 1;
    let dd = today.getDate();
    if (dd < 10) dd = '0' + dd;
    if (mm < 10) mm = '0' + mm;
    dateInput.min = `${yyyy}-${mm}-${dd}`;

    function updateTime() {
        if (!timeInput) return;
        const selected = new Date(dateInput.value);
        if (selected.toDateString() === today.toDateString()) {
            const minTime = new Date(today.getTime() + 3 * 60 * 60 * 1000);
            const hours = minTime.getHours().toString().padStart(2, '0');
            const minutes = minTime.getMinutes().toString().padStart(2, '0');
            timeInput.min = `${hours}:${minutes}`;
        } else {
            timeInput.min = '08:00';
        }
        timeInput.max = '19:00';
    }
    dateInput.addEventListener('change', updateTime);
    updateTime();
}

// ==================== ЧАТ (КЛИЕНТ) ====================
let chatOpen = false;
let currentDialogId = null;

async function initChat() {
    let guestId = localStorage.getItem('guestId');
    if (!guestId) {
        guestId = 'guest_' + Math.random().toString(36).substr(2, 8);
        localStorage.setItem('guestId', guestId);
    }
    // Определяем имя пользователя (если залогинен — берём username)
    let guestName = 'Гость';
    if (loggedInUser && loggedInUser.username) {
        guestName = loggedInUser.username;
    } else {
        guestName = `Гость ${guestId.slice(-5)}`;
    }
    try {
        const res = await fetch('/api/chat/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                guestId, 
                guestName: guestName,
                userId: loggedInUser ? loggedInUser.id : null
            })
        });
        const data = await res.json();
        currentDialogId = data.dialogId;
    } catch (err) {
        console.error('Чат не инициализирован:', err);
    }
}

function toggleChat() {
    const win = document.getElementById('chat-window');
    if (!win) return;
    chatOpen = !chatOpen;
    win.style.display = chatOpen ? 'flex' : 'none';
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    const messagesContainer = document.getElementById('chat-messages');
    
    // Определяем имя пользователя для отображения в админке
    let displayName = 'Гость';
    if (loggedInUser && loggedInUser.username) {
        displayName = loggedInUser.username;
    } else {
        let guestId = localStorage.getItem('guestId');
        if (!guestId) {
            guestId = 'guest_' + Math.random().toString(36).substr(2, 8);
            localStorage.setItem('guestId', guestId);
        }
        displayName = `Гость ${guestId.slice(-5)}`;
    }
    
    const userMsgDiv = document.createElement('div');
    userMsgDiv.className = 'message user';
    userMsgDiv.innerText = message;
    messagesContainer.appendChild(userMsgDiv);
    input.value = '';
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message, 
                userId: loggedInUser ? loggedInUser.id : null, 
                dialogId: currentDialogId,
                userName: displayName
            })
        });
        const data = await response.json();
        const botMsgDiv = document.createElement('div');
        botMsgDiv.className = 'message bot';
        botMsgDiv.innerText = data.reply;
        messagesContainer.appendChild(botMsgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (err) {
        console.error('Ошибка отправки сообщения');
    }
}

async function sendUserFile() {
    const fileInput = document.getElementById('user-chat-file');
    const file = fileInput.files[0];
    if (!file || !currentDialogId) return;
    
    if (!file.type.startsWith('image/')) {
        alert('Можно отправлять только изображения!');
        fileInput.value = '';
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('dialogId', currentDialogId);
    
    try {
        const res = await fetch('/api/chat/user-upload', {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            const msgsContainer = document.getElementById('chat-messages');
            const botMsgDiv = document.createElement('div');
            botMsgDiv.className = 'message bot';
            botMsgDiv.innerHTML = `📷 Фото отправлено оператору`;
            msgsContainer.appendChild(botMsgDiv);
            msgsContainer.scrollTop = msgsContainer.scrollHeight;
        } else {
            alert('Ошибка отправки фото');
        }
    } catch(e) { console.error(e); }
    fileInput.value = '';
}

// ==================== НОВОСТИ ====================
const newsData = [
    {
        image: "https://ss.metronews.ru/userfiles/materials/201/2013191/858x540_e2dade20.jpg",
        title: "В Мособлдуме рассказали о штрафах за утилизацию шин",
        desc: "Отходы IV класса опасности нельзя выбрасывать в обычные контейнеры.",
        date: "4 часа назад",
        link: "https://auto.mail.ru/article/122365-v-mosobldume-rasskazali-kakie-shtrafyi-grozyat-za-nepravilnuyu-utilizatsiyu-shin/"
    },
    {
        image: "https://sgpress.ru/wp-content/uploads/2026/04/f6ee8b00-834b-499f-bff1-a5a51cdc0635-768x512.jpg.webp",
        title: "В Самаре открыли 5 новых пунктов приёма шин",
        desc: "Бесплатный сбор старых автопокрышек организовали на улице Товарной.",
        date: "6 дней назад",
        link: "https://sgpress.ru/news/551908"
    },
    {
        image: "https://govp.info/media/2026/04/6-1.jpg",
        title: "Уральцам напомнили о правильной утилизации шин",
        desc: "С приходом весны во дворах появляются старые покрышки.",
        date: "3 дня назад",
        link: "https://obltv.ru/"
    },
    {
        image: "https://46tv.ru/uploads/posts/2026-04/thumbs/1777034721_1.jpg",
        title: "Омичи сдали на переработку более 25 тонн шин",
        desc: "Экологическая акция прошла в рамках нацпроекта.",
        date: "1 неделя назад",
        link: "https://12-kanal.ru/news/276993/"
    }
];

function renderNews() {
    const container = document.getElementById('news-grid');
    if (!container) return;
    container.innerHTML = newsData.map(news => `
        <div class="news-card" onclick="window.open('${news.link}', '_blank')">
            <img class="news-image" src="${news.image}" alt="новость" onerror="this.src='https://via.placeholder.com/300x140?text=News'">
            <div class="news-content">
                <div class="news-title">${escapeHtml(news.title)}</div>
                <div class="news-meta">${escapeHtml(news.date)}</div>
                <div class="news-desc">${escapeHtml(news.desc)}</div>
            </div>
        </div>
    `).join('');
}

// ==================== СЧЁТЧИК ПОСЕЩЕНИЙ ====================
function initVisitsCounter() {
    let total = parseInt(localStorage.getItem('visits_total') || '0');
    let month = parseInt(localStorage.getItem('visits_month') || '0');
    let today = parseInt(localStorage.getItem('visits_today') || '0');
    const lastDate = localStorage.getItem('visits_date');
    const now = new Date().toDateString();
    if (lastDate !== now) {
        today = 0;
        localStorage.setItem('visits_date', now);
    }
    today++;
    month++;
    total++;
    localStorage.setItem('visits_today', today);
    localStorage.setItem('visits_month', month);
    localStorage.setItem('visits_total', total);
    const todayEl = document.getElementById('visits-today');
    const monthEl = document.getElementById('visits-month');
    const totalEl = document.getElementById('visits-total');
    if (todayEl) todayEl.innerText = today;
    if (monthEl) monthEl.innerText = month;
    if (totalEl) totalEl.innerText = total;
}

// ==================== ЯНДЕКС КАРТЫ ====================
function initYandexMap() {
    const mapContainer = document.getElementById('yandex-map');
    if (!mapContainer || typeof ymaps === 'undefined') return;
    try {
        const myMap = new ymaps.Map(mapContainer, {
            center: [53.281104, 50.413633],
            zoom: 16,
            controls: ['zoomControl', 'fullscreenControl', 'geolocationControl']
        });
        const placemark = new ymaps.Placemark([53.281104, 50.413633], {
            balloonContentHeader: 'EcoShyna',
            balloonContentBody: 'Аграрная улица, 1, пос. Стройкерамика.<br>Пункт приема и переработки шин.',
            balloonContentFooter: 'Ждем вас!'
        }, { preset: 'islands#blueRecyclingIcon' });
        myMap.geoObjects.add(placemark);
    } catch (e) {
        mapContainer.innerHTML = '<p style="color:#c00;">Ошибка загрузки карты</p>';
    }
}

// ==================== КНОПКА НАВЕРХ ====================
const scrollTopBtn = document.getElementById('scrollTopBtn');
if (scrollTopBtn) {
    window.onscroll = () => {
        scrollTopBtn.style.display = document.body.scrollTop > 100 || document.documentElement.scrollTop > 100 ? 'block' : 'none';
    };
}
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', () => {
    showProfileDisplay();
    initVisitsCounter();
    renderNews();
    setMinDateForRequestForm();
    initChat();

    const currentYear = document.getElementById('currentYear');
    if (currentYear) currentYear.textContent = new Date().getFullYear();

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.interactive-section, .interactive-item').forEach(el => observer.observe(el));

    if (typeof ymaps !== 'undefined' && document.getElementById('yandex-map')) {
        ymaps.ready(initYandexMap);
    }
});

// ==================== ЭКСПОРТ ====================
window.openLogin = openLogin;
window.openRegister = openRegister;
window.logout = logout;
window.openProfileSettings = openProfileSettings;
window.calcTyres = calcTyres;
window.sendRequest = sendRequest;
window.toggleChat = toggleChat;
window.sendChatMessage = sendChatMessage;
window.sendUserFile = sendUserFile;
window.scrollToSection = scrollToSection;
window.closeSideNav = closeSideNav;
window.openSideNav = openSideNav;
window.scrollToTop = scrollToTop;
window.toggleLegalFields = toggleLegalFields;
