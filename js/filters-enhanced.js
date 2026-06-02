// filters-enhanced.js

let currentShowMorePage = 1;
const SHOW_MORE_STEP = 12;
let allFilteredComponents = [];
let isLoadingMore = false;

document.addEventListener("DOMContentLoaded", () => {
  console.log('Фильтры инициализация начата');
  setTimeout(() => {
    initQuickFilters();
    initMobileFilterBar();
    initShowMoreButton();
    console.log('Фильтры инициализированы');
  }, 500);
});

function initQuickFilters() {
  const filtersBody = document.querySelector('.filter-sidebar-body');
  if (!filtersBody) return;
  if (document.getElementById('quickFilters')) return;

  const quickSection = document.createElement('div');
  quickSection.className = 'filter-section';
  quickSection.style.marginBottom = '20px';
  quickSection.innerHTML = `
    <div class="filter-section-title" style="font-size: 0.85rem; margin-bottom: 10px;">
      <i class="fas fa-bolt"></i> Быстрые фильтры
    </div>
    <div class="filter-quick-actions" id="quickFilters">
      <button class="filter-quick-btn active" data-filter="all">Все товары</button>
      <button class="filter-quick-btn" data-filter="in-stock">В наличии</button>
      <button class="filter-quick-btn" data-filter="out-stock">Нет в наличии</button>
      <button class="filter-quick-btn" data-filter="price-low">Дешевле (сначала)</button>
      <button class="filter-quick-btn" data-filter="price-high">Дороже (сначала)</button>
    </div>
  `;

  const activeFilters = filtersBody.querySelector('.active-filters-section');
  if (activeFilters) {
    activeFilters.after(quickSection);
  } else {
    filtersBody.insertBefore(quickSection, filtersBody.firstChild);
  }

  document.querySelectorAll('#quickFilters .filter-quick-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const filter = this.dataset.filter;
      document.querySelectorAll('#quickFilters .filter-quick-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      switch(filter) {
        case 'all':
          if (typeof window.resetAllFilters === 'function') {
            window.resetAllFilters();
          }
          break;
        case 'in-stock':
          const inStockSelect = document.getElementById('sidebarFilterInStock');
          if (inStockSelect) inStockSelect.value = 'true';
          if (typeof window.catalogFilters !== 'undefined') {
            window.catalogFilters.inStock = 'true';
          }
          if (typeof window.filterCatalog === 'function') {
            window.filterCatalog();
          }
          break;
        case 'out-stock':
          const outStockSelect = document.getElementById('sidebarFilterInStock');
          if (outStockSelect) outStockSelect.value = 'false';
          if (typeof window.catalogFilters !== 'undefined') {
            window.catalogFilters.inStock = 'false';
          }
          if (typeof window.filterCatalog === 'function') {
            window.filterCatalog();
          }
          break;
        case 'price-low':
          if (typeof window.updateCatalogSort === 'function') {
            window.updateCatalogSort('price-asc');
          }
          break;
        case 'price-high':
          if (typeof window.updateCatalogSort === 'function') {
            window.updateCatalogSort('price-desc');
          }
          break;
      }
      updateMobileChips(filter);
      resetShowMore();
    });
  });
}

// Глобальная функция сброса всех фильтров
window.resetAllFilters = function() {
  console.log('resetAllFilters вызван');
  
  // Сбрасываем catalogFilters если он существует
  if (typeof window.catalogFilters !== 'undefined') {
    window.catalogFilters = {
      search: "",
      categoryId: "",
      priceMin: "",
      priceMax: "",
      inStock: "all",
      manufacturer: "all"
    };
  }
  
  // Сбрасываем currentSort
  if (typeof window.currentSort !== 'undefined') {
    window.currentSort = 'default';
  }
  
  // Очищаем поля поиска
  const searchInput = document.getElementById("catalogSearch");
  if (searchInput) searchInput.value = "";
  
  const categorySelect = document.getElementById("catalogCategory");
  if (categorySelect) categorySelect.value = "";
  
  // Сбрасываем фильтры в боковой панели
  const priceMinInput = document.getElementById("sidebarFilterPriceMin");
  const priceMaxInput = document.getElementById("sidebarFilterPriceMax");
  if (priceMinInput) priceMinInput.value = "";
  if (priceMaxInput) priceMaxInput.value = "";
  
  const inStockSelect = document.getElementById("sidebarFilterInStock");
  if (inStockSelect) inStockSelect.value = "all";
  
  const manufacturerSelect = document.getElementById("sidebarFilterManufacturer");
  if (manufacturerSelect) manufacturerSelect.value = "all";
  
  // Сбрасываем чипсы сортировки
  document.querySelectorAll('.sort-chip').forEach(chip => {
    chip.classList.remove('active');
    if (chip.dataset.sort === 'default') {
      chip.classList.add('active');
    }
  });
  
  // Сбрасываем быстрые фильтры
  document.querySelectorAll('#quickFilters .filter-quick-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.filter === 'all') {
      btn.classList.add('active');
    }
  });
  
  // Вызываем фильтрацию каталога
  if (typeof window.filterCatalog === 'function') {
    window.filterCatalog();
  }
  
  // Обновляем отображение активных фильтров
  if (typeof window.updateActiveFiltersDisplay === 'function') {
    window.updateActiveFiltersDisplay();
  }
  
  // Сбрасываем пагинацию
  resetShowMore();
  
  showNotification("Все фильтры сброшены", "info");
};

