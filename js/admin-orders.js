// admin-orders.js
const API_BASE_URL = window.location.origin.includes("localhost")
  ? `http://localhost:${window.location.port || 3001}/api`
  : "/api";

let currentUser = null;
let orders = [];
let filteredOrders = [];
let currentOrderId = null;
let currentOrderNumber = null;

document.addEventListener("DOMContentLoaded", async () => {
  await checkAuth();
  await loadOrders();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById("searchInput")?.addEventListener("input", () => applyFilters());
  document.getElementById("statusFilter")?.addEventListener("change", () => applyFilters());
  document.getElementById("dateFrom")?.addEventListener("change", () => applyFilters());
  document.getElementById("dateTo")?.addEventListener("change", () => applyFilters());
}

async function checkAuth() {
  try {
    const response = await fetch(`${API_BASE_URL}/me`, { credentials: "include" });
    const data = await response.json();

    if (data.success && data.authenticated) {
      currentUser = data.user;
      if (currentUser.role !== "admin" && currentUser.role !== "manager") {
        window.location.href = "/";
      } else {
        document.getElementById("adminOrdersContent").style.display = "block";
        document.getElementById("userName").textContent = currentUser.full_name;
        document.getElementById("userRole").textContent = currentUser.role === "admin" ? "Админ" : "Менеджер";
      }
    } else {
      window.location.href = "/";
    }
  } catch (error) {
    console.error("Ошибка авторизации:", error);
    window.location.href = "/";
  }
}

async function loadOrders() {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/my-orders`, { credentials: "include" });
    orders = await response.json();
    filteredOrders = [...orders];
    renderOrders();
    updateStats();
  } catch (error) {
    showNotification("Ошибка загрузки заказов", "error");
  } finally {
    showLoading(false);
  }
}

function renderOrders() {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;

  if (!filteredOrders.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-message">Заказы не найдены</td></tr>';
    document.getElementById("ordersCount").textContent = "Найдено: 0";
    return;
  }

  tbody.innerHTML = filteredOrders.map(order => `
    <tr>
      <td><strong>${order.order_number || order.id}</strong></td>
      <td>
        <div class="customer-info">
          <strong>${escapeHtml(order.customer_name)}</strong>
          <small>${escapeHtml(order.customer_phone || "")}</small>
        </div>
      </td>
      <td>${new Date(order.created_at).toLocaleDateString()}</td>
      <td><span class="status-badge ${getStatusClass(order.status)}">${getStatusText(order.status)}</span></td>
      <td><strong>${new Intl.NumberFormat("ru-RU").format(order.final_amount || order.total_amount || 0)} ₽</strong></td>
      <td>
        <div class="action-buttons">
          <button class="action-btn view" onclick="viewOrder('${order.id}')" title="Просмотреть"><i class="fas fa-eye"></i></button>
          <button class="action-btn edit" onclick="editOrder('${order.id}')" title="Редактировать"><i class="fas fa-edit"></i></button>
          <button class="action-btn status" onclick="openStatusModal('${order.id}', '${order.status}', '${order.order_number || order.id}')" title="Изменить статус"><i class="fas fa-sync-alt"></i></button>
          <button class="action-btn delete" onclick="confirmDeleteOrder('${order.id}', '${order.order_number || order.id}')" title="Удалить"><i class="fas fa-trash-alt"></i></button>
        </div>
      </td>
    </tr>
  `).join("");
  document.getElementById("ordersCount").textContent = `Найдено: ${filteredOrders.length}`;
}

function updateStats() {
  document.getElementById("totalOrders").textContent = orders.length;
  document.getElementById("newOrders").textContent = orders.filter(o => o.status === "new").length;
  document.getElementById("processingOrders").textContent = orders.filter(o => ["processing", "confirmed", "manufacturing", "ready", "delivered"].includes(o.status)).length;
  document.getElementById("completedOrders").textContent = orders.filter(o => o.status === "completed").length;
}

function applyFilters() {
  const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
  const status = document.getElementById("statusFilter")?.value || "all";
  const dateFrom = document.getElementById("dateFrom")?.value || "";
  const dateTo = document.getElementById("dateTo")?.value || "";

  filteredOrders = orders.filter(order => {
    if (search && !`${order.order_number} ${order.customer_name} ${order.customer_phone || ""}`.toLowerCase().includes(search)) return false;
    if (status !== "all" && order.status !== status) return false;
    if (dateFrom && new Date(order.created_at).toISOString().split("T")[0] < dateFrom) return false;
    if (dateTo && new Date(order.created_at).toISOString().split("T")[0] > dateTo) return false;
    return true;
  });
  renderOrders();
}

function resetFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("statusFilter").value = "all";
  document.getElementById("dateFrom").value = "";
  document.getElementById("dateTo").value = "";
  filteredOrders = [...orders];
  renderOrders();
  showNotification("Фильтры сброшены", "info");
}

async function viewOrder(id) {
  currentOrderId = id;
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${id}`, { credentials: "include" });
    const data = await response.json();
    if (data.success) {
      currentOrderNumber = data.order.order_number;
      displayOrderDetails(data);
      document.getElementById("viewOrderModal").style.display = "flex";
    }
  } catch (error) {
    showNotification("Ошибка загрузки заказа", "error");
  } finally {
    showLoading(false);
  }
}

