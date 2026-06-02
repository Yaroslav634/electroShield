// admin.js - полная исправленная версия

const API_BASE_URL = window.location.origin.includes("localhost")
  ? `http://localhost:${window.location.port || 3001}/api`
  : "/api";

let currentUser = null;
let currentDeleteType = null;
let currentDeleteId = null;
let currentOrderId = null;
let currentOrderNumber = null;

function showLoading(show) {
  const loading = document.getElementById("loading");
  if (loading) loading.style.display = show ? "flex" : "none";
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  const icon = type === "success" ? "check-circle" : type === "error" ? "exclamation-circle" : type === "warning" ? "exclamation-triangle" : "info-circle";
  notification.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  
  const existingBtn = document.getElementById("themeToggle");
  if (existingBtn) existingBtn.remove();
  
  const btn = document.createElement("button");
  btn.id = "themeToggle";
  btn.className = "theme-toggle-btn";
  btn.innerHTML = '<i class="fas fa-sun"></i><i class="fas fa-moon"></i>';
  document.body.appendChild(btn);
  
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

function previewImage(input, previewId) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  preview.innerHTML = "";
  
  if (input.files && input.files[0]) {
    if (input.files[0].size > 5 * 1024 * 1024) {
      showNotification("Файл слишком большой. Максимальный размер: 5 МБ", "warning");
      input.value = "";
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.src = e.target.result;
      img.style.cssText = "max-width: 200px; max-height: 200px; border-radius: 10px; border: 2px solid var(--border-color); object-fit: cover;";
      preview.appendChild(img);
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function checkAuth() {
  try {
    const response = await fetch(`${API_BASE_URL}/me`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ошибка ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.authenticated) {
      currentUser = data.user;

      if (currentUser.role === "admin") {
        document.getElementById("adminContent").style.display = "block";
        document.getElementById("accessDenied").style.display = "none";
        document.getElementById("userName").textContent = currentUser.full_name || currentUser.username;
        document.getElementById("userRole").textContent = "Администратор";

        await loadStats();
        await loadOrders();
        await loadComponents();
        await loadCategories();
        await loadUsers();

        document.getElementById("addComponentForm")?.addEventListener("submit", async (e) => {
          e.preventDefault();
          await addComponent();
        });

        document.getElementById("addCategoryForm")?.addEventListener("submit", async (e) => {
          e.preventDefault();
          await addCategory();
        });

        document.getElementById("editComponentForm")?.addEventListener("submit", async (e) => {
          e.preventDefault();
          await updateComponent();
        });

        document.getElementById("editCategoryForm")?.addEventListener("submit", async (e) => {
          e.preventDefault();
          await updateCategory();
        });
        
        document.getElementById("editUserForm")?.addEventListener("submit", async (e) => {
          e.preventDefault();
          await updateUser();
        });

        document.getElementById("searchOrders")?.addEventListener("input", filterOrders);
        document.getElementById("searchComponents")?.addEventListener("input", filterComponents);
        document.getElementById("searchCategories")?.addEventListener("input", filterCategories);
        document.getElementById("searchUsers")?.addEventListener("input", filterUsers);

        return true;
      } else {
        document.getElementById("adminContent").style.display = "none";
        document.getElementById("accessDenied").style.display = "block";
        document.getElementById("accessDeniedMessage").textContent =
          `У вас права ${currentUser.role}. Для доступа нужны права администратора.`;
        setTimeout(() => (window.location.href = "/"), 3000);
        return false;
      }
    } else {
      window.location.href = "/";
      return false;
    }
  } catch (error) {
    console.error("Ошибка авторизации:", error);
    document.getElementById("adminContent").style.display = "none";
    document.getElementById("accessDenied").style.display = "block";
    document.getElementById("accessDeniedMessage").textContent =
      "Ошибка подключения к серверу. Проверьте соединение.";
    setTimeout(() => (window.location.href = "/"), 3000);
    return false;
  }
}

async function logout() {
  showLoading(true);
  try {
    await fetch(`${API_BASE_URL}/logout`, {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/";
  } catch (error) {
    showNotification("Ошибка при выходе", "error");
  } finally {
    showLoading(false);
  }
}

function showTab(tabName) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
  
  let tabId = "";
  if (tabName === "orders") tabId = "tab-orders";
  else if (tabName === "components") tabId = "tab-components";
  else if (tabName === "categories") tabId = "tab-categories";
  else if (tabName === "users") tabId = "tab-users";
  
  if (tabId) {
    const tabContent = document.getElementById(tabId);
    if (tabContent) tabContent.classList.add("active");
  }
  
  const clickedTab = Array.from(document.querySelectorAll(".tab")).find(
    t => t.textContent.toLowerCase().includes(tabName)
  );
  if (clickedTab) clickedTab.classList.add("active");
}

async function loadStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/stats`, { credentials: "include" });
    const stats = await response.json();
    document.getElementById("totalOrders").textContent = stats.totalOrders || 0;
    document.getElementById("newOrders").textContent = stats.newOrders || 0;
    document.getElementById("totalComponents").textContent = stats.totalComponents || 0;
    document.getElementById("totalCategories").textContent = stats.totalCategories || 0;
  } catch (error) {
    console.error("Ошибка статистики:", error);
  }
}

// ============ КАТЕГОРИИ ============
async function loadCategories() {
  try {
    const response = await fetch(`${API_BASE_URL}/categories`, { credentials: "include" });
    const categories = await response.json();
    const tbody = document.getElementById("categoriesTable");
    if (tbody) {
      if (categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-message">Нет категорий</td></tr>';
      } else {
        tbody.innerHTML = categories.map(cat => `
          <tr>
            <td><strong>${cat.id}</strong></td>
            <td>${escapeHtml(cat.name)}</td>
            <td>${escapeHtml(cat.description || "—")}</td>
            <td>
              <div class="action-buttons">
                <button onclick="editCategory(${cat.id})" class="action-btn edit"><i class="fas fa-edit"></i></button>
                <button onclick="confirmDeleteCategory(${cat.id}, '${escapeHtml(cat.name)}')" class="action-btn delete"><i class="fas fa-trash"></i></button>
              </div>
            </td>
          </tr>
        `).join("");
      }
    }
    await loadCategoriesSelect();
    await loadEditCategoriesSelect();
  } catch (error) {
    console.error("Ошибка загрузки категорий:", error);
  }
}

async function loadCategoriesSelect() {
  try {
    const response = await fetch(`${API_BASE_URL}/categories`, { credentials: "include" });
    const categories = await response.json();
    const select = document.getElementById("compCategory");
    if (select) {
      select.innerHTML = '<option value="">Без категории</option>' +
        categories.map(cat => `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`).join("");
    }
  } catch (error) {
    console.error("Ошибка загрузки категорий:", error);
  }
}

async function loadEditCategoriesSelect() {
  try {
    const response = await fetch(`${API_BASE_URL}/categories`, { credentials: "include" });
    const categories = await response.json();
    const select = document.getElementById("editCompCategory");
    if (select) {
      select.innerHTML = '<option value="">Без категории</option>' +
        categories.map(cat => `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`).join("");
    }
  } catch (error) {
    console.error("Ошибка загрузки категорий:", error);
  }
}

async function addCategory() {
  const name = document.getElementById("catName")?.value.trim();
  const description = document.getElementById("catDescription")?.value.trim();
  if (!name) { showNotification("Введите название категории", "warning"); return; }
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/categories`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ name, description }),
    });
    const data = await response.json();
    if (data.success) {
      showNotification("Категория добавлена", "success");
      document.getElementById("addCategoryForm")?.reset();
      loadCategories(); loadStats();
    } else {
      showNotification("Ошибка: " + (data.message || "Неизвестная ошибка"), "error");
    }
  } catch (error) {
    showNotification("Ошибка при добавлении", "error");
  } finally {
    showLoading(false);
  }
}