function updateMobileChips(activeFilter) {
  document.querySelectorAll('.mobile-filter-chip[data-filter]').forEach(chip => {
    chip.classList.remove('active');
    if (chip.dataset.filter === activeFilter) {
      chip.classList.add('active');
    }
  });
}

function initMobileFilterBar() {
  if (window.innerWidth > 768) return;

  const catalog = document.getElementById('catalog');
  if (!catalog) return;
  if (document.querySelector('.mobile-filter-bar')) return;

  const mobileBar = document.createElement('div');
  mobileBar.className = 'mobile-filter-bar';
  mobileBar.innerHTML = `
    <div class="mobile-filter-bar-content">
      <div class="mobile-filter-chip active" data-filter="all">Все</div>
      <div class="mobile-filter-chip" data-filter="in-stock">В наличии</div>
      <div class="mobile-filter-chip" data-filter="price-low">Дешевле</div>
      <div class="mobile-filter-chip" data-filter="price-high">Дороже</div>
      <div class="mobile-filter-chip" data-filter="filters" onclick="if(window.openFilterSidebar) window.openFilterSidebar()">
        <i class="fas fa-sliders-h"></i> Фильтры
      </div>
    </div>
  `;

  const sectionHeader = catalog.querySelector('.section-header');
  if (sectionHeader) {
    sectionHeader.after(mobileBar);
  } else {
    catalog.insertBefore(mobileBar, catalog.firstChild);
  }

  mobileBar.querySelectorAll('.mobile-filter-chip[data-filter]').forEach(chip => {
    chip.addEventListener('click', function() {
      const filter = this.dataset.filter;
      if (filter === 'filters') return;
      const quickBtn = document.querySelector(`#quickFilters [data-filter="${filter}"]`);
      if (quickBtn) {
        quickBtn.click();
      }
    });
  });
}

// ============ ПОКАЗАТЬ ЕЩЕ ============

function initShowMoreButton() {
  const oldPagination = document.getElementById('paginationContainer');
  if (oldPagination) {
    oldPagination.remove();
  }
  
  let showMoreContainer = document.getElementById('showMoreContainer');
  if (!showMoreContainer) {
    showMoreContainer = document.createElement('div');
    showMoreContainer.id = 'showMoreContainer';
    showMoreContainer.style.cssText = 'text-align: center; margin: 40px 0 20px;';
    
    const catalogGrid = document.getElementById('catalogGrid');
    if (catalogGrid && catalogGrid.parentNode) {
      catalogGrid.parentNode.insertBefore(showMoreContainer, catalogGrid.nextSibling);
    }
  }
}

function resetShowMore() {
  currentShowMorePage = 1;
  allFilteredComponents = [];
  
  const catalogGrid = document.getElementById("catalogGrid");
  if (catalogGrid) {
    catalogGrid.innerHTML = '';
  }
  
  const showMoreContainer = document.getElementById('showMoreContainer');
  if (showMoreContainer) {
    showMoreContainer.innerHTML = '';
  }
}

function renderCatalogWithShowMore(filteredComponents) {
  allFilteredComponents = filteredComponents;
  currentShowMorePage = 1;
  
  const catalogGrid = document.getElementById("catalogGrid");
  if (!catalogGrid) return;
  
  catalogGrid.innerHTML = '';
  loadMoreItems();
}

