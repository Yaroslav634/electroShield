// orders.js

const API_BASE_URL = window.location.origin.includes("localhost")
  ? `http://localhost:${window.location.port || 3001}/api`
  : "/api";

let currentUser = null;
let allOrders = [];
let filteredOrders = [];
let currentStatusFilter = 'all';
let currentSearchTerm = '';
let currentDateFrom = '';
let currentDateTo = '';

document.addEventListener("DOMContentLoaded", async () => {
  initThemeToggle();
  await checkAuth();
  await loadOrders();
  setupEventListeners();
});

function initThemeToggle() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      if (isDark) {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("theme", "light");
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
      }
    });
  }
}

function setupEventListeners() {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      currentSearchTerm = searchInput.value.toLowerCase();
      applyFilters();
    });
  }
  const applyBtn = document.getElementById("applyFiltersBtn");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      currentStatusFilter = document.getElementById("statusFilter").value;
      currentDateFrom = document.getElementById("dateFrom").value;
      currentDateTo = document.getElementById("dateTo").value;
      applyFilters();
      updateActiveStatCard(currentStatusFilter);
    });
  }
  const resetBtn = document.getElementById("resetFiltersBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetFilters);
  }
  document.querySelectorAll(".stat-card").forEach(card => {
    card.addEventListener("click", () => {
      const status = card.dataset.status;
      currentStatusFilter = status;
      document.getElementById("statusFilter").value = status;
      applyFilters();
      updateActiveStatCard(status);
    });
  });
}

function updateActiveStatCard(status) {
  document.querySelectorAll(".stat-card").forEach(c => c.classList.remove("active"));
  const activeCard = document.querySelector(`.stat-card[data-status="${status}"]`);
  if (activeCard) activeCard.classList.add("active");
}

async function checkAuth() {
  try {
    const response = await fetch(`${API_BASE_URL}/me`, { credentials: "include" });
    const data = await response.json();
    if (data.success && data.authenticated) {
      currentUser = data.user;
      updateAuthUI();
      return true;
    } else {
      currentUser = null;
      updateAuthUI();
      return false;
    }
  } catch (error) {
    console.error("Ошибка авторизации:", error);
    currentUser = null;
    updateAuthUI();
    return false;
  }
}

function updateAuthUI() {
  const authSection = document.getElementById("authSection");
  if (!authSection) return;
  if (currentUser) {
    let roleText = "Пользователь";
    let roleColor = "#3b82f6";
    if (currentUser.role === "admin") {
      roleText = "Админ";
      roleColor = "#ef4444";
    } else if (currentUser.role === "manager") {
      roleText = "Менеджер";
      roleColor = "#f59e0b";
    }
    authSection.innerHTML = `
      <div class="user-menu" style="display: flex; align-items: center; gap: 15px; background: rgba(255,255,255,0.08); padding: 6px 20px 6px 16px; border-radius: 50px;">
        <span><i class="fas fa-user"></i> ${escapeHtml(currentUser.full_name || currentUser.username)}</span>
        <span class="role-badge" style="background: ${roleColor}; color: white; padding: 5px 12px; border-radius: 30px; font-size: 0.75rem;">${roleText}</span>
        ${currentUser.role === "admin" || currentUser.role === "manager" ? `<a href="/admin.html" class="nav-link" style="color: white; background: rgba(59,130,246,0.2); padding: 6px 14px; border-radius: 30px;"><i class="fas fa-cog"></i> Админка</a>` : ""}
        <button onclick="logout()" class="logout-btn" style="background: #ef4444; color: white; border: none; padding: 6px 14px; border-radius: 30px; cursor: pointer;">
          <i class="fas fa-sign-out-alt"></i> Выйти
        </button>
      </div>
    `;
  } else {
    authSection.innerHTML = `
      <div class="auth-buttons-modern">
        <button class="btn-login" onclick="showLoginModal()"><i class="fas fa-sign-in-alt"></i><span>Вход</span></button>
        <button class="btn-register" onclick="showRegisterModal()"><i class="fas fa-user-plus"></i><span>Регистрация</span></button>
      </div>
    `;
  }
}