async function editCategory(id) {
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE_URL}/categories/${id}`, { credentials: "include" });
    const data = await response.json();
    if (data.success) {
      document.getElementById("editCatId").value = data.category.id;
      document.getElementById("editCatName").value = data.category.name;
      document.getElementById("editCatDescription").value = data.category.description || "";
      document.getElementById("editCategoryModal").style.display = "flex";
    } else {
      showNotification("Ошибка загрузки категории", "error");
    }
  } catch (error) {
    showNotification("Ошибка при загрузке", "error");
  } finally {
    showLoading(false);
  }
}

async function updateCategory() {
  const id = document.getElementById("editCatId")?.value;
  const name = document.getElementById("editCatName")?.value.trim();
  const description = document.getElementById("editCatDescription")?.value.trim();
  if (!name) { showNotification("Введите название категории", "warning"); return; }
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ name, description }),
    });
    const data = await response.json();
    if (data.success) {
      showNotification("Категория обновлена", "success");
      closeEditCategoryModal();
      loadCategories();
    } else {
      showNotification("Ошибка: " + (data.message || "Неизвестная ошибка"), "error");
    }
  } catch (error) {
    showNotification("Ошибка при обновлении", "error");
  } finally {
    showLoading(false);
  }
}

function closeEditCategoryModal() {
  document.getElementById("editCategoryModal").style.display = "none";
}

// ============ КОМПОНЕНТЫ ============
async function loadComponents() {
  try {
    const response = await fetch(`${API_BASE_URL}/components`, { credentials: "include" });
    const components = await response.json();
    const tbody = document.getElementById("componentsTable");
    if (tbody) {
      if (components.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-message">Нет компонентов</td></tr>';
      } else {
        tbody.innerHTML = components.map(comp => `
          <tr>
            <td><strong>${comp.id}</strong></td>
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                ${comp.image_url ? `<img src="${comp.image_url}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover;" onerror="this.style.display='none'">` : ""}
                <div>
                  <strong>${escapeHtml(comp.name)}</strong><br>
                  <small>${escapeHtml(comp.manufacturer || "")}</small>
                </div>
              </div>
            </td>
            <td><strong>${new Intl.NumberFormat("ru-RU").format(comp.price)} ₽</strong></td>
            <td>${escapeHtml(comp.category_name || "Без категории")}</td>
            <td>
              <span class="stock-status ${comp.in_stock ? "stock-in" : "stock-out"}">
                <i class="fas fa-${comp.in_stock ? "check-circle" : "times-circle"}"></i>
                ${comp.in_stock ? "В наличии" : "Нет в наличии"}
              </span>
            </td>
            <td>${comp.image_url ? '<i class="fas fa-check-circle" style="color: var(--success-color);"></i>' : '<i class="fas fa-times-circle" style="color: var(--text-muted);"></i>'}</td>
            <td>
              <div class="action-buttons">
                <button onclick="editComponent(${comp.id})" class="action-btn edit"><i class="fas fa-edit"></i></button>
                <button onclick="confirmDeleteComponent(${comp.id}, '${escapeHtml(comp.name)}')" class="action-btn delete"><i class="fas fa-trash"></i></button>
              </div>
            </td>
          </tr>
        `).join("");
      }
    }
  } catch (error) {
    console.error("Ошибка загрузки компонентов:", error);
  }
}

async function addComponent() {
  const name = document.getElementById("compName")?.value.trim();
  const price = parseFloat(document.getElementById("compPrice")?.value);
  const imageFile = document.getElementById("compImage")?.files[0];
  if (!name) { showNotification("Введите название компонента", "warning"); return; }
  if (!price || price <= 0) { showNotification("Введите корректную цену", "warning"); return; }

  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/components`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({
        name,
        description: document.getElementById("compDescription")?.value.trim() || null,
        price,
        category_id: document.getElementById("compCategory")?.value || null,
        manufacturer: document.getElementById("compManufacturer")?.value.trim() || null,
        power_rating: document.getElementById("compPower")?.value.trim() || null,
        voltage: document.getElementById("compVoltage")?.value.trim() || null,
        in_stock: document.getElementById("compInStock")?.checked || true,
      }),
    });
    const data = await response.json();
    
    if (data.success && imageFile) {
      const formData = new FormData();
      formData.append("image", imageFile);
      await fetch(`${API_BASE_URL}/components/${data.id}/image`, {
        method: "POST", credentials: "include", body: formData,
      });
    }
    
    if (data.success) {
      showNotification("Компонент добавлен", "success");
      document.getElementById("addComponentForm")?.reset();
      document.getElementById("compImagePreview").innerHTML = "";
      loadComponents(); loadStats();
    } else {
      showNotification("Ошибка: " + (data.message || "Неизвестная ошибка"), "error");
    }
  } catch (error) {
    showNotification("Ошибка при добавлении", "error");
  } finally {
    showLoading(false);
  }
}

