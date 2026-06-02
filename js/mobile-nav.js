// mobile-nav.js (без нижнего меню)

document.addEventListener("DOMContentLoaded", () => {
  // Нижнее меню ОТКЛЮЧЕНО
  // initMobileBottomNav();
  initSwipeGestures();
});

// Функция initMobileBottomNav удалена

function initSwipeGestures() {
  const filterSidebar = document.getElementById('filterSidebar');
  if (!filterSidebar) return;
  
  let touchStartX = 0;
  let touchEndX = 0;
  
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });
  
  document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });
  
  function handleSwipe() {
    const swipeDistance = touchEndX - touchStartX;
    const threshold = 100;
    
    // Свайп вправо — открываем фильтры
    if (swipeDistance > threshold && touchStartX < 50) {
      if (typeof window.openFilterSidebar === 'function') {
        window.openFilterSidebar();
      }
    }
    
    // Свайп влево — закрываем фильтры
    if (swipeDistance < -threshold && filterSidebar.classList.contains('active')) {
      if (typeof window.closeFilterSidebar === 'function') {
        window.closeFilterSidebar();
      }
    }
  }
}