async function logout() {
  try {
    await fetch(`${API_BASE_URL}/logout`, { method: "POST", credentials: "include" });
    window.location.href = "/";
  } catch (error) {
    showNotification("Ошибка при выходе", "error");
  }
}

async function loadOrders() {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/my-orders`, { credentials: "include" });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    allOrders = await response.json();
    
    // Нормализация сумм в заказах - защита от NaN
    allOrders = allOrders.map(order => ({
      ...order,
      final_amount: parseFloat(order.final_amount) || parseFloat(order.total_amount) || 0,
      total_amount: parseFloat(order.total_amount) || parseFloat(order.final_amount) || 0
    }));
    
    updateStats();
    applyFilters();
  } catch (error) {
    console.error("Ошибка загрузки заказов:", error);
    allOrders = [];
  } finally {
    showLoading(false);
  }
}

function updateStats() {
  const stats = {
    all: allOrders.length,
    new: allOrders.filter(o => o.status === "new").length,
    processing: allOrders.filter(o => ["processing", "confirmed", "manufacturing", "ready", "delivered"].includes(o.status)).length,
    completed: allOrders.filter(o => o.status === "completed").length
  };
  document.getElementById("statAll").textContent = stats.all;
  document.getElementById("statNew").textContent = stats.new;
  document.getElementById("statProcessing").textContent = stats.processing;
  document.getElementById("statCompleted").textContent = stats.completed;
}

function applyFilters() {
  if (!allOrders.length) {
    filteredOrders = [];
    renderOrders();
    return;
  }
  filteredOrders = allOrders.filter(order => {
    if (currentStatusFilter !== 'all') {
      if (currentStatusFilter === 'processing') {
        if (!["processing", "confirmed", "manufacturing", "ready", "delivered"].includes(order.status)) return false;
      } else if (order.status !== currentStatusFilter) return false;
    }
    if (currentSearchTerm) {
      const searchable = `${order.order_number} ${order.customer_name} ${order.customer_phone || ''} ${order.customer_email || ''}`.toLowerCase();
      if (!searchable.includes(currentSearchTerm)) return false;
    }
    if (currentDateFrom && order.created_at) {
      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      if (orderDate < currentDateFrom) return false;
    }
    if (currentDateTo && order.created_at) {
      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      if (orderDate > currentDateTo) return false;
    }
    return true;
  });
  renderOrders();
}

function resetFilters() {
  currentStatusFilter = 'all';
  currentSearchTerm = '';
  currentDateFrom = '';
  currentDateTo = '';
  document.getElementById("searchInput").value = '';
  document.getElementById("statusFilter").value = 'all';
  document.getElementById("dateFrom").value = '';
  document.getElementById("dateTo").value = '';
  updateActiveStatCard('all');
  applyFilters();
  showNotification("Фильтры сброшены", "info");
}

function renderOrders() {
  const container = document.getElementById("ordersList");
  const emptyState = document.getElementById("emptyState");
  if (!container) return;
  if (!currentUser) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-lock"></i>
        <h3>Необходима авторизация</h3>
        <p>Войдите в аккаунт, чтобы просмотреть свои заказы</p>
        <button class="btn btn-primary" onclick="showLoginModal()" style="margin-top: 20px;"><i class="fas fa-sign-in-alt"></i> Войти</button>
      </div>
    `;
    if (emptyState) emptyState.style.display = "none";
    return;
  }
  if (filteredOrders.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = "block";
    return;
  }
  if (emptyState) emptyState.style.display = "none";
  container.innerHTML = filteredOrders.map(order => createOrderCard(order)).join("");
}

function getStatusClass(status) {
  const map = { new: "status-new", processing: "status-processing", confirmed: "status-processing", manufacturing: "status-processing", ready: "status-processing", delivered: "status-completed", completed: "status-completed", cancelled: "status-cancelled" };
  return map[status] || "status-new";
}

function getStatusText(status) {
  const map = { new: "Новый", processing: "В обработке", confirmed: "Подтверждён", manufacturing: "В производстве", ready: "Готов к выдаче", delivered: "Доставлен", completed: "Выполнен", cancelled: "Отменён" };
  return map[status] || status;
}

