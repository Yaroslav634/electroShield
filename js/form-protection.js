// form-protection.js

function protectForm(formElement, submitButton) {
  let isSubmitting = false;
  
  const originalText = submitButton.innerHTML;
  
  formElement.addEventListener('submit', async function(e) {
    if (isSubmitting) {
      e.preventDefault();
      return false;
    }
    
    isSubmitting = true;
    
    // Показываем спиннер
    submitButton.disabled = true;
    submitButton.innerHTML = `
      <i class="fas fa-spinner fa-spin"></i>
      <span>Отправка...</span>
    `;
    
    // Автоматически сбрасываем через 30 секунд
    setTimeout(() => {
      if (isSubmitting) {
        isSubmitting = false;
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
        showNotification('Превышено время ожидания. Попробуйте снова.', 'warning');
      }
    }, 30000);
    
    return true;
  });
  
  // Функция для сброса состояния
  window.resetSubmitButton = function() {
    isSubmitting = false;
    submitButton.disabled = false;
    submitButton.innerHTML = originalText;
  };
}

// Применяем к форме заказа
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const orderForm = document.getElementById('orderForm');
    const confirmBtn = document.getElementById('confirmOrderBtn');
    if (orderForm && confirmBtn) {
      protectForm(orderForm, confirmBtn);
    }
  }, 1000);
});

// Модифицируем submitOrder для сброса кнопки
const originalSubmitOrder = window.submitOrder;
if (originalSubmitOrder) {
  window.submitOrder = async function() {
    try {
      await originalSubmitOrder();
    } finally {
      if (typeof resetSubmitButton === 'function') {
        resetSubmitButton();
      }
    }
  };
}