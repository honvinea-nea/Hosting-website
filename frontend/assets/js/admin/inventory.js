/**
 * Stage 6 — Inventory management
 */
(function () {
  let state = { query: '', stockFilter: 'all' };

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function threshold() {
    return (CEStore.getSettings().lowStockThreshold) || 5;
  }

  function stockMeta(p) {
    const s = Number(p.stock) || 0;
    const t = threshold();
    if (s <= 0) return { key: 'out', text: 'Out of stock', cls: 'bg-red-50 text-red-700' };
    if (s <= t) return { key: 'low', text: 'Low stock', cls: 'bg-amber-50 text-amber-800' };
    return { key: 'in', text: 'In stock', cls: 'bg-emerald-50 text-emerald-800' };
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
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 2000);
  }

  function setStock(id, value) {
    const list = CEStore.getProducts();
    const idx = list.findIndex(p => p.id === id);
    if (idx < 0) return;
    const next = Math.max(0, Math.min(99999, parseInt(value, 10) || 0));
    list[idx].stock = next;
    list[idx].updatedAt = new Date().toISOString();
    CEStore.saveProducts(list);
    if (next === 0 && CEStore.pushNotification) {
      CEStore.pushNotification({ type: 'stock', title: list[idx].name + ' is out of stock', link: 'inventory.html' });
    } else if (next > 0 && next <= threshold() && CEStore.pushNotification) {
      CEStore.pushNotification({ type: 'stock', title: list[idx].name + ' is low on stock (' + next + ')', link: 'inventory.html' });
    }
    toast('Stock updated');
    render();
  }

  function adjust(id, delta) {
    const p = CEStore.getProducts().find(x => x.id === id);
    if (!p) return;
    setStock(id, (Number(p.stock) || 0) + delta);
  }

  function render() {
    const root = document.getElementById('inventory-root');
    if (!root || !window.CEStore) return;

    const t = threshold();
    let list = CEStore.getProducts().slice();
    const q = state.query.trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
      );
    }
    if (state.stockFilter !== 'all') {
      list = list.filter(p => stockMeta(p).key === state.stockFilter);
    }
    list.sort((a, b) => (a.stock || 0) - (b.stock || 0));

    const counts = { all: 0, in: 0, low: 0, out: 0 };
    CEStore.getProducts().forEach(p => {
      counts.all++;
      counts[stockMeta(p).key]++;
    });

    root.innerHTML = `
      <div class="mb-6">
        <h2 class="font-brand text-xl text-ink">Inventory</h2>
        <p class="text-sm text-muted mt-0.5">Monitor stock · low-stock threshold: <strong>${t}</strong> (edit in <a href="settings.html" class="underline">Settings</a>)</p>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-6">
        ${[
          ['all', 'All products'],
          ['in', 'In stock'],
          ['low', 'Low stock'],
          ['out', 'Out of stock']
        ].map(([k, label]) => `
          <button type="button" class="inv-filter rounded-xl border px-3 py-2.5 text-left
            ${state.stockFilter === k ? 'border-ink bg-ink text-white' : 'border-[#ece8df] bg-white hover:bg-cream'}" data-f="${k}">
            <span class="block text-xs opacity-80">${label}</span>
            <span class="block text-lg font-semibold">${counts[k]}</span>
          </button>`).join('')}
      </div>

      <div class="rounded-2xl border border-[#ece8df] bg-white overflow-hidden">
        <div class="p-4 border-b border-[#ece8df]">
          <input type="search" id="inv-q" value="${escapeHtml(state.query)}" placeholder="Search product, SKU, category…"
            class="w-full max-w-md rounded-xl border border-[#ece8df] bg-page px-3 py-2 text-sm focus:outline-none focus:border-ink" />
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-muted border-b border-[#ece8df]">
                <th class="px-4 py-3 font-semibold">Product</th>
                <th class="px-3 py-3 font-semibold hidden md:table-cell">SKU</th>
                <th class="px-3 py-3 font-semibold hidden sm:table-cell">Category</th>
                <th class="px-3 py-3 font-semibold">Stock</th>
                <th class="px-3 py-3 font-semibold">Status</th>
                <th class="px-4 py-3 font-semibold">Adjust</th>
              </tr>
            </thead>
            <tbody>
              ${list.length === 0
                ? `<tr><td colspan="6" class="px-4 py-12 text-center text-muted">No products match.</td></tr>`
                : list.map(p => {
                    const m = stockMeta(p);
                    const img = p.image ? (p.image.startsWith('http') ? p.image : '../' + p.image) : '';
                    return `<tr class="border-b border-[#f3efe6] hover:bg-page/80">
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                          <div class="h-10 w-10 rounded-lg bg-cream overflow-hidden shrink-0">
                            ${img ? `<img src="${escapeHtml(img)}" class="h-full w-full object-cover" onerror="this.style.display='none'" alt="">` : ''}
                          </div>
                          <span class="font-medium text-ink truncate max-w-[180px]">${escapeHtml(p.name)}</span>
                        </div>
                      </td>
                      <td class="px-3 py-3 text-muted hidden md:table-cell">${escapeHtml(p.sku || '—')}</td>
                      <td class="px-3 py-3 text-muted hidden sm:table-cell capitalize">${escapeHtml((p.category || '').replace(/-/g, ' '))}</td>
                      <td class="px-3 py-3">
                        <input type="number" min="0" class="stock-input w-20 rounded-lg border border-[#ece8df] bg-page px-2 py-1 text-sm" data-id="${p.id}" value="${p.stock ?? 0}" />
                      </td>
                      <td class="px-3 py-3"><span class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${m.cls}">${m.text}</span></td>
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-1">
                          <button type="button" class="adj rounded-lg border border-[#ece8df] w-8 h-8 hover:bg-cream" data-id="${p.id}" data-d="-1">−</button>
                          <button type="button" class="adj rounded-lg border border-[#ece8df] w-8 h-8 hover:bg-cream" data-id="${p.id}" data-d="1">+</button>
                          <button type="button" class="set-btn text-xs font-medium text-ink hover:underline ml-2" data-id="${p.id}">Set</button>
                        </div>
                      </td>
                    </tr>`;
                  }).join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('inv-q').oninput = (e) => { state.query = e.target.value; render(); };
    root.querySelectorAll('.inv-filter').forEach(btn => {
      btn.onclick = () => { state.stockFilter = btn.dataset.f; render(); };
    });
    root.querySelectorAll('.adj').forEach(btn => {
      btn.onclick = () => adjust(parseInt(btn.dataset.id, 10), parseInt(btn.dataset.d, 10));
    });
    root.querySelectorAll('.set-btn').forEach(btn => {
      btn.onclick = () => {
        const input = root.querySelector(`.stock-input[data-id="${btn.dataset.id}"]`);
        if (input) setStock(parseInt(btn.dataset.id, 10), input.value);
      };
    });
    root.querySelectorAll('.stock-input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') setStock(parseInt(input.dataset.id, 10), input.value);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', render);
})();