function getProgressPercent(status) {
  const map = { new: 10, processing: 30, confirmed: 45, manufacturing: 60, ready: 75, delivered: 90, completed: 100, cancelled: 100 };
  return map[status] || 0;
}

// ИСПРАВЛЕННАЯ функция createOrderCard - без NaN и с одинаковыми кнопками
function createOrderCard(order) {
  // Безопасное получение суммы - защита от NaN
  let total = 0;
  if (order.final_amount !== undefined && order.final_amount !== null && !isNaN(parseFloat(order.final_amount))) {
    total = parseFloat(order.final_amount);
  } else if (order.total_amount !== undefined && order.total_amount !== null && !isNaN(parseFloat(order.total_amount))) {
    total = parseFloat(order.total_amount);
  }
  
  const statusClass = getStatusClass(order.status);
  const statusText = getStatusText(order.status);
  const progressPercent = getProgressPercent(order.status);
  
  // Безопасное форматирование даты
  let formattedDate = "Дата не указана";
  if (order.created_at) {
    try {
      const createdDate = new Date(order.created_at);
      if (!isNaN(createdDate.getTime())) {
        formattedDate = createdDate.toLocaleDateString("ru-RU", { 
          day: "numeric", 
          month: "long", 
          year: "numeric" 
        });
      }
    } catch(e) {
      formattedDate = "Дата не указана";
    }
  }
  
  // Безопасное получение инициалов
  let initials = "??";
  if (order.customer_name && order.customer_name.trim()) {
    const nameParts = order.customer_name.trim().split(' ');
    initials = nameParts.map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  
  let progressColor = "#3b82f6";
  if (order.status === "completed") progressColor = "#10b981";
  if (order.status === "cancelled") progressColor = "#ef4444";
  if (["processing", "confirmed", "manufacturing", "ready", "delivered"].includes(order.status)) progressColor = "#f59e0b";
  
  // Форматирование суммы с защитой от NaN
  const formattedTotal = !isNaN(total) && total > 0 
    ? new Intl.NumberFormat("ru-RU").format(total) + " ₽"
    : "0 ₽";
  
  return `
    <div class="order-card" data-order-id="${order.id}">
      <div class="order-card-header">
        <div class="order-number">
          <span class="number"><i class="fas fa-receipt"></i> ${escapeHtml(order.order_number || "Нет номера")}</span>
          <span class="date"><i class="far fa-calendar-alt"></i> ${formattedDate}</span>
        </div>
        <span class="order-status ${statusClass}">${statusText}</span>
      </div>
      <div class="order-card-body">
        <div class="customer-info">
          <div class="customer-avatar"><span>${escapeHtml(initials)}</span></div>
          <div class="customer-details">
            <h4>${escapeHtml(order.customer_name || "Клиент")}</h4>
            ${order.customer_phone ? `<p><i class="fas fa-phone"></i> ${escapeHtml(order.customer_phone)}</p>` : ''}
          </div>
        </div>
        <div class="progress-section">
          <div class="progress-label"><span>Выполнение заказа</span><span>${progressPercent}%</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width: ${progressPercent}%; background: ${progressColor};"></div></div>
        </div>
        <div class="info-row"><i class="fas fa-truck"></i><span>${order.delivery_method === "pickup" ? "Самовывоз" : "Доставка"}</span></div>
        <div class="info-row"><i class="fas fa-credit-card"></i><span>${order.payment_method === "cash" ? "Наличные" : order.payment_method === "card" ? "Карта" : "По счету"}</span></div>
        <div class="total-section">
          <span class="total-label">Итого:</span>
          <span class="total-value">${formattedTotal}</span>
        </div>
      </div>
      <div class="order-card-actions">
        <button class="btn-action btn-view" onclick="viewOrder(${order.id})"><i class="fas fa-eye"></i> Детали</button>
        <button class="btn-action btn-repeat" onclick="repeatOrder(${order.id})"><i class="fas fa-redo-alt"></i> Повторить</button>
        <button class="btn-action btn-track" onclick="trackOrder(${order.id})"><i class="fas fa-map-marker-alt"></i> Отследить</button>
      </div>
    </div>
  `;
}

// ============ ФУНКЦИЯ ДЕТАЛИ ============
async function viewOrder(orderId) {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, { credentials: "include" });
    const data = await response.json();
    if (data.success) {
      showOrderDetailsModal(data);
    } else {
      showNotification("Ошибка загрузки заказа", "error");
    }
  } catch (error) {
    console.error("Ошибка:", error);
    showNotification("Ошибка при загрузке деталей заказа", "error");
  } finally {
    showLoading(false);
  }
}

