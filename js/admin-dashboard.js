const API_BASE_URL = window.location.origin.includes("localhost")
    ? `http://localhost:${window.location.port || 3001}/api`
    : "/api";

let currentUser = null;
let currentPeriod = 'week';
let charts = {};

let analyticsData = {
    ordersByDate: [],
    statusDistribution: {},
    categorySales: [],
    topComponents: [],
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    growthRate: 0
};

document.addEventListener("DOMContentLoaded", async () => {
    initThemeToggle();
    initBreadcrumbs();
    showLoading(true);
    await checkAuth();
    showLoading(false);
});

function initBreadcrumbs() {
    const container = document.getElementById("breadcrumbsContainer");
    if (!container) return;
    container.innerHTML = '<a href="/admin.html"><i class="fas fa-cog"></i> Админ-панель</a><span class="separator">›</span><span class="current">Аналитика</span>';
}

// ============ ТЕМА ============
function initThemeToggle() {
    const savedTheme = localStorage.getItem("theme");
    
    if (savedTheme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
    } else {
        document.documentElement.removeAttribute("data-theme");
    }
    
    const existingBtn = document.getElementById("themeToggle");
    if (!existingBtn) {
        const btn = document.createElement("button");
        btn.id = "themeToggle";
        btn.className = "theme-toggle-btn";
        btn.innerHTML = '<i class="fas fa-sun"></i><i class="fas fa-moon"></i>';
        btn.title = "Переключить тему";
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
            // Пересоздаём графики с новой темой
            setTimeout(() => updateCharts(), 100);
        });
    }
}

