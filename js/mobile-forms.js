// mobile-forms.js (исправленная версия — без крестиков очистки полей)

document.addEventListener("DOMContentLoaded", () => {
  initMobileFormEnhancements();
});

function initMobileFormEnhancements() {
  // Устанавливаем атрибуты для мобильных устройств (автозаполнение, автокоррекция)
  document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="search"]').forEach(input => {
    input.setAttribute('autocomplete', 'on');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'off');
  });
  
  // Автоматический фокус на первом поле в модальных окнах
  document.querySelectorAll('.modal').forEach(modal => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.target.style.display === 'flex') {
          const firstInput = modal.querySelector('input, select, textarea');
          if (firstInput) {
            setTimeout(() => firstInput.focus(), 300);
          }
        }
      });
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
  });
  
  // Валидация email
  document.querySelectorAll('input[type="email"]').forEach(input => {
    input.addEventListener('blur', function() {
      if (this.value && !isValidEmail(this.value)) {
        this.style.borderColor = 'var(--danger-color)';
        showFieldError(this, 'Некорректный email');
      } else {
        this.style.borderColor = '';
        hideFieldError(this);
      }
    });
    input.addEventListener('input', function() {
      if (isValidEmail(this.value) || !this.value) {
        this.style.borderColor = '';
        hideFieldError(this);
      }
    });
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFieldError(input, message) {
  hideFieldError(input);
  const error = document.createElement('div');
  error.className = 'field-error';
  error.style.cssText = 'color: var(--danger-color); font-size: 0.75rem; margin-top: 4px;';
  error.textContent = message;
  input.parentNode.parentNode.appendChild(error);
}

function hideFieldError(input) {
  const error = input.parentNode.parentNode.querySelector('.field-error');
  if (error) error.remove();
}