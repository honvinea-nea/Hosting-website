// Cart persistence and server-backed checkout for Bloom & Blossom / Shoply
(function () {
  const KEY = 'ce_cart';

  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(v)) return [];
      // Self-healing migration for cart items:
      // Ensure image paths are up-to-date with official catalog
      if (typeof products !== 'undefined' && Array.isArray(products)) {
        let changed = false;
        v.forEach(item => {
          const match = products.find(p => String(p.id) === String(item.id) || p.name === item.name);
          if (match && match.image && item.image !== match.image) {
            item.image = match.image;
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem(KEY, JSON.stringify(v));
        }
      }
      return v;
    } catch (_) {
      return [];
    }
  }

  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    updateBadge();
  }

  function getCart() {
    return read();
  }

  function updateBadge() {
    const count = read().reduce((n, i) => n + (Number(i.qty) || 0), 0);
    document.querySelectorAll('.cart-badge').forEach(el => {
      el.textContent = String(count);
      el.style.display = count > 0 ? 'inline-flex' : 'none';
      el.classList.add('pop');
      setTimeout(() => el.classList.remove('pop'), 280);
    });
  }

  function updateQty(index, qty) {
    const items = read();
    if (!items[index]) return;
    if (qty <= 0) items.splice(index, 1);
    else items[index].qty = Math.min(99, qty);
    write(items);
    if (typeof renderCartPage === 'function') renderCartPage();
  }

  function removeFromCart(index) {
    const items = read();
    if (!items[index]) return;
    const removedName = items[index].name;
    items.splice(index, 1);
    write(items);
    if (typeof showToast === 'function') {
      showToast(`Removed ${removedName} from bag`);
    }
    if (typeof renderCartPage === 'function') renderCartPage();
  }

  async function placeOrder(details) {
    const cart = read();
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          customerName: details.name || details.customerName,
          email: details.email,
          phone: details.phone,
          address: [details.address, details.city, details.zip].filter(Boolean).join(', '),
          deliveryDate: details.date,
          deliveryTime: details.time,
          recipient: details.recipient,
          message: details.message,
          paymentMethod: details.paymentMethod,
          paymentReference: details.paymentReference,
          items: cart.map(i => ({ id: i.id, qty: i.qty }))
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || 'Could not place order. Please try again.');
      write([]);
      return payload.order;
    } catch (error) {
      if (typeof showToast === 'function') {
        showToast(error.message || 'Unable to connect to order service.');
      } else {
        alert(error.message || 'Unable to connect to the order service.');
      }
      return null;
    }
  }

  window.getCart = getCart;
  window.updateQty = updateQty;
  window.removeFromCart = removeFromCart;
  window.placeOrder = placeOrder;
  window.updateBadge = updateBadge;

  window.addToCart = function (productOrId, qty = 1, note = '') {
    const product = (typeof productOrId === 'object' && productOrId)
      ? productOrId
      : (typeof products !== 'undefined' && Array.isArray(products)
          ? products.find(p => String(p.id) === String(productOrId))
          : null);
    if (!product) {
      if (typeof showToast === 'function') showToast('This arrangement is unavailable.');
      else alert('This product is unavailable.');
      return false;
    }
    const items = read();
    const existing = items.find(i => String(i.id) === String(product.id));
    if (existing) {
      existing.qty = Math.min(99, existing.qty + qty);
      if (note) existing.note = String(note);
    } else {
      items.push({
        id: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        image: product.image || '',
        qty,
        note: String(note || '')
      });
    }
    write(items);
    if (typeof showToast === 'function') {
      showToast(`Added ${qty} × ${product.name} to bag`);
    }
    return true;
  };

  document.addEventListener('DOMContentLoaded', updateBadge);
})();