async function editComponent(id) {
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE_URL}/components/${id}`, { credentials: "include" });
    const data = await response.json();
    if (data.success) {
      const comp = data.component;
      document.getElementById("editCompId").value = comp.id;
      document.getElementById("editCompName").value = comp.name;
      document.getElementById("editCompDescription").value = comp.description || "";
      document.getElementById("editCompPrice").value = comp.price;
      document.getElementById("editCompManufacturer").value = comp.manufacturer || "";
      document.getElementById("editCompPower").value = comp.power_rating || "";
      document.getElementById("editCompVoltage").value = comp.voltage || "";
      document.getElementById("editCompInStock").checked = comp.in_stock;
      document.getElementById("editCompCategory").value = comp.category_id || "";
      document.getElementById("editCompImagePreview").innerHTML = "";
      document.getElementById("editCompImage").value = "";
      
      const currentImage = document.getElementById("currentCompImage");
      if (currentImage) {
        currentImage.innerHTML = comp.image_url
          ? `<p style="margin-bottom:8px;">Текущее изображение:</p><img src="${comp.image_url}" style="max-width:200px;max-height:200px;border-radius:10px;object-fit:cover;">`
          : '<p>Изображение не загружено</p>';
      }
      
      document.getElementById("editComponentModal").style.display = "flex";
    }
  } catch (error) {
    showNotification("Ошибка при загрузке", "error");
  } finally {
    showLoading(false);
  }
}

async function updateComponent() {
  const id = document.getElementById("editCompId")?.value;
  const name = document.getElementById("editCompName")?.value.trim();
  const price = parseFloat(document.getElementById("editCompPrice")?.value);
  const imageFile = document.getElementById("editCompImage")?.files[0];
  if (!name) { showNotification("Введите название компонента", "warning"); return; }
  if (!price || price <= 0) { showNotification("Введите корректную цену", "warning"); return; }

  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/components/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({
        name,
        description: document.getElementById("editCompDescription")?.value.trim() || null,
        price,
        category_id: document.getElementById("editCompCategory")?.value || null,
        manufacturer: document.getElementById("editCompManufacturer")?.value.trim() || null,
        power_rating: document.getElementById("editCompPower")?.value.trim() || null,
        voltage: document.getElementById("editCompVoltage")?.value.trim() || null,
        in_stock: document.getElementById("editCompInStock")?.checked || false,
      }),
    });
    const data = await response.json();
    
    if (data.success && imageFile) {
      const formData = new FormData();
      formData.append("image", imageFile);
      await fetch(`${API_BASE_URL}/components/${id}/image`, {
        method: "POST", credentials: "include", body: formData,
      });
    }
    
    if (data.success) {
      showNotification("Компонент обновлен", "success");
      closeEditComponentModal();
      loadComponents();
    } else {
      showNotification("Ошибка: " + (data.message || "Неизвестная ошибка"), "error");
    }
  } catch (error) {
    showNotification("Ошибка при обновлении", "error");
  } finally {
    showLoading(false);
  }
}

function closeEditComponentModal() {
  document.getElementById("editComponentModal").style.display = "none";
}

// ============ УДАЛЕНИЕ КАТЕГОРИЙ И КОМПОНЕНТОВ ============
function confirmDeleteCategory(id, name) {
  currentDeleteType = "category";
  currentDeleteId = id;
  document.getElementById("deleteMessage").textContent = `Удалить категорию "${name}"?`;
  document.getElementById("deleteConfirmModal").style.display = "flex";
}

function confirmDeleteComponent(id, name) {
  currentDeleteType = "component";
  currentDeleteId = id;
  document.getElementById("deleteMessage").textContent = `Удалить компонент "${name}"?`;
  document.getElementById("deleteConfirmModal").style.display = "flex";
}

function closeDeleteModal() {
  document.getElementById("deleteConfirmModal").style.display = "none";
  currentDeleteType = null;
  currentDeleteId = null;
}

document.addEventListener("DOMContentLoaded", () => {
  const confirmBtn = document.getElementById("confirmDeleteBtn");
  if (confirmBtn) {
    confirmBtn.onclick = async function () {
      if (currentDeleteType === "category") await deleteCategory(currentDeleteId);
      else if (currentDeleteType === "component") await deleteComponent(currentDeleteId);
    };
  }
});

async function deleteCategory(id) {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/categories/${id}`, { method: "DELETE", credentials: "include" });
    const data = await response.json();
    if (data.success) {
      showNotification("Категория удалена", "success");
      closeDeleteModal(); 
      loadCategories(); 
      loadStats();
    } else {
      showNotification("Ошибка: " + (data.message || "Неизвестная ошибка"), "error");
    }
  } catch (error) {
    showNotification("Ошибка при удалении", "error");
  } finally {
    showLoading(false);
  }
}

