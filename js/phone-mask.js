// phone-mask.js
document.addEventListener("DOMContentLoaded", () => {
  initPhoneMasks();
});

function initPhoneMasks() {
  const phoneInputs = document.querySelectorAll('input[type="tel"]');
  
  phoneInputs.forEach(input => {
    // Устанавливаем начальное значение
    if (!input.value) {
      input.value = '+7 (';
    }
    
    input.addEventListener('input', function(e) {
      let value = this.value.replace(/\D/g, '');
      
      if (!value.startsWith('7') && !value.startsWith('8')) {
        value = '7' + value;
      }
      
      if (value.startsWith('8')) {
        value = '7' + value.slice(1);
      }
      
      let formatted = '+7 (';
      
      if (value.length > 1) formatted += value.slice(1, 4);
      if (value.length >= 4) formatted += ') ' + value.slice(4, 7);
      if (value.length >= 7) formatted += '-' + value.slice(7, 9);
      if (value.length >= 9) formatted += '-' + value.slice(9, 11);
      
      this.value = formatted;
    });
    
    input.addEventListener('focus', function() {
      if (this.value === '+7 (') {
        this.setSelectionRange(4, 4);
      }
    });
    
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Backspace' && this.value === '+7 (') {
        e.preventDefault();
      }
    });
  });
}