function showOrderDetailsModal(data) {
  const order = data.order;
  const components = data.components || [];
  const services = data.services || [];
  let total = 0;
  let itemsHtml = '';
  
  components.forEach(item => {
    const sum = item.total_price || item.unit_price * item.quantity;
    total += sum;
    itemsHtml += `<tr><td>${escapeHtml(item.name)}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:right">${new Intl.NumberFormat("ru-RU").format(item.unit_price)} ₽</td><td style="text-align:right">${new Intl.NumberFormat("ru-RU").format(sum)} ₽</td></tr>`;
  });
  
  services.forEach(item => {
    const sum = item.total_price || item.unit_price;
    total += sum;
    itemsHtml += `<tr style="background: var(--primary-light);"><td><i class="fas fa-tools"></i> ${escapeHtml(item.name)}</td><td style="text-align:center">1</td><td style="text-align:right">${new Intl.NumberFormat("ru-RU").format(item.unit_price)} ₽</td><td style="text-align:right">${new Intl.NumberFormat("ru-RU").format(sum)} ₽</td></tr>`;
  });
  
  const statuses = [
    { key: "new", name: "Новый", icon: "fa-clock" },
    { key: "processing", name: "В обработке", icon: "fa-spinner" },
    { key: "confirmed", name: "Подтверждён", icon: "fa-check-circle" },
    { key: "manufacturing", name: "В производстве", icon: "fa-industry" },
    { key: "ready", name: "Готов к выдаче", icon: "fa-box" },
    { key: "delivered", name: "Доставлен", icon: "fa-truck" },
    { key: "completed", name: "Выполнен", icon: "fa-check-double" }
  ];
  
  const currentStatusIndex = statuses.findIndex(s => s.key === order.status);
  let timelineHtml = '<div class="order-timeline">';
  statuses.forEach((status, index) => {
    let statusClass = '';
    if (index < currentStatusIndex) statusClass = 'completed';
    else if (index === currentStatusIndex) statusClass = 'active';
    else statusClass = 'pending';
    timelineHtml += `<div class="timeline-step ${statusClass}"><div class="timeline-dot">${index < currentStatusIndex ? '<i class="fas fa-check"></i>' : `<i class="${status.icon}"></i>`}</div><div class="timeline-label">${status.name}</div></div>`;
  });
  timelineHtml += '</div>';
  
  const modalHtml = `
    <div id="orderDetailsModal" class="modal order-details-modal" style="display: flex; z-index: 10000;">
      <div class="modal-content">
        <div class="modal-header"><h2><i class="fas fa-file-invoice"></i> Заказ ${order.order_number}</h2><span class="close" onclick="closeOrderDetailsModal()">&times;</span></div>
        <div class="modal-body">
          <div class="order-details-section"><div style="display: flex; justify-content: space-between; margin-bottom: 15px;"><span class="order-status ${getStatusClass(order.status)}">${getStatusText(order.status)}</span><span style="font-size: 0.8rem; color: var(--text-muted);"><i class="far fa-calendar-alt"></i> ${new Date(order.created_at).toLocaleString("ru-RU")}</span></div>${timelineHtml}</div>
          <div class="order-details-section"><h4><i class="fas fa-user"></i> Информация о клиенте</h4><div class="order-details-grid"><div class="order-details-item"><span class="order-details-label">Имя</span><span class="order-details-value">${escapeHtml(order.customer_name)}</span></div>${order.customer_phone ? `<div class="order-details-item"><span class="order-details-label">Телефон</span><span class="order-details-value">${escapeHtml(order.customer_phone)}</span></div>` : ''}${order.customer_email ? `<div class="order-details-item"><span class="order-details-label">Email</span><span class="order-details-value">${escapeHtml(order.customer_email)}</span></div>` : ''}</div></div>
          <div class="order-details-section"><h4><i class="fas fa-truck"></i> Доставка и оплата</h4><div class="order-details-grid"><div class="order-details-item"><span class="order-details-label">Способ доставки</span><span class="order-details-value">${order.delivery_method === "pickup" ? "🏪 Самовывоз" : "🚚 Доставка"}</span></div>${order.delivery_address ? `<div class="order-details-item"><span class="order-details-label">Адрес доставки</span><span class="order-details-value">${escapeHtml(order.delivery_address)}</span></div>` : ''}<div class="order-details-item"><span class="order-details-label">Способ оплаты</span><span class="order-details-value">${order.payment_method === "cash" ? "💵 Наличные" : order.payment_method === "card" ? "💳 Карта" : "📄 По счету"}</span></div></div></div>
          <div class="order-details-section"><h4><i class="fas fa-list-ul"></i> Состав заказа</h4><table class="order-items-table"><thead><tr><th>Наименование</th><th style="width:60px;text-align:center">Кол-во</th><th style="width:100px;text-align:right">Цена</th><th style="width:100px;text-align:right">Сумма</th></tr></thead><tbody>${itemsHtml}<tr class="total-row"><td colspan="3" style="text-align:right"><strong>ИТОГО:</strong></td><td style="text-align:right"><strong>${new Intl.NumberFormat("ru-RU").format(total)} ₽</strong></td></tr></tbody></table></div>
          ${order.comments ? `<div class="order-details-section"><h4><i class="fas fa-comment"></i> Комментарий клиента</h4><div class="comment-box">${escapeHtml(order.comments)}</div></div>` : ''}
          ${order.manager_comments ? `<div class="order-details-section"><h4><i class="fas fa-comment-dots"></i> Комментарий менеджера</h4><div class="comment-box manager-comment">${escapeHtml(order.manager_comments)}</div></div>` : ''}
        </div>
        <div class="modal-footer"><button class="btn btn-primary" onclick="repeatOrderFromModal(${order.id})"><i class="fas fa-redo-alt"></i> Повторить заказ</button><button class="btn btn-secondary" onclick="closeOrderDetailsModal()">Закрыть</button></div>
      </div>
    </div>
  `;
  const oldModal = document.getElementById("orderDetailsModal");
  if (oldModal) oldModal.remove();
  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

function closeOrderDetailsModal() {
  const modal = document.getElementById("orderDetailsModal");
  if (modal) modal.remove();
}

function repeatOrderFromModal(orderId) {
  closeOrderDetailsModal();
  setTimeout(() => repeatOrder(orderId), 300);
}

// ============ ФУНКЦИЯ ПОВТОРИТЬ С ФОРМОЙ ============
async function repeatOrder(orderId) {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, { credentials: "include" });
    const data = await response.json();
    if (!data.success) { showNotification("Ошибка загрузки заказа", "error"); return; }
    const order = data.order;
    const components = data.components || [];
    if (!currentUser) { showNotification("Авторизуйтесь чтобы повторить заказ", "warning"); showLoginModal(); return; }
    
    let availableComponents = [];
    let unavailableComponents = [];
    
    for (const comp of components) {
      const compResponse = await fetch(`${API_BASE_URL}/components/${comp.component_id}`, { credentials: "include" });
      const compData = await compResponse.json();
      if (compData.success && compData.component.in_stock) {
        availableComponents.push({ id: comp.component_id, name: comp.name, price: comp.unit_price, quantity: comp.quantity, in_stock: true });
      } else {
        unavailableComponents.push({ name: comp.name, in_stock: false });
      }
    }
    showRepeatOrderModal(order, availableComponents, unavailableComponents);
  } catch (error) {
    console.error("Ошибка:", error);
    showNotification("Ошибка при загрузке данных заказа", "error");
  } finally {
    showLoading(false);
  }
}