async function deleteComponent(id) {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/components/${id}`, { 
      method: "DELETE", 
      credentials: "include" 
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification("Компонент удален", "success");
      closeDeleteModal(); 
      loadComponents(); 
      loadStats();
    } else {
      if (data.message && data.message.includes("используется")) {
        if (confirm("⚠️ Компонент используется в заказах. Скрыть его из каталога?")) {
          await hideComponent(id);
        } else {
          closeDeleteModal();
        }
      } else {
        showNotification("Ошибка: " + (data.message || "Неизвестная ошибка"), "error");
      }
    }
  } catch (error) {
    console.error("Ошибка при удалении:", error);
    showNotification("Ошибка при удалении компонента", "error");
  } finally {
    showLoading(false);
  }
}

async function hideComponent(id) {
  showLoading(true);
  try {
    const getResponse = await fetch(`${API_BASE_URL}/components/${id}`, { credentials: "include" });
    const compData = await getResponse.json();
    
    if (compData.success) {
      const comp = compData.component;
      
      const response = await fetch(`${API_BASE_URL}/components/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: comp.name,
          description: comp.description,
          price: comp.price,
          category_id: comp.category_id,
          manufacturer: comp.manufacturer,
          power_rating: comp.power_rating,
          voltage: comp.voltage,
          in_stock: false
        })
      });
      
      const data = await response.json();
      if (data.success) {
        showNotification("Компонент скрыт из каталога", "success");
        closeDeleteModal();
        loadComponents();
      } else {
        showNotification("Ошибка при скрытии", "error");
      }
    }
  } catch (error) {
    console.error("Ошибка:", error);
    showNotification("Ошибка при скрытии компонента", "error");
  } finally {
    showLoading(false);
  }
}

