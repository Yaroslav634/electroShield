// virtual-scroll.js

class VirtualScroll {
  constructor(container, items, itemHeight, renderFn, buffer = 5) {
    this.container = container;
    this.items = items;
    this.itemHeight = itemHeight;
    this.renderFn = renderFn;
    this.buffer = buffer;
    this.visibleCount = 0;
    this.scrollTop = 0;
    
    this.init();
  }
  
  init() {
    this.container.style.position = 'relative';
    this.container.style.overflow = 'auto';
    
    // Создаём обёртку для высоты
    this.wrapper = document.createElement('div');
    this.wrapper.style.height = (this.items.length * this.itemHeight) + 'px';
    this.wrapper.style.position = 'relative';
    this.container.appendChild(this.wrapper);
    
    // Создаём контейнер для видимых элементов
    this.viewport = document.createElement('div');
    this.viewport.style.position = 'absolute';
    this.viewport.style.top = '0';
    this.viewport.style.left = '0';
    this.viewport.style.width = '100%';
    this.container.appendChild(this.viewport);
    
    this.visibleCount = Math.ceil(this.container.clientHeight / this.itemHeight) + this.buffer;
    
    this.container.addEventListener('scroll', () => this.render());
    this.render();
  }
  
  render() {
    this.scrollTop = this.container.scrollTop;
    
    const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.buffer);
    const endIndex = Math.min(
      this.items.length,
      startIndex + this.visibleCount + this.buffer * 2
    );
    
    this.viewport.style.top = (startIndex * this.itemHeight) + 'px';
    
    let html = '';
    for (let i = startIndex; i < endIndex; i++) {
      html += this.renderFn(this.items[i], i);
    }
    this.viewport.innerHTML = html;
  }
  
  updateItems(newItems) {
    this.items = newItems;
    this.wrapper.style.height = (this.items.length * this.itemHeight) + 'px';
    this.render();
  }
  
  destroy() {
    this.container.removeEventListener('scroll', this.render);
    this.container.innerHTML = '';
  }
}