function showRepeatOrderModal(order, availableComponents, unavailableComponents) {
  const totalAmount = availableComponents.reduce((sum, c) => sum + (c.price * c.quantity), 0);
  let itemsHtml = '';
  
  availableComponents.forEach(comp => {
    itemsHtml += `
      <div class="repeat-item">
        <div class="repeat-item-info">
          <div class="repeat-item-name">${escapeHtml(comp.name)}</div>
          <div class="repeat-item-price">${new Intl.NumberFormat("ru-RU").format(comp.price)} ₽ × ${comp.quantity}</div>
        </div>
        <div class="repeat-item-stock stock-in"><i class="fas fa-check-circle"></i> В наличии</div>
      </div>
    `;
  });
  
  unavailableComponents.forEach(comp => {
    itemsHtml += `
      <div class="repeat-item" style="opacity: 0.6;">
        <div class="repeat-item-info">
          <div class="repeat-item-name">${escapeHtml(comp.name)}</div>
          <div class="repeat-item-price">Недоступен для заказа</div>
        </div>
        <div class="repeat-item-stock stock-out"><i class="fas fa-times-circle"></i> Нет в наличии</div>
      </div>
    `;
  });
  
  const modalHtml = `
    <div id="repeatOrderModal" class="modal repeat-modal" style="display: flex; z-index: 10000;">
      <div class="modal-content">
        <div class="modal-header"><h2><i class="fas fa-redo-alt"></i> Повтор заказа</h2><span class="close" onclick="closeRepeatOrderModal()">&times;</span></div>
        <div class="modal-body">
          <div class="repeat-header"><div class="repeat-header-icon"><i class="fas fa-sync-alt"></i></div><h3>Заказ №${order.order_number}</h3><p>Выберите компоненты для повторения</p></div>
          ${unavailableComponents.length > 0 ? `<div class="repeat-warning"><i class="fas fa-exclamation-triangle"></i><span>${unavailableComponents.length} компонент(ов) временно отсутствуют в наличии</span></div>` : ''}
          <div class="repeat-summary"><div class="repeat-summary-item"><span><i class="fas fa-calendar-alt"></i> Дата создания</span><span>${new Date(order.created_at).toLocaleDateString("ru-RU")}</span></div><div class="repeat-summary-item"><span><i class="fas fa-user"></i> Клиент</span><span>${escapeHtml(order.customer_name)}</span></div></div>
          <div class="repeat-items-list"><strong><i class="fas fa-boxes"></i> Доступные компоненты:</strong><div style="margin-top: 10px;">${itemsHtml}</div></div>
          <div class="repeat-total"><span class="repeat-total-label">Итого к оплате:</span><span class="repeat-total-value">${new Intl.NumberFormat("ru-RU").format(totalAmount)} ₽</span></div>
        </div>
        <div class="modal-footer"><button class="btn-repeat-cancel" onclick="closeRepeatOrderModal()">Отмена</button><button class="btn-repeat-confirm" onclick="confirmRepeatOrder(${order.id})" ${availableComponents.length === 0 ? 'disabled' : ''}><i class="fas fa-cart-plus"></i> Добавить в корзину (${availableComponents.length})</button></div>
      </div>
    </div>
  `;
  const oldModal = document.getElementById("repeatOrderModal");
  if (oldModal) oldModal.remove();
  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

function closeRepeatOrderModal() {
  const modal = document.getElementById("repeatOrderModal");
  if (modal) modal.remove();
}

async function confirmRepeatOrder(orderId) {
  closeRepeatOrderModal();
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, { credentials: "include" });
    const data = await response.json();
    if (!data.success) { showNotification("Ошибка загрузки заказа", "error"); return; }
    const components = data.components || [];
    let addedCount = 0;
    for (const comp of components) {
      const compResponse = await fetch(`${API_BASE_URL}/components/${comp.component_id}`, { credentials: "include" });
      const compData = await compResponse.json();
      if (compData.success && compData.component.in_stock && typeof window.addToCart === 'function') {
        window.addToCart(comp.component_id);
        addedCount++;
      }
    }
    if (typeof window.updateCart === 'function') window.updateCart();
    if (typeof window.updateTotal === 'function') window.updateTotal();
    if (typeof window.updateCartBadge === 'function') window.updateCartBadge();
    if (addedCount > 0) {
      showNotification(`✅ ${addedCount} компонентов добавлено в корзину`, "success");
      setTimeout(() => { if (confirm("Перейти в конфигуратор для оформления заказа?")) { window.location.href = "/#configurator"; } }, 500);
    } else {
      showNotification("❌ Нет доступных компонентов для повторения", "error");
    }
  } catch (error) {
    console.error("Ошибка:", error);
    showNotification("Ошибка при добавлении в корзину", "error");
  } finally {
    showLoading(false);
  }
}

