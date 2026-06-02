// scroll-top.js

document.addEventListener("DOMContentLoaded", () => {
  initScrollTopButton();
});

function initScrollTopButton() {
  // Создаём кнопку
  const btn = document.createElement('button');
  btn.id = 'scrollTopBtn';
  btn.className = 'btn-scroll-top';
  btn.innerHTML = '<i class="fas fa-chevron-up"></i>';
  btn.title = 'Наверх';
  
  document.body.appendChild(btn);
  
  // Показываем/скрываем при скролле
  let scrollTimeout;
  
  window.addEventListener('scroll', () => {
    if (scrollTimeout) {
      window.cancelAnimationFrame(scrollTimeout);
    }
    
    scrollTimeout = window.requestAnimationFrame(() => {
      if (window.pageYOffset > 300) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    });
  });
  
  // Плавный скролл наверх
  btn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
  
  // Скрываем при наведении на подвал
  const footer = document.querySelector('footer');
  if (footer) {
    const footerObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          btn.style.bottom = '130px';
        } else {
          btn.style.bottom = '100px';
        }
      });
    });
    
    footerObserver.observe(footer);
  }
}