// Modal Handling
const modalBg = document.getElementById('modal-bg');
const modalContentWrapper = document.getElementById('modal-content-wrapper');

function openModal(htmlContent) {
  if (!modalContentWrapper || !modalBg) return;
  modalContentWrapper.innerHTML = `<div class="modal">${htmlContent}<button class="close-modal" onclick="closeModal()" aria-label="Закрыть модальное окно">×</button></div>`;
  modalBg.classList.add('active');
  modalContentWrapper.classList.add('active');
  document.body.style.overflow = 'hidden';
  modalContentWrapper.querySelector('input, button')?.focus();
}

function closeModal() {
  if (!modalContentWrapper || !modalBg) return;
  modalBg.classList.remove('active');
  modalContentWrapper.classList.remove('active');
  document.body.style.overflow = '';
  setTimeout(() => {
    if (!modalContentWrapper.classList.contains('active')) {
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
  if (event.key === 'Escape' && modalBg?.classList.contains('active')) {
    closeModal();
  }
});

// Side Navigation
function openSideNav() {
  const sideNav = document.getElementById('sideNav');
  if (sideNav) {
    sideNav.style.width = '250px';
    sideNav.focus();
  }
}

function closeSideNav() {
  const sideNav = document.getElementById('sideNav');
  if (sideNav) {
    sideNav.style.width = '0';
  }
}

// Scroll to Section
function scrollToSection(sectionId, isFromSideNav = false) {
  if (isFromSideNav) {
    const targetUrl = `index.html#${sectionId}`;
    const currentPath = window.location.pathname.split('/').pop();
    if (currentPath === 'index.html' || currentPath === '') {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.location.href = targetUrl;
    }
    closeSideNav();
  } else {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

// User Management
let users = JSON.parse(localStorage.getItem('users')) || [];
let loggedInUser = localStorage.getItem('loggedInUser') ? JSON.parse(localStorage.getItem('loggedInUser')) : null;
const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';

function updateUsersStorage() {
  localStorage.setItem('users', JSON.stringify(users));
}

function updateLoggedInUserStorage() {
  localStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
}

// Authentication Modals
function openLogin() {
  openModal(`
    <h2>Вход в аккаунт</h2>
    <form id="login-form" onsubmit="return login(event)">
      <div class="form-group">
        <label for="login-username">Имя пользователя (Логин)</label>
        <input id="login-username" type="text" required autocomplete="username" aria-describedby="login-error">
      </div>
      <div class="form-group">
        <label for="login-pass">Пароль</label>
        <input id="login-pass" type="password" required autocomplete="current-password" aria-describedby="login-error">
      </div>
      <button class="btn-main" type="submit" style="width:100%;">Войти</button>
    </form>
    <div id="login-error" class="request-result error-message" style="display:none;"></div>
  `);
}

function openRegister() {
  openModal(`
    <h2>Регистрация нового пользователя</h2>
    <form id="register-form" onsubmit="return register(event)">
      <div class="form-group">
        <label for="reg-username">Имя пользователя (Логин)</label>
        <input id="reg-username" type="text" required autocomplete="username" aria-describedby="register-error">
      </div>
      <div class="form-group">
        <label for="reg-email">Электронная почта (для связи)</label>
        <input id="reg-email" type="email" required autocomplete="email" aria-describedby="register-error">
      </div>
      <div class="form-group">
        <label for="reg-pass">Пароль (мин. 8 симв, 1 цифра)</label>
        <input id="reg-pass" type="password" minlength="8" pattern="^(?=.*\\d).{8,}$" title="Минимум 8 символов и хотя бы одна цифра" required autocomplete="new-password" aria-describedby="register-error">
      </div>
      <button class="btn-main" type="submit" style="width:100%;">Зарегистрироваться</button>
    </form>
    <div id="register-error" class="request-result error-message" style="display:none;"></div>
  `);
}

function register(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('reg-username');
  const emailInput = document.getElementById('reg-email');
  const passInput = document.getElementById('reg-pass');
  const errorDiv = document.getElementById('register-error');

  const username = usernameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const pass = passInput.value;

  if (!username || !email || !pass) {
    showError(errorDiv, 'Все поля обязательны для заполнения.');
    return false;
  }
  if (users.find(u => u.username === username)) {
    showError(errorDiv, 'Пользователь с таким именем (логином) уже существует.');
    usernameInput.focus();
    return false;
  }
  if (users.find(u => u.email === email)) {
    showError(errorDiv, 'Пользователь с такой почтой уже зарегистрирован.');
    emailInput.focus();
    return false;
  }

  const newUser = { username, email, pass, avatar: defaultAvatar };
  users.push(newUser);
  updateUsersStorage();

  loggedInUser = newUser;
  updateLoggedInUserStorage();

  showProfileDisplay();
  closeModal();
  return false;
}

function login(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('login-username');
  const passInput = document.getElementById('login-pass');
  const errorDiv = document.getElementById('login-error');

  const username = usernameInput.value.trim();
  const pass = passInput.value;

  if (!username || !pass) {
    showError(errorDiv, 'Введите имя пользователя и пароль.');
    usernameInput.focus();
    return false;
  }

  const user = users.find(u => u.username === username && u.pass === pass);

  if (!user) {
    showError(errorDiv, 'Неверное имя пользователя или пароль.');
    usernameInput.focus();
    return false;
  }

  loggedInUser = { ...user };
  if (!loggedInUser.avatar) loggedInUser.avatar = defaultAvatar;
  updateLoggedInUserStorage();

  showProfileDisplay();
  closeModal();
  return false;
}

function logout() {
  localStorage.removeItem('loggedInUser');
  loggedInUser = null;
  showProfileDisplay();
}

function showProfileDisplay() {
  const authLinksSidenav = document.getElementById('auth-links-sidenav');
  const profileSidenav = document.getElementById('profile-sidenav');
  const profileNameSidenavSpan = document.getElementById('profileNameSidenav');
  const profileImageSidenavElem = document.getElementById('profileImageSidenav');

  if (loggedInUser) {
    if (profileNameSidenavSpan) profileNameSidenavSpan.textContent = loggedInUser.username;
    if (profileImageSidenavElem) {
      profileImageSidenavElem.src = loggedInUser.avatar || defaultAvatar;
      profileImageSidenavElem.alt = `Аватар ${loggedInUser.username}`;
    }
    if (authLinksSidenav) authLinksSidenav.style.display = 'none';
    if (profileSidenav) profileSidenav.style.display = 'flex';
    document.body.classList.add('logged-in');
  } else {
    if (authLinksSidenav) authLinksSidenav.style.display = 'block';
    if (profileSidenav) profileSidenav.style.display = 'none';
    document.body.classList.remove('logged-in');
  }
}

// Profile Settings
function handleProfileImageUpload(event) {
  const file = event.target.files[0];
  const targetInputId = event.target.id;

  if (file && loggedInUser) {
    if (file.size > 2 * 1024 * 1024) {
      alert('Файл слишком большой. Пожалуйста, выберите изображение до 2MB.');
      document.getElementById(targetInputId).value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      const newAvatarSrc = e.target.result;
      const modalProfileImage = document.getElementById('profileImageModal');
      if (modalProfileImage) modalProfileImage.src = newAvatarSrc;
      if (document.getElementById('profileImageSidenav')) {
        document.getElementById('profileImageSidenav').src = newAvatarSrc;
      }
      loggedInUser.avatar = newAvatarSrc;
      updateLoggedInUserStorage();
      const userIndex = users.findIndex(u => u.username === loggedInUser.username);
      if (userIndex !== -1) {
        users[userIndex].avatar = newAvatarSrc;
        updateUsersStorage();
      }
    };
    reader.readAsDataURL(file);
  } else {
    document.getElementById(targetInputId).value = '';
  }
}

function openProfileSettings() {
  if (!loggedInUser) return;

  localStorage.setItem('loggedInUser_before_settings_change_temp', JSON.stringify({ username: loggedInUser.username, email: loggedInUser.email }));

  const currentUsername = loggedInUser.username;
  const currentEmail = loggedInUser.email;

  openModal(`
    <h2>Настройки профиля</h2>
    <form id="profile-settings-form" onsubmit="return saveProfileSettings(event)">
      <div class="profile-picture-modal-container" style="text-align:center; margin-bottom:1rem;">
        <img id="profileImageModal" src="${loggedInUser.avatar || defaultAvatar}" alt="Аватар" class="profile-image-round" style="width:80px; height:80px; border-radius:50%; object-fit:cover; margin-bottom:0.5rem; display:block; margin-left:auto; margin-right:auto;">
        <input type="file" id="profileImageUploadModal" accept="image/*" style="display: none;" aria-label="Загрузить новое фото профиля">
        <button type="button" class="btn-secondary" style="font-size:0.8rem; padding:0.4em 0.8em;" onclick="document.getElementById('profileImageUploadModal').click()">Сменить фото</button>
      </div>
      <div class="form-group">
        <label for="settings-username">Имя пользователя (Логин):</label>
        <input type="text" id="settings-username" value="${currentUsername}" required aria-describedby="settings-feedback">
      </div>
      <div class="form-group">
        <label for="settings-email">Email:</label>
        <input type="email" id="settings-email" value="${currentEmail}" required aria-describedby="settings-feedback">
      </div>
      <div class="form-group">
        <label for="settings-new-pass">Новый пароль (оставьте пустым, если не хотите менять):</label>
        <input type="password" id="settings-new-pass" minlength="8" pattern="^(?=.*\\d).{8,}$" title="Минимум 8 символов, 1 цифра" aria-describedby="settings-feedback">
      </div>
      <div class="form-group">
        <label for="settings-current-pass">Текущий пароль (для сохранения изменений):</label>
        <input type="password" id="settings-current-pass" required aria-describedby="settings-feedback">
      </div>
      <button class="btn-main" type="submit" style="width:100%;">Сохранить изменения</button>
    </form>
    <div id="settings-feedback" class="request-result" style="display:none; margin-top:1rem;"></div>
  `);
  const profileImageUploadModalInput = document.getElementById('profileImageUploadModal');
  if (profileImageUploadModalInput) {
    profileImageUploadModalInput.onchange = handleProfileImageUpload;
  }
}

function saveProfileSettings(event) {
  event.preventDefault();
  if (!loggedInUser) return;

  const newUsernameInput = document.getElementById('settings-username');
  const newEmailInput = document.getElementById('settings-email');
  const newPasswordInput = document.getElementById('settings-new-pass');
  const currentPasswordInput = document.getElementById('settings-current-pass');
  const feedbackDiv = document.getElementById('settings-feedback');

  const newUsername = newUsernameInput.value.trim();
  const newEmail = newEmailInput.value.trim().toLowerCase();
  const newPassword = newPasswordInput.value;
  const currentPassword = currentPasswordInput.value;

  if (!currentPassword) {
    showError(feedbackDiv, 'Введите текущий пароль для сохранения изменений.', 'error-message');
    currentPasswordInput.focus();
    return false;
  }
  if (currentPassword !== loggedInUser.pass) {
    showError(feedbackDiv, 'Текущий пароль введен неверно.', 'error-message');
    currentPasswordInput.focus();
    return false;
  }

  let changed = false;
  const oldUserData = JSON.parse(localStorage.getItem('loggedInUser_before_settings_change_temp'));
  const oldUsername = oldUserData ? oldUserData.username : loggedInUser.username;

  if (newUsername && newUsername !== loggedInUser.username) {
    if (users.find(u => u.username === newUsername)) {
      showError(feedbackDiv, 'Это имя пользователя уже занято.', 'error-message');
      newUsernameInput.focus();
      localStorage.removeItem('loggedInUser_before_settings_change_temp');
      return false;
    }
    loggedInUser.username = newUsername;
    changed = true;
  }

  if (newEmail && newEmail !== loggedInUser.email) {
    if (users.find(u => u.email === newEmail && u.username !== loggedInUser.username)) {
      showError(feedbackDiv, 'Этот email уже используется другим пользователем.', 'error-message');
      newEmailInput.focus();
      localStorage.removeItem('loggedInUser_before_settings_change_temp');
      return false;
    }
    loggedInUser.email = newEmail;
    changed = true;
  }

  if (newPassword) {
    loggedInUser.pass = newPassword;
    changed = true;
  }

  if (changed) {
    updateLoggedInUserStorage();
    const userIndexInArray = users.findIndex(u => u.username === oldUsername);
    if (userIndexInArray !== -1) {
      users[userIndexInArray] = { ...loggedInUser };
      updateUsersStorage();
    } else {
      console.error('Не удалось найти пользователя для обновления в массиве users по старому username:', oldUsername);
    }
    showProfileDisplay();
    showError(feedbackDiv, 'Изменения сохранены успешно!', 'success');
    setTimeout(closeModal, 1500);
  } else {
    showError(feedbackDiv, 'Нет изменений для сохранения.', 'success');
  }
  localStorage.removeItem('loggedInUser_before_settings_change_temp');
  return false;
}

// Error Display
function showError(element, message, type = 'error-message') {
  if (!element) return;
  element.textContent = message;
  element.className = `request-result ${type}`;
  element.style.display = 'block';
}

// Calculator
function calcTyres(e) {
  e.preventDefault();
  const weightInput = document.getElementById('tyre-weight');
  const resultDiv = document.getElementById('calc-result');
  const errorDiv = document.getElementById('tyre-weight-error');

  if (!weightInput || !resultDiv || !errorDiv) return false;

  const w = parseFloat(weightInput.value);

  if (isNaN(w) || w < 1) {
    showError(errorDiv, 'Пожалуйста, введите корректный вес (минимум 1 кг).');
    weightInput.focus();
    resultDiv.style.display = 'none';
    return false;
  }

  if (w < 20) {
    showError(errorDiv, 'Для вывоза на дом требуется минимум 20 кг. Вы можете сдать любое количество шин, приехав к нам.');
  } else {
    errorDiv.style.display = 'none';
  }

  const crumb = (w * 0.65).toFixed(1);
  const metal = (w * 0.15).toFixed(1);
  const textile = (w * 0.05).toFixed(1);
  const money = (crumb * 12).toFixed(0);

  resultDiv.innerHTML = `
    Из <strong>${w} кг</strong> шин ориентировочно получится:
    <ul>
      <li><strong>Резиновая крошка:</strong> ${crumb} кг</li>
      <li><strong>Металлокорд:</strong> ${metal} кг</li>
      <li><strong>Текстильный корд:</strong> ${textile} кг</li>
    </ul>
    <p>Примерная выгода от сдачи: <strong>${money} руб.</strong> (Расчет является ориентировочным)</p>
  `;
  resultDiv.style.display = 'block';

  let currentTotalWeight = parseInt(localStorage.getItem('totalTyresProcessed') || '0');
  currentTotalWeight += w;
  localStorage.setItem('totalTyresProcessed', currentTotalWeight.toString());
  updateStatsDisplay(currentTotalWeight);
  return false;
}

// Request Form
function sendRequest(e) {
  e.preventDefault();
  const form = document.getElementById('request-form-data');
  const resultDiv = document.getElementById('request-result');
  const weightInput = document.getElementById('req-weight');
  const weightErrorDiv = document.getElementById('req-weight-error');
  const dateInput = document.getElementById('req-date');
  const timeInput = document.getElementById('req-time');
  const dateErrorDiv = document.getElementById('req-date-error');
  const timeErrorDiv = document.getElementById('req-time-error');
  const nameInput = document.getElementById('req-name');
  const phoneInput = document.getElementById('req-phone');
  const cityInput = document.getElementById('req-city');
  const streetInput = document.getElementById('req-street');
  const houseInput = document.getElementById('req-house');
  const nameErrorDiv = document.getElementById('req-name-error');
  const phoneErrorDiv = document.getElementById('req-phone-error');
  const cityErrorDiv = document.getElementById('req-city-error');
  const streetErrorDiv = document.getElementById('req-street-error');
  const houseErrorDiv = document.getElementById('req-house-error');

  if (!form || !resultDiv) {
    console.error("Форма или контейнер результата не найдены.");
    return false;
  }

  // Clear previous errors
  [weightErrorDiv, dateErrorDiv, timeErrorDiv, nameErrorDiv, phoneErrorDiv, cityErrorDiv, streetErrorDiv, houseErrorDiv].forEach(div => {
    if (div) div.style.display = 'none';
  });

  // Validate inputs
  let hasError = false;
  if (!nameInput.value.trim()) {
    showError(nameErrorDiv, 'Введите ваше ФИО.');
    nameInput.focus();
    hasError = true;
  }
  if (!phoneInput.value.trim()) {
    showError(phoneErrorDiv, 'Введите номер телефона.');
    phoneInput.focus();
    hasError = true;
  } else if (!phoneInput.value.match(/\+?[0-9\s\-\(\)]+/)) {
    showError(phoneErrorDiv, 'Введите корректный номер телефона.');
    phoneInput.focus();
    hasError = true;
  }
  if (!cityInput.value.trim()) {
    showError(cityErrorDiv, 'Введите город.');
    cityInput.focus();
    hasError = true;
  }
  if (!streetInput.value.trim()) {
    showError(streetErrorDiv, 'Введите улицу.');
    streetInput.focus();
    hasError = true;
  }
  if (!houseInput.value.trim()) {
    showError(houseErrorDiv, 'Введите номер дома.');
    houseInput.focus();
    hasError = true;
  }

  const weight = parseFloat(weightInput.value);
  if (isNaN(weight) || weight < 1) {
    showError(weightErrorDiv, 'Введите корректный вес (минимум 1 кг).');
    weightInput.focus();
    hasError = true;
  } else if (weight < 20) {
    showError(weightErrorDiv, 'Для вывоза на дом требуется минимум 20 кг. Вы можете сдать любое количество шин, приехав к нам.');
  }

  const selectedDate = new Date(dateInput.value);
  const today = new Date();
  today.setHours(today.getHours() + 4); // Adjust to Samara time (UTC+4)
  const minDate = new Date(today);
  minDate.setHours(minDate.getHours() + 3); // 3-hour buffer

  if (!dateInput.value) {
    showError(dateErrorDiv, 'Выберите дату вывоза.');
    dateInput.focus();
    hasError = true;
  } else if (selectedDate.toDateString() === today.toDateString() && selectedDate < minDate) {
    showError(dateErrorDiv, 'На сегодня можно выбрать время не ранее чем через 3 часа от текущего времени.');
    dateInput.focus();
    hasError = true;
  }

  if (!timeInput.value) {
    showError(timeErrorDiv, 'Выберите время вывоза.');
    timeInput.focus();
    hasError = true;
  } else {
    const [hours, minutes] = timeInput.value.split(':').map(Number);
    if (hours > 19 || (hours === 19 && minutes > 0)) {
      showError(timeErrorDiv, 'Время вывоза не может быть позже 19:00.');
      timeInput.focus();
      hasError = true;
    } else if (selectedDate.toDateString() === today.toDateString()) {
      const selectedTime = new Date();
      selectedTime.setHours(hours, minutes, 0, 0);
      if (selectedTime < minDate) {
        showError(timeErrorDiv, 'Выберите время не ранее чем через 3 часа от текущего времени.');
        timeInput.focus();
        hasError = true;
      }
    }
  }

  if (hasError) return false;

  // Set submission timestamp
  const submittedAtInput = document.getElementById('req-submittedAt');
  submittedAtInput.value = new Date().toISOString();

  const formData = new URLSearchParams(new FormData(form));

  fetch('/api/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData
  })
  .then(response => {
    if (!response.ok) {
      return response.json().then(err => { throw new Error(err.errors?.[0]?.msg || 'Ошибка отправки запроса'); });
    }
    return response.text();
  })
  .then(data => {
    showError(resultDiv, data, 'success');
    form.reset();
    setMinDateForRequestForm();
  })
  .catch(error => {
    showError(resultDiv, error.message || 'Произошла ошибка.', 'error-message');
  });
  return false;
}

// Stats Display
function updateStatsDisplay(value) {
  const statElement = document.getElementById('stat-tyres');
  if (statElement) statElement.textContent = value.toString();
}

// Scroll to Top
const scrollTopBtn = document.getElementById('scrollTopBtn');
if (scrollTopBtn) {
  window.onscroll = function() {
    if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
      scrollTopBtn.style.display = 'block';
    } else {
      scrollTopBtn.style.display = 'none';
    }
  };
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Intersection Observer for Animations
function observeElements() {
  const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
  const observerCallback = (entries, observer) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        if (entry.target.matches('.step, .product-item, .review-item')) {
          entry.target.style.setProperty('--item-index', (index % 3).toString());
        }
        observer.unobserve(entry.target);
      }
    });
  };
  const observer = new IntersectionObserver(observerCallback, observerOptions);
  const elementsToObserve = document.querySelectorAll('.interactive-section, .interactive-item');
  elementsToObserve.forEach(el => observer.observe(el));
}

