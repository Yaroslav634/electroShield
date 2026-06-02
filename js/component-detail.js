// component-detail.js

function openComponentDetail(componentId) {
  const comp = allComponents.find(c => c.id === componentId);
  if (!comp) return;

  const related = allComponents
    .filter(c => c.category_id === comp.category_id && c.id !== comp.id)
    .slice(0, 4);

  // Изображение
  const imageHTML = comp.image_url
    ? `<img src="${comp.image_url}" alt="${comp.name}" 
           onerror="this.style.display='none'; this.parentElement.querySelector('.no-photo').style.display='flex';"
           onload="this.parentElement.querySelector('.no-photo').style.display='none';">`
    : '';

  const noPhotoHTML = `
    <div class="no-photo" style="display: ${comp.image_url ? 'none' : 'flex'}; align-items: center; justify-content: center; width: 100%; height: 100%;">
      <i class="fas fa-microchip"></i>
    </div>`;

  // Характеристики
  const specsHTML = [
    { label: "Производитель", value: comp.manufacturer || "Не указан", icon: "fa-industry" },
    { label: "Категория", value: comp.category_name || "Без категории", icon: "fa-folder" },
    { label: "Мощность", value: comp.power_rating || "—", icon: "fa-bolt" },
    { label: "Напряжение", value: comp.voltage || "—", icon: "fa-plug" },
    { label: "Наличие", value: comp.in_stock ? "В наличии" : "Нет в наличии", 
      icon: comp.in_stock ? "fa-check-circle" : "fa-times-circle",
      class: comp.in_stock ? "spec-available" : "spec-unavailable" },
    { label: "Артикул", value: `ART-${comp.id.toString().padStart(4, '0')}`, icon: "fa-hashtag" },
  ].map(s => `
    <div class="component-spec-item ${s.class || ''}">
      <span class="component-spec-label"><i class="fas ${s.icon}"></i> ${s.label}</span>
      <span class="component-spec-value">${escapeHtml(s.value)}</span>
    </div>
  `).join("");

  // Похожие товары
  let relatedHTML = '';
  if (related.length > 0) {
    relatedHTML = `
      <div class="related-section">
        <h4><i class="fas fa-layer-group"></i> Похожие товары</h4>
        <div class="related-grid">
          ${related.map(r => `
            <div class="related-card" onclick="openComponentDetail(${r.id})">
              <div class="related-card-image">
                ${r.image_url 
                  ? `<img src="${r.image_url}" alt="${r.name}" 
                       onerror="this.style.display='none'; this.parentElement.querySelector('.no-photo').style.display='flex';"
                       onload="this.parentElement.querySelector('.no-photo').style.display='none';">`
                  : ''}
                <div class="no-photo" style="display: ${r.image_url ? 'none' : 'flex'}; align-items: center; justify-content: center; width: 100%; height: 100%;">
                  <i class="fas fa-microchip"></i>
                </div>
              </div>
              <h5>${escapeHtml(r.name)}</h5>
              <div class="price">${new Intl.NumberFormat("ru-RU").format(r.price)} ₽</div>
            </div>
          `).join("")}
        </div>
      </div>`;
  }

  const html = `
    <div class="component-detail-grid">
      <!-- Фото -->
      <div class="component-detail-image">
        ${imageHTML}
        ${noPhotoHTML}
        ${!comp.in_stock ? '<div class="out-of-stock-badge">Нет в наличии</div>' : ''}
      </div>

      <!-- Информация -->
      <div class="component-detail-info">
        <div>
          <h2>${escapeHtml(comp.name)}</h2>
          ${comp.manufacturer ? `<span class="detail-manufacturer"><i class="fas fa-industry"></i> ${escapeHtml(comp.manufacturer)}</span>` : ''}
        </div>
        
        <p class="detail-description">${escapeHtml(comp.description || "Описание отсутствует")}</p>
        
        <div class="component-detail-price">
          ${new Intl.NumberFormat("ru-RU").format(comp.price)} ₽
          ${comp.in_stock ? '<span class="price-available"><i class="fas fa-check"></i> В наличии</span>' : '<span class="price-unavailable"><i class="fas fa-times"></i> Нет в наличии</span>'}
        </div>

        <div class="detail-divider"></div>

        <h4><i class="fas fa-list-ul"></i> Характеристики</h4>
        <div class="component-specs">${specsHTML}</div>

        ${relatedHTML}

        <div class="detail-actions">
          <button class="btn btn-primary" onclick="addToCart(${comp.id}); closeComponentDetail();" ${!comp.in_stock ? 'disabled' : ''}>
            <i class="fas fa-cart-plus"></i> ${comp.in_stock ? 'Добавить в корзину' : 'Нет в наличии'}
          </button>
          <button class="btn btn-secondary" onclick="closeComponentDetail()">
            <i class="fas fa-times"></i> Закрыть
          </button>
        </div>
      </div>
    </div>
  `;

  // Получаем или создаём модальное окно
  let modal = document.getElementById('componentDetailModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'componentDetailModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2><i class="fas fa-info-circle"></i> Детали компонента</h2>
          <span class="close" onclick="closeComponentDetail()">&times;</span>
        </div>
        <div class="modal-body" id="componentDetailContent"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeComponentDetail()">Закрыть</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById("componentDetailContent").innerHTML = html;
  modal.style.display = "flex";
}

function closeComponentDetail() {
  const modal = document.getElementById("componentDetailModal");
  if (modal) modal.style.display = "none";
}

// Инициализация
document.addEventListener("DOMContentLoaded", () => {
  // Убеждаемся, что модальное окно создано
  if (!document.getElementById('componentDetailModal')) {
    const modal = document.createElement('div');
    modal.id = 'componentDetailModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2><i class="fas fa-info-circle"></i> Детали компонента</h2>
          <span class="close" onclick="closeComponentDetail()">&times;</span>
        </div>
        <div class="modal-body" id="componentDetailContent"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeComponentDetail()">Закрыть</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
});

window.openComponentDetail = openComponentDetail;
window.closeComponentDetail = closeComponentDetail;