// ============ ФУНКЦИЯ ОТСЛЕДИТЬ ============
async function trackOrder(orderId) {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, { credentials: "include" });
    const data = await response.json();
    if (!data.success) { showNotification("Ошибка загрузки заказа", "error"); return; }
    showTrackOrderModal(data.order);
  } catch (error) {
    console.error("Ошибка:", error);
    showNotification("Ошибка при загрузке данных", "error");
  } finally {
    showLoading(false);
  }
}

function showTrackOrderModal(order) {
  const statusClass = getStatusClass(order.status);
  const statusText = getStatusText(order.status);
  const progressPercent = getProgressPercent(order.status);
  let progressColor = "#3b82f6";
  if (order.status === "completed") progressColor = "#10b981";
  if (order.status === "cancelled") progressColor = "#ef4444";
  if (["processing", "confirmed", "manufacturing", "ready", "delivered"].includes(order.status)) progressColor = "#f59e0b";
  
  const statusDescriptions = {
    new: "Заказ принят и ожидает обработки. Наш менеджер свяжется с вами в ближайшее время.",
    processing: "Заказ находится в обработке. Проверяется наличие компонентов.",
    confirmed: "Заказ подтверждён. Компоненты зарезервированы.",
    manufacturing: "Заказ передан в производство. Изготовление может занять 3-7 дней.",
    ready: "Заказ готов к выдаче. Вы можете забрать его в нашем офисе.",
    delivered: "Заказ доставлен. Благодарим за покупку!",
    completed: "Заказ выполнен. Спасибо, что выбрали нас!",
    cancelled: "Заказ отменён. По всем вопросам обратитесь в поддержку."
  };
  
  const created = new Date(order.created_at);
  const daysMap = { new: 1, processing: 3, confirmed: 5, manufacturing: 7, ready: 10, delivered: 0, completed: 0, cancelled: 0 };
  const days = daysMap[order.status] || 3;
  let expectedDate = "Заказ выполнен";
  if (days > 0) {
    const expected = new Date(created);
    expected.setDate(created.getDate() + days);
    expectedDate = expected.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  }
  
  const modalHtml = `
    <div id="trackOrderModal" class="modal track-modal" style="display: flex; z-index: 10000;">
      <div class="modal-content">
        <div class="modal-header"><h2><i class="fas fa-map-marker-alt"></i> Отслеживание заказа</h2><span class="close" onclick="closeTrackOrderModal()">&times;</span></div>
        <div class="modal-body">
          <div class="track-status"><span class="order-status ${statusClass}" style="font-size: 1rem; padding: 8px 20px;">${statusText}</span></div>
          <div class="track-progress"><div class="progress-label"><span>Выполнение заказа</span><span>${progressPercent}%</span></div><div class="progress-bar"><div class="progress-fill" style="width: ${progressPercent}%; background: ${progressColor};"></div></div></div>
          <div class="track-info"><div style="display: flex; justify-content: space-between; margin-bottom: 10px;"><strong>Номер заказа:</strong><span>${order.order_number}</span></div><div style="display: flex; justify-content: space-between;"><strong>Дата создания:</strong><span>${new Date(order.created_at).toLocaleString("ru-RU")}</span></div></div>
          <div class="track-expected"><i class="fas fa-calendar-check"></i><strong style="display: block; margin-bottom: 5px;">Ожидаемая дата готовности</strong><span style="font-size: 1.1rem;">${expectedDate}</span></div>
          <div style="margin-top: 20px; padding: 12px; background: var(--bg-panel); border-radius: 12px;"><i class="fas fa-info-circle" style="color: var(--primary-color);"></i><span style="font-size: 0.85rem;">${statusDescriptions[order.status] || "Статус заказа уточняется."}</span></div>
        </div>
        <div class="modal-footer"><button class="btn btn-secondary" onclick="closeTrackOrderModal()">Закрыть</button></div>
      </div>
    </div>
  `;
  const oldModal = document.getElementById("trackOrderModal");
  if (oldModal) oldModal.remove();
  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

function closeTrackOrderModal() {
  const modal = document.getElementById("trackOrderModal");
  if (modal) modal.remove();
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function showLoading(show) {
  const loading = document.getElementById("loading");
  if (loading) loading.style.display = show ? "flex" : "none";
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  const icon = type === "success" ? "check-circle" : type === "error" ? "exclamation-circle" : type === "warning" ? "exclamation-triangle" : "info-circle";
  notification.innerHTML = `<i class="fas fa-${icon}"></i> ${escapeHtml(message)}`;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

// Функции авторизации
function showLoginModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.style.display = "flex";
  document.getElementById("loginForm").style.display = "block";
  document.getElementById("registerForm").style.display = "none";
  document.body.style.overflow = "hidden";
}

function showRegisterModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.style.display = "flex";
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("registerForm").style.display = "block";
  document.body.style.overflow = "hidden";
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.style.display = "none";
  document.body.style.overflow = "";
}

function showLoginForm() {
  document.getElementById("loginForm").style.display = "block";
  document.getElementById("registerForm").style.display = "none";
}

function showRegisterForm() {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("registerForm").style.display = "block";
}

async function login() {
  const username = document.getElementById("loginUsername")?.value.trim();
  const password = document.getElementById("loginPassword")?.value;
  if (!username || !password) { showNotification("Заполните все поля", "warning"); return; }
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ username, password }) });
    const data = await response.json();
    if (data.success) {
      closeAuthModal();
      await checkAuth();
      showNotification(`Добро пожаловать, ${data.user.full_name}!`, "success");
      window.location.reload();
    } else {
      showNotification(data.message || "Ошибка входа", "error");
    }
  } catch (error) { showNotification("Ошибка соединения", "error"); }
  finally { showLoading(false); }
}