// ============ ЗАКАЗЫ ============
async function loadOrders() {
  try {
    const response = await fetch(`${API_BASE_URL}/my-orders`, { credentials: "include" });
    const orders = await response.json();
    const tbody = document.getElementById("ordersTable");
    if (!tbody) return;
    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-message">Нет заказов</td></tr>';
      return;
    }
    tbody.innerHTML = orders.map(order => {
      const total = order.final_amount || order.total_amount || 0;
      const statusClass = getStatusClass(order.status);
      const statusText = getStatusText(order.status);
      return `
        <tr>
          <td><strong>${order.order_number || order.id}</strong></td>
          <td>${escapeHtml(order.customer_name)}<br><small>${escapeHtml(order.customer_phone || "")}</small></td>
          <td>${order.created_at ? new Date(order.created_at).toLocaleDateString() : "—"}</td>
          <td><span class="status-badge ${statusClass}" style="cursor:pointer;" onclick="openStatusModal('${order.id}', '${order.status}', '${order.order_number}')">${statusText}</span></td>
          <td><strong>${new Intl.NumberFormat("ru-RU").format(total)} ₽</strong></td>
          <td>
            <div class="action-buttons">
              <button onclick="viewOrder(${order.id})" class="action-btn view" title="Просмотреть"><i class="fas fa-eye"></i></button>
              <button onclick="editOrder(${order.id})" class="action-btn edit" title="Редактировать"><i class="fas fa-edit"></i></button>
              <button onclick="openStatusModal('${order.id}', '${order.status}', '${order.order_number}')" class="action-btn status" title="Изменить статус"><i class="fas fa-sync-alt"></i></button>
              <button onclick="confirmDeleteOrder('${order.id}', '${order.order_number || order.id}')" class="action-btn delete" title="Удалить"><i class="fas fa-trash-alt"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  } catch (error) {
    console.error("Ошибка загрузки заказов:", error);
  }
}

async function viewOrder(id) {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${id}`, { credentials: "include" });
    const data = await response.json();
    if (data.success) {
      currentOrderId = id;
      currentOrderNumber = data.order.order_number;
      displayOrderDetails(data);
      document.getElementById("viewOrderModal").style.display = "flex";
    } else {
      showNotification("Ошибка загрузки заказа", "error");
    }
  } catch (error) {
    console.error("Ошибка:", error);
    showNotification("Ошибка при загрузке", "error");
  } finally {
    showLoading(false);
  }
}

