/**
 * Categories — derived from products, with rename / merge support
 */
(function () {
  let state = { query: '', editing: null };

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function toast(msg) {
    let el = document.getElementById('ce-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ce-toast';
      el.className = 'fixed bottom-6 right-6 z-50 rounded-xl bg-ink text-white text-sm px-4 py-2.5 shadow-lg transition-opacity';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 2200);
  }

  function buildCategories(products) {
    const map = {};
    products.forEach(p => {
      const cat = (p.category || 'uncategorized').trim().toLowerCase() || 'uncategorized';
      if (!map[cat]) map[cat] = { key: cat, name: p.category || 'Uncategorized', count: 0, active: 0, stock: 0 };
      map[cat].count++;
      if (p.status === 'active' || !p.status) map[cat].active++;
      map[cat].stock += Number(p.stock) || 0;
      // keep nicest display name (first non-empty casing)
      if (p.category && map[cat].name === 'Uncategorized') map[cat].name = p.category;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }

  function renameCategory(oldKey, newName) {
    const next = (newName || '').trim();
    if (!next) return false;
    const list = CEStore.getProducts();
    let n = 0;
    list.forEach(p => {
      const k = (p.category || 'uncategorized').trim().toLowerCase() || 'uncategorized';
      if (k === oldKey) {
        p.category = next;
        p.updatedAt = new Date().toISOString();
        n++;
      }
    });
    if (n) CEStore.saveProducts(list);
    return n;
  }

  function render() {
    const root = document.getElementById('categories-root');
    if (!root || !window.CEStore) return;

    const products = CEStore.getProducts();
    let cats = buildCategories(products);
    const total = cats.length;
    const q = state.query.trim().toLowerCase();
    if (q) cats = cats.filter(c => c.name.toLowerCase().includes(q) || c.key.includes(q));

    root.innerHTML = `
      <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 class="font-brand text-xl text-ink">Categories</h2>
          <p class="text-sm text-muted mt-0.5">${total} categories · derived from product catalog</p>
        </div>
        <input id="cat-search" type="search" placeholder="Search categories…" value="${escapeHtml(state.query)}"
          class="w-full sm:w-56 rounded-xl border border-[#ece8df] bg-white px-3 py-2 text-sm focus:outline-none focus:border-ink" />
      </div>

      <div class="rounded-2xl border border-[#ece8df] bg-white overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-page text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th class="px-4 py-3 font-medium">Category</th>
              <th class="px-4 py-3 font-medium">Products</th>
              <th class="px-4 py-3 font-medium hidden sm:table-cell">Active</th>
              <th class="px-4 py-3 font-medium hidden md:table-cell">Total stock</th>
              <th class="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#ece8df]">
            ${cats.length === 0 ? `
              <tr><td colspan="5" class="px-4 py-10 text-center text-muted">No categories found</td></tr>
            ` : cats.map(c => `
              <tr class="hover:bg-page/60">
                <td class="px-4 py-3">
                  ${state.editing === c.key ? `
                    <form class="cat-rename-form flex gap-2 items-center" data-key="${escapeHtml(c.key)}">
                      <input name="name" value="${escapeHtml(c.name)}" class="rounded-lg border border-[#ece8df] bg-white px-2 py-1.5 text-sm w-40 focus:outline-none focus:border-ink" />
                      <button type="submit" class="text-xs font-medium text-ink underline">Save</button>
                      <button type="button" class="cat-cancel text-xs text-muted">Cancel</button>
                    </form>
                  ` : `
                    <span class="font-medium text-ink capitalize">${escapeHtml(c.name)}</span>
                    <span class="block text-[11px] text-muted">${escapeHtml(c.key)}</span>
                  `}
                </td>
                <td class="px-4 py-3">${c.count}</td>
                <td class="px-4 py-3 hidden sm:table-cell">${c.active}</td>
                <td class="px-4 py-3 hidden md:table-cell">${c.stock}</td>
                <td class="px-4 py-3 text-right">
                  <button type="button" class="cat-edit text-xs font-medium text-ink underline" data-key="${escapeHtml(c.key)}">Rename</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <p class="mt-4 text-xs text-muted">Renaming updates every product in that category. Categories appear automatically when products use them.</p>
    `;

    const search = document.getElementById('cat-search');
    if (search) {
      search.addEventListener('input', () => {
        state.query = search.value;
        render();
        const s2 = document.getElementById('cat-search');
        if (s2) { s2.focus(); s2.selectionStart = s2.selectionEnd = s2.value.length; }
      });
    }

    root.querySelectorAll('.cat-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        state.editing = btn.dataset.key;
        render();
      });
    });

    root.querySelectorAll('.cat-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        state.editing = null;
        render();
      });
    });

    root.querySelectorAll('.cat-rename-form').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const key = form.dataset.key;
        const name = new FormData(form).get('name');
        const n = renameCategory(key, name);
        state.editing = null;
        if (n) toast(`Updated ${n} product${n === 1 ? '' : 's'}`);
        else toast('No change');
        render();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', render);
})();
