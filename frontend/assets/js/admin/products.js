/**
 * Stage 4 — Product management
 * List, search, filter, sort, add, edit, delete via CEStore
 */
(function () {
  const LOW = () => (CEStore.getSettings().lowStockThreshold || 5);

  let state = {
    query: '',
    category: 'all',
    availability: 'all',
    sort: 'newest',
    page: 1,
    perPage: 10,
    editingId: null
  };

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function categoriesFrom(products) {
    const set = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(set).sort();
  }

  function stockLabel(p) {
    const s = Number(p.stock) || 0;
    if (s <= 0) return { text: 'Out of stock', cls: 'bg-red-50 text-red-700' };
    if (s <= LOW()) return { text: 'Low stock', cls: 'bg-amber-50 text-amber-800' };
    return { text: 'In stock', cls: 'bg-emerald-50 text-emerald-800' };
  }

  function statusLabel(p) {
    const s = (p.status || 'active').toLowerCase();
    if (s === 'draft') return { text: 'Draft', cls: 'bg-slate-100 text-slate-700' };
    if (s === 'archived') return { text: 'Archived', cls: 'bg-slate-100 text-slate-500' };
    return { text: 'Active', cls: 'bg-emerald-50 text-emerald-800' };
  }

  function filterSort(products) {
    let list = products.slice();
    const q = state.query.trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
      );
    }
    if (state.category !== 'all') {
      list = list.filter(p => p.category === state.category);
    }
    if (state.availability === 'in') list = list.filter(p => (p.stock || 0) > LOW());
    if (state.availability === 'low') list = list.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= LOW());
    if (state.availability === 'out') list = list.filter(p => (p.stock || 0) <= 0);

    if (state.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (state.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    else if (state.sort === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else list.sort((a, b) => (b.id || 0) - (a.id || 0)); // newest = higher id

    return list;
  }

  function overview(products) {
    return {
      total: products.length,
      active: products.filter(p => (p.status || 'active') === 'active').length,
      draft: products.filter(p => p.status === 'draft').length,
      out: products.filter(p => (p.stock || 0) <= 0).length
    };
  }

  function nextId(products) {
    return products.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1;
  }

  function openModal(product) {
    state.editingId = product ? product.id : null;
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('modal-title');
    title.textContent = product ? 'Edit product' : 'Add product';
    document.getElementById('f-name').value = product ? product.name : '';
    document.getElementById('f-desc').value = product ? (product.desc || '') : '';
    document.getElementById('f-image').value = product ? (product.image || '') : '';
    document.getElementById('f-sku').value = product ? (product.sku || '') : '';
    document.getElementById('f-category').value = product ? (product.category || '') : '';
    document.getElementById('f-price').value = product ? product.price : '';
    document.getElementById('f-discount').value = product && product.discountPrice != null ? product.discountPrice : '';
    document.getElementById('f-stock').value = product ? (product.stock ?? 0) : 10;
    document.getElementById('f-status').value = product ? (product.status || 'active') : 'active';
    document.getElementById('f-featured').checked = product ? !!product.featured : false;
    document.getElementById('f-sizes').value = product && product.sizes ? product.sizes.join(', ') : '';
    document.getElementById('f-colors').value = product && product.colors ? product.colors.join(', ') : '';
    document.getElementById('form-error').classList.add('hidden');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('f-name').focus();
  }

  function closeModal() {
    const modal = document.getElementById('product-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    state.editingId = null;
  }

  function toast(msg) {
    let el = document.getElementById('ce-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ce-toast';
      el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] rounded-xl bg-ink text-white text-sm px-4 py-2.5 shadow-lg opacity-0 transition-opacity';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 2400);
  }

  async function saveFromForm(e) {
    e.preventDefault();
    const err = document.getElementById('form-error');
    const name = document.getElementById('f-name').value.trim();
    const price = parseFloat(document.getElementById('f-price').value);
    const stock = parseInt(document.getElementById('f-stock').value, 10);
    const category = document.getElementById('f-category').value.trim() || 'general';
    if (!name || isNaN(price) || price < 0 || isNaN(stock) || stock < 0) {
      err.textContent = 'Please fill name, valid price, and stock (0 or more).';
      err.classList.remove('hidden');
      return;
    }
    const discountRaw = document.getElementById('f-discount').value;
    const discountPrice = discountRaw === '' ? null : parseFloat(discountRaw);
    const sizes = document.getElementById('f-sizes').value.split(',').map(s => s.trim()).filter(Boolean);
    const colors = document.getElementById('f-colors').value.split(',').map(s => s.trim()).filter(Boolean);

    const list = CEStore.getProducts();
    if (state.editingId != null) {
      const idx = list.findIndex(p => p.id === state.editingId);
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          name,
          desc: document.getElementById('f-desc').value.trim(),
          image: document.getElementById('f-image').value.trim(),
          sku: document.getElementById('f-sku').value.trim() || list[idx].sku,
          category,
          price,
          discountPrice: isNaN(discountPrice) ? null : discountPrice,
          stock,
          status: document.getElementById('f-status').value,
          featured: document.getElementById('f-featured').checked,
          sizes,
          colors,
          updatedAt: new Date().toISOString()
        };
      }
      CEStore.saveProducts(list);
      toast('Product updated');
    } else {
      const id = nextId(list);
      list.push({
        id,
        name,
        desc: document.getElementById('f-desc').value.trim(),
        image: document.getElementById('f-image').value.trim(),
        sku: document.getElementById('f-sku').value.trim() || ('CE-' + String(id).padStart(4, '0')),
        category,
        price,
        discountPrice: isNaN(discountPrice) ? null : discountPrice,
        stock,
        status: document.getElementById('f-status').value,
        featured: document.getElementById('f-featured').checked,
        sizes,
        colors,
        updatedAt: new Date().toISOString()
      });
      CEStore.saveProducts(list);
      toast('Product added');
      // notify
      if (CEStore.pushNotification) {
        CEStore.pushNotification({ type: 'product', title: 'New product added: ' + name, link: 'products.html' });
      }
    }
    // Sync shop catalog window.products if present (same session)
    try {
      if (typeof window.products !== 'undefined') {
        window.products = list.map(p => ({
          id: p.id, name: p.name, category: p.category, price: p.price,
          image: p.image, desc: p.desc || ''
        }));
      }
      localStorage.setItem('ce_products', JSON.stringify(list));
    } catch (_) {}

    // Persist the same product to PostgreSQL through the authenticated admin API.
    const savedProduct = list.find(p => String(p.id) === String(state.editingId)) ||
      list[list.length - 1];
    try {
      const isUpdate = state.editingId != null;
      const response = await fetch(isUpdate ? `/api/admin/products/${encodeURIComponent(savedProduct.id)}` : '/api/admin/products', {
        method: isUpdate ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedProduct)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || 'Could not save product to the database.');
      if (payload.product) {
        const index = list.findIndex(p => String(p.id) === String(savedProduct.id));
        if (index >= 0) list[index] = { ...list[index], ...payload.product };
        CEStore.saveProducts(list);
      }
    } catch (error) {
      err.textContent = error.message;
      err.classList.remove('hidden');
      return;
    }
    closeModal();
    render();
  }

  async function removeProduct(id) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || 'Could not delete product.');
    } catch (error) { toast(error.message); return; }
    const list = CEStore.getProducts().filter(p => String(p.id) !== String(id));
    CEStore.saveProducts(list);
    toast('Product deleted');
    render();
  }

  function render() {
    const root = document.getElementById('products-root');
    if (!root || !window.CEStore) return;

    const all = CEStore.getProducts();
    const filtered = filterSort(all);
    const ov = overview(all);
    const cats = categoriesFrom(all);
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.perPage));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * state.perPage;
    const pageItems = filtered.slice(start, start + state.perPage);

    root.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 class="font-brand text-xl text-ink">Products</h2>
          <p class="text-sm text-muted mt-0.5">Manage catalog, pricing, and stock</p>
        </div>
        <button type="button" id="btn-add" class="inline-flex items-center gap-2 rounded-xl bg-ink text-white px-4 py-2.5 text-sm font-medium hover:bg-navy">
          <i data-lucide="plus" class="w-4 h-4"></i> Add product
        </button>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div class="rounded-2xl border border-[#ece8df] bg-white p-4">
          <p class="text-xs text-muted">Total</p>
          <p class="text-xl font-semibold text-ink mt-1">${ov.total}</p>
        </div>
        <div class="rounded-2xl border border-[#ece8df] bg-white p-4">
          <p class="text-xs text-muted">Active</p>
          <p class="text-xl font-semibold text-ink mt-1">${ov.active}</p>
        </div>
        <div class="rounded-2xl border border-[#ece8df] bg-white p-4">
          <p class="text-xs text-muted">Draft</p>
          <p class="text-xl font-semibold text-ink mt-1">${ov.draft}</p>
        </div>
        <div class="rounded-2xl border border-[#ece8df] bg-white p-4">
          <p class="text-xs text-muted">Out of stock</p>
          <p class="text-xl font-semibold text-ink mt-1">${ov.out}</p>
        </div>
      </div>

      <div class="rounded-2xl border border-[#ece8df] bg-white overflow-hidden">
        <div class="flex flex-col lg:flex-row gap-2 p-4 border-b border-[#ece8df]">
          <input type="search" id="filter-q" value="${escapeHtml(state.query)}" placeholder="Search name, SKU…"
            class="flex-1 rounded-xl border border-[#ece8df] bg-page px-3 py-2 text-sm focus:outline-none focus:border-ink" />
          <select id="filter-cat" class="rounded-xl border border-[#ece8df] bg-page px-3 py-2 text-sm">
            <option value="all">All categories</option>
            ${cats.map(c => `<option value="${escapeHtml(c)}" ${state.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
          </select>
          <select id="filter-avail" class="rounded-xl border border-[#ece8df] bg-page px-3 py-2 text-sm">
            <option value="all" ${state.availability === 'all' ? 'selected' : ''}>All availability</option>
            <option value="in" ${state.availability === 'in' ? 'selected' : ''}>In stock</option>
            <option value="low" ${state.availability === 'low' ? 'selected' : ''}>Low stock</option>
            <option value="out" ${state.availability === 'out' ? 'selected' : ''}>Out of stock</option>
          </select>
          <select id="filter-sort" class="rounded-xl border border-[#ece8df] bg-page px-3 py-2 text-sm">
            <option value="newest" ${state.sort === 'newest' ? 'selected' : ''}>Newest</option>
            <option value="name" ${state.sort === 'name' ? 'selected' : ''}>Name</option>
            <option value="price-asc" ${state.sort === 'price-asc' ? 'selected' : ''}>Price ↑</option>
            <option value="price-desc" ${state.sort === 'price-desc' ? 'selected' : ''}>Price ↓</option>
          </select>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-muted border-b border-[#ece8df]">
                <th class="px-4 py-3 font-semibold">Product</th>
                <th class="px-3 py-3 font-semibold hidden md:table-cell">SKU</th>
                <th class="px-3 py-3 font-semibold hidden sm:table-cell">Category</th>
                <th class="px-3 py-3 font-semibold">Price</th>
                <th class="px-3 py-3 font-semibold">Stock</th>
                <th class="px-3 py-3 font-semibold hidden lg:table-cell">Status</th>
                <th class="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${pageItems.length === 0
                ? `<tr><td colspan="7" class="px-4 py-12 text-center text-muted">No products match your filters.</td></tr>`
                : pageItems.map(p => {
                    const st = stockLabel(p);
                    const stt = statusLabel(p);
                    const img = p.image ? (p.image.startsWith('http') ? p.image : '../' + p.image) : '';
                    return `<tr class="border-b border-[#f3efe6] hover:bg-page/80">
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-3 min-w-0">
                          <div class="h-11 w-11 rounded-xl bg-cream overflow-hidden shrink-0">
                            ${img ? `<img src="${escapeHtml(img)}" alt="" class="h-full w-full object-cover" onerror="this.style.display='none'">` : ''}
                          </div>
                          <div class="min-w-0">
                            <p class="font-medium text-ink truncate">${escapeHtml(p.name)}</p>
                            <p class="text-xs text-muted md:hidden">${escapeHtml(p.sku || '')}</p>
                          </div>
                        </div>
                      </td>
                      <td class="px-3 py-3 text-muted hidden md:table-cell whitespace-nowrap">${escapeHtml(p.sku || '—')}</td>
                      <td class="px-3 py-3 text-muted hidden sm:table-cell capitalize">${escapeHtml((p.category || '').replace(/-/g, ' '))}</td>
                      <td class="px-3 py-3 font-medium whitespace-nowrap">${CEStore.money(p.price)}</td>
                      <td class="px-3 py-3">
                        <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}">${p.stock ?? 0} · ${st.text}</span>
                      </td>
                      <td class="px-3 py-3 hidden lg:table-cell">
                        <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${stt.cls}">${stt.text}</span>
                      </td>
                      <td class="px-4 py-3 text-right whitespace-nowrap">
                        <button type="button" class="btn-edit text-xs font-medium text-ink hover:underline mr-3" data-id="${p.id}">Edit</button>
                        <button type="button" class="btn-del text-xs font-medium text-danger hover:underline" data-id="${p.id}">Delete</button>
                      </td>
                    </tr>`;
                  }).join('')
              }
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-between px-4 py-3 border-t border-[#ece8df] text-sm text-muted">
          <span>${filtered.length} product(s)</span>
          <div class="flex gap-2">
            <button type="button" id="page-prev" class="rounded-lg border border-[#ece8df] px-3 py-1.5 hover:bg-cream disabled:opacity-40" ${state.page <= 1 ? 'disabled' : ''}>Prev</button>
            <span class="px-2 py-1.5">Page ${state.page} / ${totalPages}</span>
            <button type="button" id="page-next" class="rounded-lg border border-[#ece8df] px-3 py-1.5 hover:bg-cream disabled:opacity-40" ${state.page >= totalPages ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-add').onclick = () => openModal(null);
    document.getElementById('filter-q').oninput = (e) => { state.query = e.target.value; state.page = 1; render(); };
    document.getElementById('filter-cat').onchange = (e) => { state.category = e.target.value; state.page = 1; render(); };
    document.getElementById('filter-avail').onchange = (e) => { state.availability = e.target.value; state.page = 1; render(); };
    document.getElementById('filter-sort').onchange = (e) => { state.sort = e.target.value; render(); };
    document.getElementById('page-prev').onclick = () => { state.page--; render(); };
    document.getElementById('page-next').onclick = () => { state.page++; render(); };
    root.querySelectorAll('.btn-edit').forEach(btn => {
      btn.onclick = () => {
        const p = CEStore.getProducts().find(x => x.id === parseInt(btn.dataset.id, 10));
        if (p) openModal(p);
      };
    });
    root.querySelectorAll('.btn-del').forEach(btn => {
      btn.onclick = () => removeProduct(parseInt(btn.dataset.id, 10));
    });

    if (window.lucide) lucide.createIcons();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const response = await fetch('/api/admin/products', { credentials: 'same-origin' });
      if (response.ok) {
        const payload = await response.json();
        if (Array.isArray(payload.products)) {
          CEStore.saveProducts(payload.products);
        }
      }
    } catch (_) { /* Keep cached products visible if the API is temporarily unavailable. */ }
    const form = document.getElementById('product-form');
    if (form) form.addEventListener('submit', saveFromForm);
    document.getElementById('modal-close')?.addEventListener('click', closeModal);
    document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
    document.getElementById('product-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'product-modal') closeModal();
    });
    render();
  });
})();