function displayOrderDetails(data) {
  const order = data.order;
  const components = data.components || [];
  
  let html = `
    <div class="order-view-details">
      <div style="margin-bottom: 20px; padding: 15px; background: var(--bg-panel); border-radius: 12px;">
        <h4 style="margin-bottom: 10px;">Информация о клиенте</h4>
        <p><strong>Имя:</strong> ${escapeHtml(order.customer_name)}</p>
        ${order.customer_phone ? `<p><strong>Телефон:</strong> ${escapeHtml(order.customer_phone)}</p>` : ""}
        ${order.customer_email ? `<p><strong>Email:</strong> ${escapeHtml(order.customer_email)}</p>` : ""}
        ${order.customer_address ? `<p><strong>Адрес:</strong> ${escapeHtml(order.customer_address)}</p>` : ""}
      </div>
      <div style="margin-bottom: 20px; padding: 15px; background: var(--bg-panel); border-radius: 12px;">
        <h4 style="margin-bottom: 10px;">Доставка и оплата</h4>
        <p><strong>Доставка:</strong> ${order.delivery_method === "pickup" ? "Самовывоз" : "Доставка"}</p>
        ${order.delivery_address ? `<p><strong>Адрес доставки:</strong> ${escapeHtml(order.delivery_address)}</p>` : ""}
        <p><strong>Оплата:</strong> ${order.payment_method === "cash" ? "Наличные" : order.payment_method === "card" ? "Карта" : "По счету"}</p>
        <p><strong>Статус:</strong> <span class="status-badge ${getStatusClass(order.status)}">${getStatusText(order.status)}</span></p>
        <p><strong>Дата:</strong> ${new Date(order.created_at).toLocaleString()}</p>
      </div>
  `;
  
  if (components.length > 0) {
    html += `
      <div style="margin-bottom: 20px; padding: 15px; background: var(--bg-panel); border-radius: 12px;">
        <h4 style="margin-bottom: 10px;">Состав заказа</h4>
        <table style="width:100%; border-collapse: collapse;">
          <thead><tr><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead>
          <tbody>
    `;
    let total = 0;
    components.forEach(item => {
      const sum = item.total_price || item.unit_price * item.quantity;
      total += sum;
      html += `<tr><td>${escapeHtml(item.name)}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:right">${new Intl.NumberFormat("ru-RU").format(item.unit_price)} ₽</td><td style="text-align:right">${new Intl.NumberFormat("ru-RU").format(sum)} ₽</td></tr>`;
    });
    html += `<tr style="background:rgba(16,185,129,0.1); font-weight:bold"><td colspan="3" style="text-align:right">ИТОГО:</td><td style="text-align:right">${new Intl.NumberFormat("ru-RU").format(total)} ₽</td></tr>`;
    html += `</tbody></table></div>`;
  }
  
  if (order.comments) {
    html += `<div style="margin-bottom: 20px; padding: 15px; background: var(--bg-panel); border-radius: 12px;">
      <h4>Комментарий клиента</h4>
      <div style="background: var(--bg-card); padding: 12px; border-radius: 8px;">${escapeHtml(order.comments)}</div>
    </div>`;
  }
  
  if (order.manager_comments) {
    html += `<div style="margin-bottom: 20px; padding: 15px; background: var(--bg-panel); border-radius: 12px;">
      <h4>Комментарий менеджера</h4>
      <div style="background: var(--bg-card); padding: 12px; border-radius: 8px; border-left: 4px solid #f59e0b;">${escapeHtml(order.manager_comments)}</div>
    </div>`;
  }
  
  html += `</div>`;
  document.getElementById("viewOrderContent").innerHTML = html;
}

function closeViewOrderModal() {
  document.getElementById("viewOrderModal").style.display = "none";
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
    } else {
      showNotification("Ошибка загрузки заказа", "error");
    }
  } catch (error) {
    showNotification("Ошибка при загрузке", "error");
  } finally {
    showLoading(false);
  }
}

async function saveOrderChanges() {
  const updatedData = {
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

  if (!updatedData.customer_name) {
    showNotification("Имя клиента обязательно", "warning");
    return;
  }

  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${currentOrderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(updatedData),
    });
    const data = await response.json();
    if (data.success) {
      showNotification("Заказ успешно обновлён", "success");
      closeEditOrderModal();
      await loadOrders();
      await loadStats();
    } else {
      showNotification("Ошибка: " + data.message, "error");
    }
  } catch (error) {
    showNotification("Ошибка при обновлении", "error");
  } finally {
    showLoading(false);
  }
}

function closeEditOrderModal() {
  document.getElementById("editOrderModal").style.display = "none";
}

function confirmDeleteOrder(id, orderNumber) {
  currentOrderId = id;
  currentOrderNumber = orderNumber;
  document.getElementById("deleteOrderNumber").textContent = orderNumber;
  document.getElementById("deleteOrderReason").value = "";
  document.getElementById("deleteOrderModal").style.display = "flex";
}

function closeDeleteOrderModal() {
  document.getElementById("deleteOrderModal").style.display = "none";
}

