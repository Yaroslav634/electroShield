// breadcrumbs.js
document.addEventListener("DOMContentLoaded", () => {
  initBreadcrumbs();
});

function initBreadcrumbs() {
  const container = document.getElementById("breadcrumbsContainer");
  if (!container) return;

  const path = window.location.pathname;
  const hash = window.location.hash;
  const isHome = path === "/" || path === "/index.html";
  const isOrders = path.includes("orders");
  const isAdmin = path.includes("admin.html");

  let html = '<a href="/"><i class="fas fa-home"></i> Главная</a>';

  if (isOrders) {
    html += '<span class="separator">/</span>';
    html += '<span class="current">Мои заказы</span>';
  } 
  else if (isAdmin) {
    html += '<span class="separator">/</span>';
    html += '<span class="current">Админ-панель</span>';
  } 
  else if (isHome) {
    if (hash === "#catalog") {
      html += '<span class="separator">/</span>';
      html += '<a href="#configurator">Конфигуратор</a>';
      html += '<span class="separator">/</span>';
      html += '<span class="current">Каталог</span>';
    } 
    else if (hash === "#configurator" || !hash || hash === "") {
      html += '<span class="separator">/</span>';
      html += '<span class="current">Конфигуратор</span>';
    }
  }

  container.innerHTML = html;
  window.addEventListener("hashchange", initBreadcrumbs);
}