// Date and Time Restrictions
function setMinDateForRequestForm() {
  const dateInput = document.getElementById('req-date');
  const timeInput = document.getElementById('req-time');
  if (!dateInput || !timeInput) return;

  const today = new Date();
  today.setHours(today.getHours() + 4); // Samara time (UTC+4)
  const yyyy = today.getFullYear();
  let mm = today.getMonth() + 1;
  let dd = today.getDate();

  if (dd < 10) dd = '0' + dd;
  if (mm < 10) mm = '0' + mm;

  const formattedToday = `${yyyy}-${mm}-${dd}`;
  dateInput.setAttribute('min', formattedToday);

  function updateTimeRestrictions() {
    const selectedDate = new Date(dateInput.value);
    timeInput.removeAttribute('min');
    timeInput.removeAttribute('max');

    if (selectedDate.toDateString() === today.toDateString()) {
      const minTime = new Date(today.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
      const hours = minTime.getHours().toString().padStart(2, '0');
      const minutes = minTime.getMinutes().toString().padStart(2, '0');
      timeInput.setAttribute('min', `${hours}:${minutes}`);
    }
    timeInput.setAttribute('max', '19:00');
  }

  dateInput.addEventListener('change', updateTimeRestrictions);
  updateTimeRestrictions();
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  showProfileDisplay();

  const initialTotalWeight = parseInt(localStorage.getItem('totalTyresProcessed') || '0');
  updateStatsDisplay(initialTotalWeight);

  const currentYearEl = document.getElementById('currentYear');
  if (currentYearEl) currentYearEl.textContent = new Date().getFullYear().toString();

  if (typeof ymaps !== 'undefined' && document.getElementById('yandex-map')) {
    ymaps.ready(initYandexMap);
  } else if (document.getElementById('yandex-map')) {
    const mapContainer = document.getElementById('yandex-map');
    mapContainer.innerHTML = '<p style="text-align:center; padding-top:20px; color: #cc0000;">Ошибка: API Яндекс.Карт не загружен. Проверьте подключение скрипта и API ключ.</p>';
  }

  observeElements();
  setMinDateForRequestForm();

  if (window.location.hash) {
    const sectionId = window.location.hash.substring(1);
    const element = document.getElementById(sectionId);
    if (element) {
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }
});

// Yandex Maps
function initYandexMap() {
  const mapContainer = document.getElementById('yandex-map');
  if (!mapContainer || typeof ymaps === 'undefined') return;
  try {
    const myMap = new ymaps.Map(mapContainer, {
      center: [53.281104, 50.413633],
      zoom: 16,
      controls: ['zoomControl', 'fullscreenControl', 'geolocationControl', 'trafficControl', 'typeSelector']
    });
    const placemark = new ymaps.Placemark([53.281104, 50.413633], {
      balloonContentHeader: 'EcoShyna',
      balloonContentBody: 'Аграрная улица, 1, пос. Стройкерамика.<br>Пункт приема и переработки шин.',
      balloonContentFooter: 'Ждем вас!',
      hintContent: 'EcoShyna - Переработка шин'
    }, {
      preset: 'islands#blueRecyclingIcon'
    });
    myMap.geoObjects.add(placemark);
  } catch (e) {
    console.error('Ошибка инициализации Яндекс.Карты:', e);
    mapContainer.innerHTML = '<p style="text-align:center; padding-top:20px; color: #cc0000;">Не удалось загрузить карту. Проверьте API ключ и подключение к интернету.</p>';
  }
}