function displayOrderDetails(data) {
  const order = data.order;
  const components = data.components || [];
  let total = 0;
  
  let html = `
    <div class="detail-section">
      <h4>Информация о клиенте</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-label">Имя</span><span class="detail-value">${escapeHtml(order.customer_name)}</span></div>
        ${order.customer_phone ? `<div class="detail-item"><span class="detail-label">Телефон</span><span class="detail-value">${escapeHtml(order.customer_phone)}</span></div>` : ""}
        ${order.customer_email ? `<div class="detail-item"><span class="detail-label">Email</span><span class="detail-value">${escapeHtml(order.customer_email)}</span></div>` : ""}
        ${order.customer_address ? `<div class="detail-item"><span class="detail-label">Адрес</span><span class="detail-value">${escapeHtml(order.customer_address)}</span></div>` : ""}
      </div>
    </div>
    <div class="detail-section">
      <h4>Состав заказа</h4>
      <table class="items-table">
        <thead><tr><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead>
        <tbody>
  `;
  
  components.forEach(item => {
    const sum = item.total_price || item.unit_price * item.quantity;
    total += sum;
    html += `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${new Intl.NumberFormat("ru-RU").format(item.unit_price)} ₽</td><td>${new Intl.NumberFormat("ru-RU").format(sum)} ₽</td></tr>`;
  });
  
  html += `
        </tbody>
        <tfoot><tr class="total-row"><td colspan="3"><strong>ИТОГО:</strong></td><td><strong>${new Intl.NumberFormat("ru-RU").format(total)} ₽</strong></td></tr></tfoot>
      </table>
    </div>
  `;
  
  if (order.comments) html += `<div class="detail-section"><h4>Комментарий клиента</h4><div class="comment-box">${escapeHtml(order.comments)}</div></div>`;
  if (order.manager_comments) html += `<div class="detail-section"><h4>Комментарий менеджера</h4><div class="comment-box manager">${escapeHtml(order.manager_comments)}</div></div>`;
  
  document.getElementById("viewOrderContent").innerHTML = html;
}