async function confirmDeleteOrderAction() {
  const reason = document.getElementById("deleteOrderReason")?.value.trim() || "Заказ удалён администратором";
  
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${currentOrderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ 
        status: "cancelled", 
        comment: `🗑️ ЗАКАЗ УДАЛЁН: ${reason}` 
      }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification(`✅ Заказ ${currentOrderNumber} отменён`, "success");
      closeDeleteOrderModal();
      if (document.getElementById("viewOrderModal").style.display === "flex") {
        closeViewOrderModal();
      }
      await loadOrders();
      await loadStats();
    } else {
      showNotification("❌ Ошибка: " + (data.message || "Не удалось отменить заказ"), "error");
    }
  } catch (error) {
    console.error("Ошибка:", error);
    showNotification("❌ Ошибка при отмене заказа", "error");
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

function closeStatusModal() {
  document.getElementById("statusModal").style.display = "none";
}

async function saveStatusChange() {
  const newStatus = document.getElementById("newStatus").value;
  const comment = document.getElementById("statusComment").value;
  if (!newStatus) { showNotification("Выберите статус", "warning"); return; }
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${currentOrderId}/status`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ status: newStatus, comment }),
    });
    const data = await response.json();
    if (data.success) {
      showNotification(`Статус изменён на "${getStatusText(newStatus)}"`, "success");
      closeStatusModal();
      await loadOrders();
      await loadStats();
    } else {
      showNotification("Ошибка: " + data.message, "error");
    }
  } catch (error) {
    showNotification("Ошибка при обновлении", "error");
  } finally {
    showLoading(false);
  }
}

// ============ ПОЛЬЗОВАТЕЛИ ============
async function loadUsers() {
  try {
    const response = await fetch(`${API_BASE_URL}/users`, { credentials: "include" });
    const users = await response.json();
    const tbody = document.getElementById("usersTable");
    if (!tbody) return;
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-message">Нет пользователей</td></tr>';
    } else {
      tbody.innerHTML = users.map(user => `
        <tr>
          <td><strong>${user.id}</strong></td>
          <td>${escapeHtml(user.username)}</td>
          <td>${escapeHtml(user.full_name || "—")}</td>
          <td>${escapeHtml(user.email || "—")}</td>
          <td>
            <select onchange="changeUserRole(${user.id}, this.value)" class="role-select">
              <option value="user" ${user.role === "user" ? "selected" : ""}>Пользователь</option>
              <option value="manager" ${user.role === "manager" ? "selected" : ""}>Менеджер</option>
              <option value="admin" ${user.role === "admin" ? "selected" : ""}>Администратор</option>
            </select>
          </td>
          <td><span class="status-badge ${user.is_active ? "status-completed" : "status-cancelled"}">${user.is_active ? "Активен" : "Заблокирован"}</span></td>
          <td>${user.created_at || "—"}</td>
          <td>
            <div class="action-buttons">
              <button onclick="openEditUserModal(${user.id})" class="action-btn edit"><i class="fas fa-edit"></i></button>
              <button onclick="toggleUserStatus(${user.id})" class="action-btn ${user.is_active ? "delete" : "success"}">
                <i class="fas fa-${user.is_active ? "ban" : "check"}"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join("");
    }
  } catch (error) {
    console.error("Ошибка загрузки пользователей:", error);
  }
}

async function changeUserRole(userId, newRole) {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role: newRole })
    });
    const data = await response.json();
    if (data.success) {
      showNotification("Роль пользователя изменена", "success");
      loadUsers();
    } else {
      showNotification("Ошибка: " + data.message, "error");
      loadUsers();
    }
  } catch (error) {
    showNotification("Ошибка при изменении роли", "error");
    loadUsers();
  } finally {
    showLoading(false);
  }
}

async function openEditUserModal(userId) {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, { credentials: "include" });
    const data = await response.json();
    if (data.success) {
      const user = data.user;
      document.getElementById("editUserId").value = user.id;
      document.getElementById("editUserFullName").value = user.full_name || "";
      document.getElementById("editUserEmail").value = user.email || "";
      document.getElementById("editUserPhone").value = user.phone || "";
      document.getElementById("editUserRole").value = user.role;
      document.getElementById("editUserModal").style.display = "flex";
    } else {
      showNotification("Ошибка загрузки пользователя", "error");
    }
  } catch (error) {
    showNotification("Ошибка при загрузке", "error");
  } finally {
    showLoading(false);
  }
}

async function updateUser() {
  const userId = document.getElementById("editUserId")?.value;
  const fullName = document.getElementById("editUserFullName")?.value.trim();
  const email = document.getElementById("editUserEmail")?.value.trim();
  const phone = document.getElementById("editUserPhone")?.value.trim();
  const role = document.getElementById("editUserRole")?.value;
  const password = document.getElementById("editUserPassword")?.value;
  
  if (!fullName) { showNotification("Введите ФИО", "warning"); return; }
  if (!email) { showNotification("Введите Email", "warning"); return; }
  
  showLoading(true);
  try {
    const updateData = { full_name: fullName, email, phone, role };
    if (password && password.length >= 6) {
      updateData.password = password;
    }
    
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(updateData)
    });
    const data = await response.json();
    if (data.success) {
      showNotification("Пользователь обновлен", "success");
      closeEditUserModal();
      loadUsers();
    } else {
      showNotification("Ошибка: " + data.message, "error");
    }
  } catch (error) {
    showNotification("Ошибка при обновлении", "error");
  } finally {
    showLoading(false);
  }
}