// ============ АВТОРИЗАЦИЯ ============
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE_URL}/me`, { 
            credentials: "include",
            headers: { "Content-Type": "application/json" }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        const data = await response.json();

        if (data.success && data.authenticated && data.user.role === "admin") {
            currentUser = data.user;
            document.getElementById("dashboardContent").style.display = "block";
            document.getElementById("accessDenied").style.display = "none";
            
            const today = new Date();
            const weekAgo = new Date();
            weekAgo.setDate(today.getDate() - 7);
            
            document.getElementById("dateFrom").value = formatDate(weekAgo);
            document.getElementById("dateTo").value = formatDate(today);
            
            setupEventListeners();
            await loadAnalytics();
        } else {
            showAccessDenied();
        }
    } catch (error) {
        console.error("Ошибка авторизации:", error);
        showAccessDenied();
    }
}

function showAccessDenied() {
    const dashboardContent = document.getElementById("dashboardContent");
    const accessDenied = document.getElementById("accessDenied");
    
    if (dashboardContent) dashboardContent.style.display = "none";
    if (accessDenied) {
        accessDenied.style.display = "block";
        const messageEl = accessDenied.querySelector("p");
        if (messageEl) {
            messageEl.textContent = "У вас нет прав администратора для просмотра этой страницы.";
        }
    }
    
    setTimeout(() => {
        window.location.href = "/admin.html";
    }, 3000);
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============ ОБРАБОТЧИКИ СОБЫТИЙ ============
function setupEventListeners() {
    // Кнопки периода
    const periodButtons = document.querySelectorAll('.period-btn');
    periodButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            periodButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriod = btn.dataset.period;
            
            const { from, to } = getDateRangeByPeriod(currentPeriod);
            document.getElementById("dateFrom").value = formatDate(from);
            document.getElementById("dateTo").value = formatDate(to);
            
            showLoading(true);
            await loadAnalytics();
            showLoading(false);
        });
    });
    
    // Применить диапазон дат
    const applyBtn = document.getElementById("applyDateRange");
    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            currentPeriod = 'custom';
            periodButtons.forEach(b => b.classList.remove('active'));
            
            showLoading(true);
            await loadAnalytics();
            showLoading(false);
        });
    }
}

function getDateRangeByPeriod(period) {
    const to = new Date();
    const from = new Date();
    
    switch(period) {
        case 'day': 
            from.setDate(to.getDate() - 1); 
            break;
        case 'week': 
            from.setDate(to.getDate() - 7); 
            break;
        case 'month': 
            from.setMonth(to.getMonth() - 1); 
            break;
        case 'quarter': 
            from.setMonth(to.getMonth() - 3); 
            break;
        case 'year': 
            from.setFullYear(to.getFullYear() - 1); 
            break;
        default: 
            from.setDate(to.getDate() - 7);
    }
    
    return { from, to };
}

// ============ ЗАГРУЗКА АНАЛИТИКИ ============
async function loadAnalytics() {
    try {
        const dateFrom = document.getElementById("dateFrom").value;
        const dateTo = document.getElementById("dateTo").value;
        
        const response = await fetch(`${API_BASE_URL}/my-orders`, { 
            credentials: "include" 
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        let allOrders = await response.json();
        
        // Фильтрация по дате
        const filteredOrders = allOrders.filter(order => {
            if (!order.created_at) return false;
            const orderDate = new Date(order.created_at).toISOString().split('T')[0];
            return orderDate >= dateFrom && orderDate <= dateTo;
        });
        
        await processAnalytics(filteredOrders, dateFrom, dateTo);
        updateStatsDisplay();
        updateCharts();
        updateTopComponents();
        updateStatusDetails();
        
    } catch (error) {
        console.error("Ошибка загрузки аналитики:", error);
        showNotification("Ошибка загрузки данных", "error");
    }
}

// ============ ОБРАБОТКА ДАННЫХ ============
async function processAnalytics(orders, dateFrom, dateTo) {
    const ordersByDate = new Map();
    const revenueByDate = new Map();
    const statusDistribution = {
        new: 0, processing: 0, confirmed: 0, manufacturing: 0,
        ready: 0, delivered: 0, completed: 0, cancelled: 0
    };
    const categorySales = new Map();
    const componentSales = new Map();
    
    let totalRevenue = 0;
    let completedOrdersCount = 0;
    
    // Получаем все компоненты
    let allComponents = [];
    try {
        const compRes = await fetch(`${API_BASE_URL}/components`, { credentials: "include" });
        if (compRes.ok) {
            allComponents = await compRes.json();
        }
    } catch(e) {
        console.warn("Не удалось загрузить компоненты:", e);
    }
    
    // Получаем все категории для маппинга
    let allCategories = [];
    try {
        const catRes = await fetch(`${API_BASE_URL}/categories`, { credentials: "include" });
        if (catRes.ok) {
            allCategories = await catRes.json();
        }
    } catch(e) {}
    
    // Создаём маппинг категорий
    const categoryMap = new Map();
    allCategories.forEach(cat => categoryMap.set(cat.id, cat.name));
    
    // Обрабатываем заказы
    orders.forEach(order => {
        const orderDate = new Date(order.created_at).toISOString().split('T')[0];
        const amount = parseFloat(order.final_amount || order.total_amount || 0);
        
        ordersByDate.set(orderDate, (ordersByDate.get(orderDate) || 0) + 1);
        revenueByDate.set(orderDate, (revenueByDate.get(orderDate) || 0) + amount);
        
        if (statusDistribution.hasOwnProperty(order.status)) {
            statusDistribution[order.status]++;
        }
        
        if (order.status === 'completed' || order.status === 'delivered') {
            totalRevenue += amount;
            completedOrdersCount++;
        }
    });
    
    // Сортируем даты
    const sortedDates = Array.from(ordersByDate.keys()).sort();
    analyticsData.ordersByDate = sortedDates.map(date => ({
        date,
        count: ordersByDate.get(date) || 0,
        revenue: revenueByDate.get(date) || 0
    }));
    
    analyticsData.statusDistribution = statusDistribution;
    analyticsData.totalRevenue = totalRevenue;
    analyticsData.totalOrders = orders.length;
    analyticsData.avgOrderValue = completedOrdersCount > 0 ? Math.round(totalRevenue / completedOrdersCount) : 0;
    
    // Пробуем загрузить детали для топ-компонентов
    if (orders.length > 0) {
        try {
            // Берём последние 50 заказов для анализа
            const recentOrders = orders.slice(-50);
            
            for (const order of recentOrders) {
                try {
                    const detailsRes = await fetch(`${API_BASE_URL}/orders/${order.id}`, { 
                        credentials: "include" 
                    });
                    
                    if (detailsRes.ok) {
                        const details = await detailsRes.json();
                        
                        if (details.success && details.components) {
                            details.components.forEach(comp => {
                                const compId = comp.component_id;
                                const quantity = comp.quantity || 1;
                                const price = parseFloat(comp.unit_price || 0);
                                const revenue = price * quantity;
                                
                                // Находим категорию компонента
                                const componentInfo = allComponents.find(c => c.id === compId);
                                const categoryId = componentInfo?.category_id;
                                const categoryName = categoryMap.get(categoryId) || 'Другое';
                                
                                if (componentSales.has(compId)) {
                                    const existing = componentSales.get(compId);
                                    componentSales.set(compId, {
                                        quantity: existing.quantity + quantity,
                                        revenue: existing.revenue + revenue,
                                        name: comp.name || existing.name,
                                        category: categoryName
                                    });
                                } else {
                                    componentSales.set(compId, {
                                        quantity: quantity,
                                        revenue: revenue,
                                        name: comp.name || `Компонент #${compId}`,
                                        category: categoryName
                                    });
                                }
                                
                                // Статистика по категориям
                                if (categoryName) {
                                    categorySales.set(categoryName, (categorySales.get(categoryName) || 0) + revenue);
                                }
                            });
                        }
                    }
                } catch(e) {
                    // Пропускаем ошибки отдельных заказов
                }
            }
        } catch(e) {
            console.warn("Не удалось загрузить детали заказов:", e);
        }
    }
    
    // Топ-10 компонентов
    analyticsData.topComponents = Array.from(componentSales.entries())
        .map(([id, data]) => ({
            id,
            name: data.name,
            category: data.category,
            quantity: data.quantity,
            revenue: data.revenue
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);
    
    // Категории
    analyticsData.categorySales = Array.from(categorySales.entries())
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6);
    
    // Если нет данных по категориям, добавляем заглушку
    if (analyticsData.categorySales.length === 0 && analyticsData.totalOrders > 0) {
        analyticsData.categorySales = [{ name: 'Нет данных', revenue: 1 }];
    }
    
    // Рост выручки
    const prevRevenue = await getPreviousPeriodRevenue(dateFrom, dateTo);
    analyticsData.growthRate = prevRevenue > 0 
        ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 
        : (totalRevenue > 0 ? 100 : 0);
}