async function editOrder(id) {
  currentOrderId = id;
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${id}`, { credentials: "include" });
    const data = await response.json();
    if (data.success) {
      const order = data.order;
      document.getElementById("editOrderNumber").textContent = order.order_number;
      document.getElementById("editCustomerName").value = order.customer_name || "";
      document.getElementById("editCustomerPhone").value = order.customer_phone || "";
      document.getElementById("editCustomerEmail").value = order.customer_email || "";
      document.getElementById("editCustomerAddress").value = order.customer_address || "";
      document.getElementById("editDeliveryMethod").value = order.delivery_method || "pickup";
      document.getElementById("editDeliveryAddress").value = order.delivery_address || "";
      document.getElementById("editPaymentMethod").value = order.payment_method || "cash";
      document.getElementById("editStatus").value = order.status || "new";
      document.getElementById("editComments").value = order.comments || "";
      document.getElementById("editManagerComments").value = order.manager_comments || "";
      document.getElementById("editOrderModal").style.display = "flex";
    }
  } catch (error) {
    showNotification("Ошибка загрузки заказа", "error");
  } finally {
    showLoading(false);
  }
}

async function saveOrderChanges() {
  const data = {
    customer_name: document.getElementById("editCustomerName")?.value.trim(),
    customer_phone: document.getElementById("editCustomerPhone")?.value.trim() || null,
    customer_email: document.getElementById("editCustomerEmail")?.value.trim() || null,
    customer_address: document.getElementById("editCustomerAddress")?.value.trim() || null,
    delivery_method: document.getElementById("editDeliveryMethod")?.value,
    delivery_address: document.getElementById("editDeliveryAddress")?.value.trim() || null,
    payment_method: document.getElementById("editPaymentMethod")?.value,
    status: document.getElementById("editStatus")?.value,
    comments: document.getElementById("editComments")?.value.trim() || null,
    manager_comments: document.getElementById("editManagerComments")?.value.trim() || null
  };

  if (!data.customer_name) {
    showNotification("Имя клиента обязательно", "warning");
    return;
  }

  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${currentOrderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (result.success) {
      showNotification("Заказ обновлён", "success");
      closeEditModal();
      await loadOrders();
    } else {
      showNotification("Ошибка: " + result.message, "error");
    }
  } catch (error) {
    showNotification("Ошибка при обновлении", "error");
  } finally {
    showLoading(false);
  }
}

function confirmDeleteOrder(id, orderNumber) {
  currentOrderId = id;
  currentOrderNumber = orderNumber;
  document.getElementById("deleteOrderNumber").textContent = orderNumber;
  document.getElementById("deleteReason").value = "";
  document.getElementById("deleteOrderModal").style.display = "flex";
}

async function confirmDeleteOrderAction() {
  const reason = document.getElementById("deleteReason")?.value.trim() || "Заказ удалён администратором";
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${currentOrderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: "cancelled", comment: `Удаление заказа: ${reason}` })
    });
    const data = await response.json();
    if (data.success) {
      showNotification(`Заказ ${currentOrderNumber} отменён`, "success");
      closeDeleteOrderModal();
      await loadOrders();
    } else {
      showNotification("Ошибка: " + data.message, "error");
    }
  } catch (error) {
    showNotification("Ошибка при отмене", "error");
  } finally {
    showLoading(false);
  }
}

function openStatusModal(id, status, orderNumber) {
  currentOrderId = id;
  document.getElementById("statusOrderNumber").textContent = orderNumber;
  document.getElementById("currentStatusDisplay").innerHTML = `<span class="status-badge ${getStatusClass(status)}">${getStatusText(status)}</span>`;
  document.getElementById("newStatus").value = status;
  document.getElementById("statusComment").value = "";
  document.getElementById("statusModal").style.display = "flex";
}

async function saveStatusChange() {
  const newStatus = document.getElementById("newStatus").value;
  const comment = document.getElementById("statusComment").value;
  if (!newStatus) { showNotification("Выберите статус", "warning"); return; }
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${currentOrderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: newStatus, comment })
    });
    const data = await response.json();
    if (data.success) {
      showNotification(`Статус изменён на "${getStatusText(newStatus)}"`, "success");
      closeStatusModal();
      await loadOrders();
    } else {
      showNotification("Ошибка: " + data.message, "error");
    }
  } catch (error) {
    showNotification("Ошибка при обновлении", "error");
  } finally {
    showLoading(false);
  }
}

function closeViewModal() { document.getElementById("viewOrderModal").style.display = "none"; }
function closeEditModal() { document.getElementById("editOrderModal").style.display = "none"; }
function closeStatusModal() { document.getElementById("statusModal").style.display = "none"; }
function closeDeleteOrderModal() { document.getElementById("deleteOrderModal").style.display = "none"; }
function switchToEditMode() { closeViewModal(); editOrder(currentOrderId); }
function switchToViewMode() { closeEditModal(); viewOrder(currentOrderId); }

async function logout() {
  await fetch(`${API_BASE_URL}/logout`, { method: "POST", credentials: "include" });
  window.location.href = "/";
}

function getStatusClass(status) {
  const map = { new: "status-new", processing: "status-processing", confirmed: "status-confirmed", manufacturing: "status-manufacturing", ready: "status-ready", delivered: "status-delivered", completed: "status-completed", cancelled: "status-cancelled" };
  return map[status] || "status-new";
}

function getStatusText(status) {
  const map = { new: "Новый", processing: "В обработке", confirmed: "Подтвержден", manufacturing: "В производстве", ready: "Готов", delivered: "Доставлен", completed: "Выполнен", cancelled: "Отменен" };
  return map[status] || status;
}

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
  notification.innerHTML = `<i class="fas fa-${type === "success" ? "check-circle" : type === "error" ? "exclamation-circle" : "info-circle"}"></i> ${message}`;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

// Глобальные функции
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.viewOrder = viewOrder;
window.editOrder = editOrder;
window.saveOrderChanges = saveOrderChanges;
window.switchToEditMode = switchToEditMode;
window.switchToViewMode = switchToViewMode;
window.openStatusModal = openStatusModal;
window.saveStatusChange = saveStatusChange;
window.closeStatusModal = closeStatusModal;
window.confirmDeleteOrder = confirmDeleteOrder;
window.confirmDeleteOrderAction = confirmDeleteOrderAction;
window.closeDeleteOrderModal = closeDeleteOrderModal;
window.closeViewModal = closeViewModal;
window.closeEditModal = closeEditModal;
window.logout = logout;