function loadMoreItems() {
  if (isLoadingMore) return;
  isLoadingMore = true;
  
  const catalogGrid = document.getElementById("catalogGrid");
  if (!catalogGrid) {
    isLoadingMore = false;
    return;
  }
  
  const end = currentShowMorePage * SHOW_MORE_STEP;
  const itemsToLoad = allFilteredComponents.slice(0, end);
  
  catalogGrid.innerHTML = '';
  
  itemsToLoad.forEach(comp => {
    const card = createComponentCardHTML(comp);
    catalogGrid.insertAdjacentHTML('beforeend', card);
  });
  
  isLoadingMore = false;
  updateShowMoreButton();
}

function updateShowMoreButton() {
  const showMoreContainer = document.getElementById('showMoreContainer');
  if (!showMoreContainer) return;
  
  const loadedCount = currentShowMorePage * SHOW_MORE_STEP;
  const totalCount = allFilteredComponents.length;
  
  if (loadedCount >= totalCount) {
    if (totalCount > 0) {
      showMoreContainer.innerHTML = '<div style="color: var(--text-muted); padding: 20px;"><i class="fas fa-check-circle"></i> Все товары загружены (' + totalCount + ' шт.)</div>';
    } else {
      showMoreContainer.innerHTML = '';
    }
  } else {
    const remaining = totalCount - loadedCount;
    showMoreContainer.innerHTML = `
      <button id="showMoreBtn" class="btn-show-more" style="
        background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
        color: white;
        border: none;
        padding: 14px 40px;
        border-radius: 50px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 15px rgba(59,130,246,0.3);
      ">
        <i class="fas fa-arrow-down"></i> Показать еще (${remaining} осталось)
      </button>
    `;
    
    const showMoreBtn = document.getElementById('showMoreBtn');
    if (showMoreBtn) {
      showMoreBtn.addEventListener('click', () => {
        currentShowMorePage++;
        loadMoreItems();
        
        showMoreBtn.style.transform = 'scale(0.98)';
        setTimeout(() => {
          showMoreBtn.style.transform = 'scale(1)';
        }, 150);
      });
      
      showMoreBtn.addEventListener('mouseenter', () => {
        showMoreBtn.style.transform = 'translateY(-3px)';
        showMoreBtn.style.boxShadow = '0 8px 25px rgba(59,130,246,0.4)';
      });
      
      showMoreBtn.addEventListener('mouseleave', () => {
        showMoreBtn.style.transform = 'translateY(0)';
        showMoreBtn.style.boxShadow = '0 4px 15px rgba(59,130,246,0.3)';
      });
    }
  }
}

function createComponentCardHTML(comp) {
  return `
    <div class="component-card" onclick="window.openComponentDetail(${comp.id})" style="cursor: pointer;">
      <div class="card-image">
        ${comp.image_url 
          ? `<img src="${comp.image_url}" alt="${escapeHtml(comp.name)}" 
               onerror="this.style.display='none'; this.parentElement.querySelector('.no-photo').style.display='flex';"
               onload="this.parentElement.querySelector('.no-photo').style.display='none';">`
          : ''}
        <div class="no-photo" style="display: ${comp.image_url ? 'none' : 'flex'}; align-items: center; justify-content: center; width: 100%; height: 100%;">
          <i class="fas fa-microchip" style="font-size: 3rem; opacity: 0.4;"></i>
        </div>
        ${!comp.in_stock ? '<div class="out-of-stock-overlay"><i class="fas fa-times-circle"></i> Нет в наличии</div>' : ''}
      </div>
      
      <h4>${escapeHtml(comp.name)}</h4>
      <div class="manufacturer">
        <i class="fas fa-industry"></i> ${escapeHtml(comp.manufacturer || "Производитель не указан")}
      </div>
      <div class="description">${escapeHtml(comp.description || "Описание отсутствует")}</div>
      
      <div class="price">
        ${new Intl.NumberFormat("ru-RU").format(comp.price)} ₽
        <small>за шт.</small>
      </div>
      
      <div class="card-actions">
        <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); window.addToCart(${comp.id})" ${!comp.in_stock ? 'disabled' : ''}>
          <i class="fas fa-cart-plus"></i> В корзину
        </button>
        <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); window.openComponentDetail(${comp.id})">
          <i class="fas fa-info-circle"></i>
        </button>
      </div>
    </div>
  `;
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

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  const icon = type === "success" ? "check-circle" : type === "error" ? "exclamation-circle" : type === "warning" ? "exclamation-triangle" : "info-circle";
  notification.innerHTML = `<i class="fas fa-${icon}"></i> ${escapeHtml(message)}`;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

window.renderCatalogWithShowMore = renderCatalogWithShowMore;
window.resetShowMore = resetShowMore;