async function getPreviousPeriodRevenue(currentFrom, currentTo) {
    const from = new Date(currentFrom);
    const to = new Date(currentTo);
    const duration = to - from;
    const prevFrom = new Date(from - duration);
    const prevTo = new Date(to - duration);
    
    try {
        const response = await fetch(`${API_BASE_URL}/my-orders`, { credentials: "include" });
        if (!response.ok) return 0;
        
        const orders = await response.json();
        let revenue = 0;
        
        orders.forEach(order => {
            if (!order.created_at) return;
            const orderDate = new Date(order.created_at).toISOString().split('T')[0];
            if (orderDate >= formatDate(prevFrom) && orderDate <= formatDate(prevTo)) {
                if (order.status === 'completed' || order.status === 'delivered') {
                    revenue += parseFloat(order.final_amount || order.total_amount || 0);
                }
            }
        });
        
        return revenue;
    } catch {
        return 0;
    }
}

// ============ ОТОБРАЖЕНИЕ СТАТИСТИКИ ============
function updateStatsDisplay() {
    const revenueEl = document.getElementById("totalRevenue");
    const ordersEl = document.getElementById("totalOrdersCount");
    const avgEl = document.getElementById("avgOrderValue");
    const growthEl = document.getElementById("growthRate");
    
    if (revenueEl) {
        revenueEl.textContent = new Intl.NumberFormat("ru-RU").format(analyticsData.totalRevenue) + " ₽";
    }
    if (ordersEl) {
        ordersEl.textContent = analyticsData.totalOrders;
    }
    if (avgEl) {
        avgEl.textContent = new Intl.NumberFormat("ru-RU").format(analyticsData.avgOrderValue) + " ₽";
    }
    
    if (growthEl) {
        const growth = analyticsData.growthRate;
        const icon = growth >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
        const color = growth >= 0 ? '#10b981' : '#ef4444';
        growthEl.innerHTML = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% <i class="fas ${icon}" style="font-size: 0.8rem; color: ${color};"></i>`;
        growthEl.style.color = color;
    }
}

// ============ ГРАФИКИ ============
function updateCharts() {
    const dates = analyticsData.ordersByDate.map(item => {
        const d = new Date(item.date);
        return `${d.getDate()}.${d.getMonth() + 1}`;
    });
    const orderCounts = analyticsData.ordersByDate.map(item => item.count);
    const revenues = analyticsData.ordersByDate.map(item => item.revenue);
    
    // Если нет данных, показываем заглушку
    const hasData = dates.length > 0;
    
    // График заказов
    const ordersCanvas = document.getElementById('ordersChart');
    if (ordersCanvas) {
        const ordersCtx = ordersCanvas.getContext('2d');
        if (charts.ordersChart) charts.ordersChart.destroy();
        
        charts.ordersChart = new Chart(ordersCtx, {
            type: 'line',
            data: {
                labels: hasData ? dates : ['Нет данных'],
                datasets: [{
                    label: 'Заказы',
                    data: hasData ? orderCounts : [0],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2,
                    pointBackgroundColor: '#3b82f6',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.raw} заказов` } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } }
                }
            }
        });
    }
    
    // График выручки
    const revenueCanvas = document.getElementById('revenueChart');
    if (revenueCanvas) {
        const revenueCtx = revenueCanvas.getContext('2d');
        if (charts.revenueChart) charts.revenueChart.destroy();
        
        charts.revenueChart = new Chart(revenueCtx, {
            type: 'bar',
            data: {
                labels: hasData ? dates : ['Нет данных'],
                datasets: [{
                    label: 'Выручка (₽)',
                    data: hasData ? revenues : [0],
                    backgroundColor: '#10b981',
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => new Intl.NumberFormat("ru-RU").format(ctx.raw) + ' ₽'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => new Intl.NumberFormat("ru-RU").format(value).replace(/\u00A0/g, ' ') + ' ₽'
                        }
                    }
                }
            }
        });
    }
    
    // График статусов
    const statusCanvas = document.getElementById('statusChart');
    if (statusCanvas) {
        const statusCtx = statusCanvas.getContext('2d');
        if (charts.statusChart) charts.statusChart.destroy();
        
        const statusLabels = {
            new: 'Новые',
            processing: 'В обработке',
            confirmed: 'Подтверждены',
            manufacturing: 'В производстве',
            ready: 'Готовы',
            delivered: 'Доставлены',
            completed: 'Выполнены',
            cancelled: 'Отменены'
        };
        
        const statusData = Object.entries(analyticsData.statusDistribution)
            .filter(([_, count]) => count > 0);
        
        if (statusData.length > 0) {
            charts.statusChart = new Chart(statusCtx, {
                type: 'doughnut',
                data: {
                    labels: statusData.map(s => statusLabels[s[0]] || s[0]),
                    datasets: [{
                        data: statusData.map(s => s[1]),
                        backgroundColor: [
                            '#3b82f6', '#f59e0b', '#10b981', '#ef4444',
                            '#8b5cf6', '#06b6d4', '#84cc16', '#94a3b8'
                        ],
                        borderWidth: 2,
                        borderColor: document.documentElement.getAttribute("data-theme") === "dark" ? '#1e293b' : '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { padding: 15, usePointStyle: true, pointStyleWidth: 10 }
                        },
                        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw} заказов` } }
                    }
                }
            });
        } else {
            charts.statusChart = new Chart(statusCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Нет данных'],
                    datasets: [{ data: [1], backgroundColor: ['#e2e8f0'], borderWidth: 0 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }
    }
    
    // График категорий
    const categoriesCanvas = document.getElementById('categoriesChart');
    if (categoriesCanvas) {
        const categoriesCtx = categoriesCanvas.getContext('2d');
        if (charts.categoriesChart) charts.categoriesChart.destroy();
        
        if (analyticsData.categorySales.length > 0 && analyticsData.categorySales[0].name !== 'Нет данных') {
            charts.categoriesChart = new Chart(categoriesCtx, {
                type: 'pie',
                data: {
                    labels: analyticsData.categorySales.map(c => c.name),
                    datasets: [{
                        data: analyticsData.categorySales.map(c => c.revenue),
                        backgroundColor: [
                            '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
                            '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
                        ],
                        borderWidth: 2,
                        borderColor: document.documentElement.getAttribute("data-theme") === "dark" ? '#1e293b' : '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { padding: 15, usePointStyle: true, pointStyleWidth: 10 }
                        },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                    const percent = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                                    return ctx.label + ': ' + new Intl.NumberFormat("ru-RU").format(ctx.raw) + ' ₽ (' + percent + '%)';
                                }
                            }
                        }
                    }
                }
            });
        } else {
            charts.categoriesChart = new Chart(categoriesCtx, {
                type: 'pie',
                data: {
                    labels: ['Нет данных'],
                    datasets: [{ data: [1], backgroundColor: ['#e2e8f0'], borderWidth: 0 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }
    }
}

// ============ ТОП КОМПОНЕНТОВ ============
function updateTopComponents() {
    const tbody = document.getElementById('topComponentsBody');
    if (!tbody) return;
    
    if (!analyticsData.topComponents.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">Нет данных о продажах за выбранный период</td></tr>';
        return;
    }
    
    tbody.innerHTML = analyticsData.topComponents.map((comp, i) => {
        let rankClass = '';
        if (i === 0) rankClass = 'rank-1';
        else if (i === 1) rankClass = 'rank-2';
        else if (i === 2) rankClass = 'rank-3';
        
        return `
            <tr>
                <td style="width: 50px;">
                    <span class="rank-badge ${rankClass}" style="display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; ${i === 0 ? 'background: #f59e0b; color: white;' : i === 1 ? 'background: #94a3b8; color: white;' : i === 2 ? 'background: #cd7f32; color: white;' : 'background: var(--bg-panel); color: var(--text-muted);'}">${i + 1}</span>
                </td>
                <td><strong>${comp.name || 'Компонент #' + comp.id}</strong></td>
                <td>${comp.category || '—'}</td>
                <td>${comp.quantity} шт.</td>
                <td><strong>${new Intl.NumberFormat("ru-RU").format(comp.revenue)} ₽</strong></td>
            </tr>
        `;
    }).join('');
}

// ============ СТАТУСЫ ============
function updateStatusDetails() {
    const container = document.getElementById('statusDetails');
    if (!container) return;
    
    const statuses = [
        { key: 'new', name: 'Новые', icon: '📝', color: '#3b82f6' },
        { key: 'processing', name: 'В обработке', icon: '⚙️', color: '#f59e0b' },
        { key: 'confirmed', name: 'Подтверждены', icon: '✅', color: '#10b981' },
        { key: 'manufacturing', name: 'В производстве', icon: '🏭', color: '#ef4444' },
        { key: 'ready', name: 'Готовы', icon: '📦', color: '#8b5cf6' },
        { key: 'delivered', name: 'Доставлены', icon: '🚚', color: '#06b6d4' },
        { key: 'completed', name: 'Выполнены', icon: '🎉', color: '#10b981' },
        { key: 'cancelled', name: 'Отменены', icon: '❌', color: '#94a3b8' }
    ];
    
    container.innerHTML = `<div class="status-grid">` + 
        statuses.map(s => `
            <div class="status-card" style="text-align: center; padding: 20px 15px; background: var(--bg-panel); border-radius: 12px; border: 1px solid var(--border-color); border-left: 4px solid ${s.color};">
                <div style="font-size: 1.8rem; margin-bottom: 5px;">${s.icon}</div>
                <div style="font-size: 2rem; font-weight: 700; margin-bottom: 5px;">${analyticsData.statusDistribution[s.key] || 0}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${s.name}</div>
            </div>
        `).join('') + `</div>`;
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
function showLoading(show) {
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = show ? "flex" : "none";
}

function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    const icon = type === "success" ? "check-circle" : 
                type === "error" ? "exclamation-circle" : 
                type === "warning" ? "exclamation-triangle" : "info-circle";
    notification.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Обновление данных при изменении темы
window.addEventListener('storage', (e) => {
    if (e.key === 'theme') {
        setTimeout(() => updateCharts(), 100);
    }
});