function closeEditUserModal() {
  document.getElementById("editUserModal").style.display = "none";
  document.getElementById("editUserPassword").value = "";
}

async function toggleUserStatus(id) {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/users/${id}/toggle`, { method: "POST", credentials: "include" });
    const data = await response.json();
    if (data.success) {
      showNotification("Статус пользователя изменен", "success");
      loadUsers();
    } else {
      showNotification("Ошибка: " + data.message, "error");
    }
  } catch (error) {
    showNotification("Ошибка при изменении статуса", "error");
  } finally {
    showLoading(false);
  }
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
function getStatusClass(status) {
  const map = { new: "status-new", processing: "status-processing", confirmed: "status-confirmed", manufacturing: "status-manufacturing", ready: "status-ready", delivered: "status-delivered", completed: "status-completed", cancelled: "status-cancelled" };
  return map[status] || "status-new";
}

function getStatusText(status) {
  const map = { new: "Новый", processing: "В обработке", confirmed: "Подтвержден", manufacturing: "В производстве", ready: "Готов", delivered: "Доставлен", completed: "Выполнен", cancelled: "Отменен" };
  return map[status] || status;
}

function filterOrders() {
  const search = document.getElementById("searchOrders")?.value.toLowerCase();
  const rows = document.querySelectorAll("#ordersTable tr");
  rows.forEach(row => {
    if (row.cells?.length) {
      row.style.display = !search || row.textContent.toLowerCase().includes(search) ? "" : "none";
    }
  });
}

function filterComponents() {
  const search = document.getElementById("searchComponents")?.value.toLowerCase();
  const rows = document.querySelectorAll("#componentsTable tr");
  rows.forEach(row => {
    if (row.cells?.length) {
      row.style.display = !search || row.textContent.toLowerCase().includes(search) ? "" : "none";
    }
  });
}

function filterCategories() {
  const search = document.getElementById("searchCategories")?.value.toLowerCase();
  const rows = document.querySelectorAll("#categoriesTable tr");
  rows.forEach(row => {
    if (row.cells?.length) {
      row.style.display = !search || row.textContent.toLowerCase().includes(search) ? "" : "none";
    }
  });
}

function filterUsers() {
  const search = document.getElementById("searchUsers")?.value.toLowerCase();
  const rows = document.querySelectorAll("#usersTable tr");
  rows.forEach(row => {
    if (row.cells?.length) {
      row.style.display = !search || row.textContent.toLowerCase().includes(search) ? "" : "none";
    }
  });
}

// Инициализация
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  checkAuth();
  
  const compImage = document.getElementById("compImage");
  if (compImage) {
    compImage.addEventListener("change", () => previewImage(compImage, "compImagePreview"));
  }
  
  const editCompImage = document.getElementById("editCompImage");
  if (editCompImage) {
    editCompImage.addEventListener("change", () => previewImage(editCompImage, "editCompImagePreview"));
  }
});

// Глобальные функции
window.logout = logout;
window.showTab = showTab;
window.viewOrder = viewOrder;
window.closeViewOrderModal = closeViewOrderModal;
window.editOrder = editOrder;
window.saveOrderChanges = saveOrderChanges;
window.closeEditOrderModal = closeEditOrderModal;
window.openStatusModal = openStatusModal;
window.closeStatusModal = closeStatusModal;
window.saveStatusChange = saveStatusChange;
window.confirmDeleteOrder = confirmDeleteOrder;
window.confirmDeleteOrderAction = confirmDeleteOrderAction;
window.closeDeleteOrderModal = closeDeleteOrderModal;
window.editCategory = editCategory;
window.editComponent = editComponent;
window.toggleUserStatus = toggleUserStatus;
window.changeUserRole = changeUserRole;
window.openEditUserModal = openEditUserModal;
window.closeEditUserModal = closeEditUserModal;
window.updateUser = updateUser;
window.confirmDeleteCategory = confirmDeleteCategory;
window.confirmDeleteComponent = confirmDeleteComponent;
window.closeDeleteModal = closeDeleteModal;
window.closeEditComponentModal = closeEditComponentModal;
window.closeEditCategoryModal = closeEditCategoryModal;