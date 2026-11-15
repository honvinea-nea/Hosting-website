/**
 * Promotions — simple promo codes stored in localStorage
 */
(function () {
  let state = { editing: null };

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

  function uid() {
    return 'promo-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function render() {
    const root = document.getElementById('promotions-root');
    if (!root || !window.CEStore) return;

    const list = CEStore.getPromotions();
    const activeCount = list.filter(p => p.active).length;

    root.innerHTML = `
      <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 class="font-brand text-xl text-ink">Promotions</h2>
          <p class="text-sm text-muted mt-0.5">${list.length} codes · ${activeCount} active (demo — not applied at checkout yet)</p>
        </div>
        <button type="button" id="promo-add" class="rounded-xl bg-ink text-white text-sm font-medium px-4 py-2.5 hover:opacity-90">Add promo code</button>
      </div>

      ${state.editing === 'new' || (state.editing && list.find(p => p.id === state.editing)) ? renderForm(list) : ''}

      <div class="rounded-2xl border border-[#ece8df] bg-white overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-page text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th class="px-4 py-3 font-medium">Code</th>
              <th class="px-4 py-3 font-medium">Type</th>
              <th class="px-4 py-3 font-medium">Value</th>
              <th class="px-4 py-3 font-medium hidden sm:table-cell">Note</th>
              <th class="px-4 py-3 font-medium">Status</th>
              <th class="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#ece8df]">
            ${list.length === 0 ? `
              <tr><td colspan="6" class="px-4 py-10 text-center text-muted">No promotions yet</td></tr>
            ` : list.map(p => `
              <tr class="hover:bg-page/60">
                <td class="px-4 py-3 font-mono font-semibold text-ink">${escapeHtml(p.code)}</td>
                <td class="px-4 py-3 capitalize">${escapeHtml(p.type)}</td>
                <td class="px-4 py-3">${p.type === 'percent' ? p.value + '%' : CEStore.money(p.value)}</td>
                <td class="px-4 py-3 hidden sm:table-cell text-muted">${escapeHtml(p.note || '—')}</td>
                <td class="px-4 py-3">
                  <button type="button" class="promo-toggle text-xs font-medium rounded-full px-2.5 py-1 ${p.active ? 'bg-green-50 text-success' : 'bg-page text-muted'}" data-id="${escapeHtml(p.id)}">
                    ${p.active ? 'Active' : 'Off'}
                  </button>
                </td>
                <td class="px-4 py-3 text-right space-x-2">
                  <button type="button" class="promo-edit text-xs font-medium text-ink underline" data-id="${escapeHtml(p.id)}">Edit</button>
                  <button type="button" class="promo-del text-xs font-medium text-danger underline" data-id="${escapeHtml(p.id)}">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const addBtn = document.getElementById('promo-add');
    if (addBtn) addBtn.addEventListener('click', () => { state.editing = 'new'; render(); });

    root.querySelectorAll('.promo-edit').forEach(btn => {
      btn.addEventListener('click', () => { state.editing = btn.dataset.id; render(); });
    });

    root.querySelectorAll('.promo-del').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Delete this promo code?')) return;
        const next = CEStore.getPromotions().filter(p => p.id !== btn.dataset.id);
        CEStore.savePromotions(next);
        state.editing = null;
        toast('Promo deleted');
        render();
      });
    });

    root.querySelectorAll('.promo-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const next = CEStore.getPromotions().map(p =>
          p.id === btn.dataset.id ? { ...p, active: !p.active } : p
        );
        CEStore.savePromotions(next);
        toast('Status updated');
        render();
      });
    });

    const form = document.getElementById('promo-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const code = String(fd.get('code') || '').trim().toUpperCase().replace(/\s+/g, '');
        if (!code) { toast('Code required'); return; }
        const type = fd.get('type') === 'fixed' ? 'fixed' : 'percent';
        const value = Math.max(0, parseFloat(fd.get('value')) || 0);
        const note = String(fd.get('note') || '').trim();
        const active = fd.get('active') === 'on';
        let next = CEStore.getPromotions();
        if (state.editing === 'new') {
          next.unshift({ id: uid(), code, type, value, note, active });
          toast('Promo created');
        } else {
          next = next.map(p => p.id === state.editing ? { ...p, code, type, value, note, active } : p);
          toast('Promo updated');
        }
        CEStore.savePromotions(next);
        state.editing = null;
        render();
      });
      const cancel = document.getElementById('promo-cancel');
      if (cancel) cancel.addEventListener('click', () => { state.editing = null; render(); });
    }
  }

  function renderForm(list) {
    const existing = state.editing === 'new' ? null : list.find(p => p.id === state.editing);
    const p = existing || { code: '', type: 'percent', value: 10, note: '', active: true };
    return `
      <div class="mb-6 rounded-2xl border border-[#ece8df] bg-white p-5">
        <h3 class="text-sm font-semibold text-ink mb-4">${existing ? 'Edit promo' : 'New promo code'}</h3>
        <form id="promo-form" class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-muted mb-1">Code</label>
            <input name="code" required value="${escapeHtml(p.code)}" placeholder="SUMMER20" class="w-full rounded-xl border border-[#ece8df] bg-page px-3 py-2 text-sm uppercase focus:outline-none focus:border-ink" />
          </div>
          <div>
            <label class="block text-xs font-medium text-muted mb-1">Type</label>
            <select name="type" class="w-full rounded-xl border border-[#ece8df] bg-page px-3 py-2 text-sm focus:outline-none focus:border-ink">
              <option value="percent" ${p.type === 'percent' ? 'selected' : ''}>Percent off</option>
              <option value="fixed" ${p.type === 'fixed' ? 'selected' : ''}>Fixed amount off</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-muted mb-1">Value</label>
            <input name="value" type="number" min="0" step="0.01" value="${p.value}" class="w-full rounded-xl border border-[#ece8df] bg-page px-3 py-2 text-sm focus:outline-none focus:border-ink" />
          </div>
          <div>
            <label class="block text-xs font-medium text-muted mb-1">Note</label>
            <input name="note" value="${escapeHtml(p.note || '')}" class="w-full rounded-xl border border-[#ece8df] bg-page px-3 py-2 text-sm focus:outline-none focus:border-ink" />
          </div>
          <div class="sm:col-span-2 flex items-center gap-3">
            <label class="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" ${p.active ? 'checked' : ''} class="rounded border-[#ece8df]" />
              Active
            </label>
            <div class="flex-1"></div>
            <button type="button" id="promo-cancel" class="rounded-xl border border-[#ece8df] px-4 py-2 text-sm">Cancel</button>
            <button type="submit" class="rounded-xl bg-ink text-white text-sm font-medium px-4 py-2">Save</button>
          </div>
        </form>
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', render);
})();
