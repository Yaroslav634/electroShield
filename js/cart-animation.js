// cart-animation.js

function animateAddToCart(componentId, event) {
  const component = allComponents.find(c => c.id === componentId);
  if (!component || selectedComponents.some(c => c.id === componentId)) {
    // Если уже в корзине, просто показываем уведомление
    showNotification("Компонент уже в корзине", "info");
    return;
  }

  // 1. Добавляем в корзину
  selectedComponents.push({ ...component, quantity: 1 });
  updateCart();
  updateTotal();
  loadComponents();

  // 2. Запускаем анимацию перелёта
  if (event) {
    flyToCart(event);
  }

  // 3. Конфетти
  if (event) {
    spawnConfetti(event.clientX, event.clientY);
  }

  // 4. Всплывающая подсказка
  if (event) {
    showAddedTooltip(event.clientX, event.clientY, component.name);
  }

  // 5. Трясём корзину
  shakeCart();

  // 6. Обновляем счётчик
  updateCartBadge();

  // 7. Уведомление
  showNotification(`"${component.name}" добавлен в корзину`, "success");

  // 8. Проверяем совместимость
  if (typeof showCompatibilityWarnings === 'function') {
    showCompatibilityWarnings();
  }
}

function flyToCart(event) {
  const cartIcon = document.querySelector('#selectedComponents') 
    || document.querySelector('.configurator-panel:last-child')
    || document.querySelector('.total-section');

  if (!cartIcon) return;

  const cartRect = cartIcon.getBoundingClientRect();
  const targetX = cartRect.left + cartRect.width / 2;
  const targetY = cartRect.top + cartRect.height / 2;

  const flyElement = document.createElement('div');
  flyElement.className = 'fly-to-cart';
  flyElement.innerHTML = '<i class="fas fa-box"></i>';
  flyElement.style.cssText = `
    left: ${event.clientX - 15}px;
    top: ${event.clientY - 15}px;
    position: fixed;
    z-index: 3000;
    pointer-events: none;
    font-size: 1.8rem;
    color: var(--primary-color);
  `;

  document.body.appendChild(flyElement);

  // Запускаем анимацию через requestAnimationFrame для плавности
  requestAnimationFrame(() => {
    flyElement.style.transition = 'all 0.7s cubic-bezier(0.2, 0.8, 0.3, 1)';
    flyElement.style.left = targetX + 'px';
    flyElement.style.top = targetY + 'px';
    flyElement.style.transform = 'scale(0.3)';
    flyElement.style.opacity = '0';
  });

  // Удаляем элемент после анимации
  setTimeout(() => {
    flyElement.remove();
  }, 700);
}

function spawnConfetti(x, y) {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const particleCount = 8;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'confetti-particle';
    
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 8 + 4;
    const angle = Math.random() * 360;
    const distance = Math.random() * 60 + 20;
    const rad = angle * Math.PI / 180;
    const tx = Math.cos(rad) * distance;
    const ty = Math.sin(rad) * distance;

    particle.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      z-index: 3001;
      pointer-events: none;
    `;

    document.body.appendChild(particle);

    requestAnimationFrame(() => {
      particle.style.transition = 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      particle.style.transform = `translate(${tx}px, ${ty + 60}px) rotate(${Math.random() * 720}deg)`;
      particle.style.opacity = '0';
    });

    setTimeout(() => particle.remove(), 800);
  }
}

function showAddedTooltip(x, y, componentName) {
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip-added';
  tooltip.textContent = `✓ ${componentName.substring(0, 25)} добавлен`;
  tooltip.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y - 40}px;
    z-index: 3000;
    pointer-events: none;
    transform: translateX(-50%);
  `;

  document.body.appendChild(tooltip);

  setTimeout(() => tooltip.remove(), 1500);
}

function shakeCart() {
  const cartPanel = document.querySelector('.configurator-panel:last-child');
  if (!cartPanel) return;

  cartPanel.classList.add('cart-shake');
  setTimeout(() => cartPanel.classList.remove('cart-shake'), 500);
}

// cart-animation.js

function updateCartBadge() {
  let badge = document.querySelector('.cart-badge');
  const cartTitle = document.querySelector('.configurator-panel:last-child h3');

  if (!badge && cartTitle) {
    badge = document.createElement('span');
    badge.className = 'cart-badge';
    cartTitle.appendChild(badge);
  }

  if (badge && typeof selectedComponents !== 'undefined') {
    const count = selectedComponents.length;
    badge.textContent = count;
    if (count === 0) {
      badge.classList.add('hidden');
    } else {
      badge.classList.remove('hidden');
      badge.classList.add('pulse');
      setTimeout(() => badge.classList.remove('pulse'), 600);
    }
  }
}

function shakeCart() {
  const cartPanel = document.querySelector('.configurator-panel:last-child');
  if (!cartPanel) return;
  cartPanel.classList.add('cart-shake');
  setTimeout(() => cartPanel.classList.remove('cart-shake'), 500);
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(updateCartBadge, 1500);
});

window.updateCartBadge = updateCartBadge;
window.shakeCart = shakeCart;