async function register() {
  const username = document.getElementById("regUsername")?.value.trim();
  const fullName = document.getElementById("regFullName")?.value.trim();
  const email = document.getElementById("regEmail")?.value.trim();
  const phone = document.getElementById("regPhone")?.value.trim();
  const password = document.getElementById("regPassword")?.value;
  const password2 = document.getElementById("regPassword2")?.value;
  const agree = document.getElementById("regAgree")?.checked;
  if (!username || !fullName || !email || !password) { showNotification("Заполните обязательные поля", "warning"); return; }
  if (password.length < 6) { showNotification("Пароль должен быть не менее 6 символов", "warning"); return; }
  if (password !== password2) { showNotification("Пароли не совпадают", "warning"); return; }
  if (!agree) { showNotification("Подтвердите согласие с условиями", "warning"); return; }
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password, email, full_name: fullName, phone: phone || null }) });
    const data = await response.json();
    if (data.success) {
      showNotification("Регистрация успешна! Теперь вы можете войти.", "success");
      showLoginForm();
      document.getElementById("loginUsername").value = username;
    } else {
      showNotification(data.message || "Ошибка регистрации", "error");
    }
  } catch (error) { showNotification("Ошибка соединения", "error"); }
  finally { showLoading(false); }
}

function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
}

// Глобальные функции
window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;
window.closeAuthModal = closeAuthModal;
window.showLoginForm = showLoginForm;
window.showRegisterForm = showRegisterForm;
window.login = login;
window.register = register;
window.togglePassword = togglePassword;
window.logout = logout;
window.viewOrder = viewOrder;
window.repeatOrder = repeatOrder;
window.trackOrder = trackOrder;
window.closeOrderDetailsModal = closeOrderDetailsModal;
window.closeRepeatOrderModal = closeRepeatOrderModal;
window.closeTrackOrderModal = closeTrackOrderModal;