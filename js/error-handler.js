// error-handler.js

class ErrorHandler {
  static show(message, type = 'error', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };
    
    notification.innerHTML = `
      <i class="fas ${icons[type] || icons.info}"></i>
      <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }
  
  static handleApiError(error, fallbackMessage = 'Произошла ошибка') {
    console.error('API Error:', error);
    
    if (!navigator.onLine) {
      this.show('Отсутствует подключение к интернету. Проверьте соединение.', 'warning');
      return;
    }
    
    if (error.response) {
      switch (error.response.status) {
        case 401:
          this.show('Необходимо авторизоваться', 'warning');
          setTimeout(() => window.location.href = '/', 2000);
          break;
        case 403:
          this.show('Недостаточно прав для выполнения операции', 'error');
          break;
        case 404:
          this.show('Запрашиваемый ресурс не найден', 'error');
          break;
        case 500:
          this.show('Ошибка сервера. Попробуйте позже.', 'error');
          break;
        default:
          this.show(fallbackMessage, 'error');
      }
    } else {
      this.show(fallbackMessage, 'error');
    }
  }
  
  static async retry(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
}

// Глобальная обработка ошибок
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});