// compare.js
let compareList = JSON.parse(localStorage.getItem("compareList") || "[]");

function initCompare() {
  updateCompareBar();
  updateCompareCheckboxes();
}

function addToCompare(componentId) {
  if (compareList.length >= 3) {
    showNotification("Можно сравнить не более 3 компонентов", "warning");
    return;
  }
  
  if (compareList.includes(componentId)) {
    showNotification("Компонент уже добавлен в сравнение", "info");
    return;
  }
  
  const comp = allComponents.find(c => c.id === componentId);
  if (!comp) return;
  
  compareList.push(componentId);
  localStorage.setItem("compareList", JSON.stringify(compareList));
  updateCompareBar();
  updateCompareCheckboxes();
  showNotification(`"${comp.name}" добавлен в сравнение`, "success");
}

function removeFromCompare(componentId) {
  compareList = compareList.filter(id => id !== componentId);
  localStorage.setItem("compareList", JSON.stringify(compareList));
  updateCompareBar();
  updateCompareCheckboxes();
}

function clearCompare() {
  compareList = [];
  localStorage.setItem("compareList", JSON.stringify(compareList));
  updateCompareBar();
  updateCompareCheckboxes();
  closeCompareModal();
}

function updateCompareBar() {
  const bar = document.getElementById("compareBar");
  if (!bar) return;
  
  if (compareList.length === 0) {
    bar.classList.remove("active");
    return;
  }
  
  bar.classList.add("active");
  
  const slots = bar.querySelectorAll(".compare-slot");
  const components = compareList.map(id => allComponents.find(c => c.id === id)).filter(Boolean);
  
  slots.forEach((slot, i) => {
    if (components[i]) {
      slot.classList.add("filled");
      slot.innerHTML = `
        <span>${components[i].name.substring(0, 20)}</span>
        <button class="remove-compare" onclick="removeFromCompare(${components[i].id})">×</button>
      `;
    } else {
      slot.classList.remove("filled");
      slot.innerHTML = '<span>Пусто</span>';
    }
  });
  
  const compareBtn = bar.querySelector(".btn-compare");
  if (compareBtn) compareBtn.disabled = compareList.length < 2;
}

function updateCompareCheckboxes() {
  document.querySelectorAll(".compare-checkbox-input").forEach(cb => {
    cb.checked = compareList.includes(parseInt(cb.dataset.componentId));
  });
}

function openCompareModal() {
  if (compareList.length < 2) {
    showNotification("Выберите минимум 2 компонента для сравнения", "warning");
    return;
  }
  
  const components = compareList.map(id => allComponents.find(c => c.id === id)).filter(Boolean);
  if (components.length < 2) return;
  
  const properties = [
    { key: "price", label: "Цена", format: v => new Intl.NumberFormat("ru-RU").format(v) + " ₽" },
    { key: "manufacturer", label: "Производитель", format: v => v || "—" },
    { key: "category_name", label: "Категория", format: v => v || "—" },
    { key: "power_rating", label: "Мощность (А)", format: v => v || "—" },
    { key: "voltage", label: "Напряжение (В)", format: v => v || "—" },
    { key: "in_stock", label: "В наличии", format: v => v ? "✅ Да" : "❌ Нет" },
    { key: "description", label: "Описание", format: v => v || "—" },
  ];
  
  let html = '<div class="compare-table-wrap"><table class="compare-table"><thead><tr><th>Характеристика</th>';
  
  components.forEach(c => {
    html += `<th><strong>${c.name}</strong></th>`;
  });
  
  html += '</tr></thead><tbody>';
  
  properties.forEach(prop => {
    const values = components.map(c => c[prop.key]);
    const allSame = values.every(v => v === values[0]);
    
    html += '<tr>';
    html += `<td><strong>${prop.label}</strong></td>`;
    
    values.forEach(v => {
      html += `<td class="${!allSame ? 'compare-highlight' : ''}">${prop.format(v)}</td>`;
    });
    
    html += '</tr>';
  });
  
  html += '</tbody></table></div>';
  
  document.getElementById("compareContent").innerHTML = html;
  document.getElementById("compareModal").style.display = "flex";
}

function closeCompareModal() {
  document.getElementById("compareModal").style.display = "none";
}

// Инициализация при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  // Добавляем HTML-структуру сравнения
  const compareBarHTML = `
    <div class="compare-bar" id="compareBar">
      <div class="compare-bar-content">
        <div class="compare-bar-title"><i class="fas fa-balance-scale"></i> Сравнение</div>
        <div class="compare-slots">
          <div class="compare-slot">Компонент 1</div>
          <div class="compare-slot">Компонент 2</div>
          <div class="compare-slot">Компонент 3</div>
        </div>
        <div class="compare-actions">
          <button class="btn-compare" onclick="openCompareModal()" disabled>
            <i class="fas fa-columns"></i> Сравнить
          </button>
          <button class="btn-clear-compare" onclick="clearCompare()">
            <i class="fas fa-trash"></i> Очистить
          </button>
        </div>
      </div>
    </div>
    <div class="modal" id="compareModal">
      <div class="modal-content large">
        <div class="modal-header">
          <h2><i class="fas fa-balance-scale"></i> Сравнение компонентов</h2>
          <span class="close" onclick="closeCompareModal()">&times;</span>
        </div>
        <div id="compareContent"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeCompareModal()">Закрыть</button>
          <button class="btn btn-danger" onclick="clearCompare()">Очистить сравнение</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML("beforeend", compareBarHTML);
  
  // Ждём загрузки компонентов
  setTimeout(initCompare, 1000);
});

// Добавляем чекбоксы сравнения к компонентам
function addCompareCheckboxesToComponents() {
  document.querySelectorAll(".component-item, .component-card").forEach(el => {
    if (el.querySelector(".compare-checkbox")) return;
    
    const compId = el.querySelector(".add-btn")?.getAttribute("onclick")?.match(/\d+/);
    if (!compId) return;
    
    const checkbox = document.createElement("label");
    checkbox.className = "compare-checkbox";
    checkbox.style.cssText = "margin-top: 8px; font-size: 0.8rem;";
    checkbox.innerHTML = `
      <input type="checkbox" class="compare-checkbox-input" 
             data-component-id="${compId[0]}" 
             onchange="toggleCompareCheckbox(this)">
      <span>Сравнить</span>
    `;
    
    el.querySelector(".component-info, h4")?.parentElement?.appendChild(checkbox);
  });
}

function toggleCompareCheckbox(cb) {
  const id = parseInt(cb.dataset.componentId);
  if (cb.checked) addToCompare(id);
  else removeFromCompare(id);
}

window.addToCompare = addToCompare;
window.removeFromCompare = removeFromCompare;
window.clearCompare = clearCompare;
window.openCompareModal = openCompareModal;
window.closeCompareModal = closeCompareModal;
window.toggleCompareCheckbox = toggleCompareCheckbox;