// performance.js

// ============ ДЕБАУНС ДЛЯ ПОИСКА ============
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ============ ЛЕНИВАЯ ЗАГРУЗКА ИЗОБРАЖЕНИЙ ============
function initLazyLoading() {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  } else {
    // Фолбэк для старых браузеров
    document.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
  }
}

// ============ ПРИМЕНЯЕМ ДЕБАУНС К ПОИСКУ ============
document.addEventListener("DOMContentLoaded", () => {
  const catalogSearch = document.getElementById('catalogSearch');
  if (catalogSearch) {
    const originalHandler = catalogSearch.oninput;
    catalogSearch.addEventListener('input', debounce((e) => {
      if (typeof window.filterCatalog === 'function') {
        window.filterCatalog();
      }
    }, 300));
  }
  
  // Инициализируем lazy load
  setTimeout(initLazyLoading, 1000);
});