const catLabel = c => (typeof c === 'string' ? c.replace(/-/g, ' ') : '');
window.catLabel = catLabel;

// Elegant floral SVG fallback data URI so no broken-image icon ever appears
const FLOWER_FALLBACK_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400' fill='none'%3E%3Crect width='400' height='400' fill='%23f6f5f2'/%3E%3Ccircle cx='200' cy='180' r='64' fill='%23e6ded4'/%3E%3Cpath d='M200 130 C215 155 240 170 265 180 C240 190 215 205 200 230 C185 205 160 190 135 180 C160 170 185 155 200 130 Z' fill='%23b89b72'/%3E%3Ccircle cx='200' cy='180' r='18' fill='%235c4d3c'/%3E%3Ctext x='200' y='280' font-family='sans-serif' font-size='13' fill='%2371634f' font-weight='600' letter-spacing='1.5' text-anchor='middle'%3EBLOOM %26 BLOSSOM%3C/text%3E%3C/svg%3E";

document.addEventListener('error', e => {
  if (e.target && e.target.tagName === 'IMG') {
    if (e.target.dataset.fallbackApplied) {
      e.target.classList.add('img-fallback');
      return;
    }
    e.target.dataset.fallbackApplied = 'true';
    e.target.src = FLOWER_FALLBACK_SVG;
  }
}, true);

function renderFeaturedProducts() {
  const featuredContainer = document.getElementById('featured-products');
  if (featuredContainer && typeof products !== 'undefined') {
    const featured = products.filter(p => p.price > 0).slice(0, 8);
    featuredContainer.innerHTML = featured.map(p => `
      <div class="product-card">
        <a href="product.html?id=${p.id}">
          <img src="${p.image}" alt="${p.name}" loading="lazy">
        </a>
        <div class="info">
          <span class="card-cat">${catLabel(p.category)}</span>
          <a href="product.html?id=${p.id}"><h3>${p.name}</h3></a>
          <div class="price">$${p.price.toFixed(2)}</div>
          <div class="card-actions">
            <button class="btn btn-ghost btn-sm add-btn" data-id="${p.id}">Add to cart</button>
          </div>
        </div>
      </div>
    `).join('');
    featuredContainer.querySelectorAll('.add-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        if (typeof addToCart === 'function') addToCart(parseInt(btn.dataset.id, 10), 1);
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Featured products on home
  renderFeaturedProducts();

  // Mobile menu toggle
  const menuToggle = document.getElementById('menu-toggle');
  const navLinks = document.getElementById('nav-links');
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
    });
    // Close menu when a link is clicked
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }

  // Header scroll detection for elevated glassmorphism
  const header = document.querySelector('.header');
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 15) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
});

// Global modern toast notification
window.showToast = function (message, duration = 2600) {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span style="display:inline-block; font-size:1.15rem;">🌸</span> <span>${message}</span>`;
  toast.classList.add('show');
  if (window._toastTimeout) clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
};

window.addEventListener('catalog:updated', renderFeaturedProducts);
