/**
 * Store Settings — editable via CEStore
 */
(function () {
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

  function render() {
    const root = document.getElementById('settings-root');
    if (!root || !window.CEStore) return;

    const s = CEStore.getSettings();

    root.innerHTML = `
      <div class="mb-6">
        <h2 class="font-brand text-xl text-ink">Store Settings</h2>
        <p class="text-sm text-muted mt-0.5">Brand, delivery rules, and inventory thresholds</p>
      </div>

      <form id="settings-form" class="max-w-2xl space-y-6">
        <div class="rounded-2xl border border-[#ece8df] bg-white p-5 space-y-4">
          <h3 class="text-sm font-semibold text-ink">Brand</h3>
          <div>
            <label class="block text-xs font-medium text-muted mb-1">Store name</label>
            <input name="storeName" value="${escapeHtml(s.storeName)}" class="w-full rounded-xl border border-[#ece8df] bg-page px-3 py-2.5 text-sm focus:outline-none focus:border-ink" />
          </div>
          <div>
            <label class="block text-xs font-medium text-muted mb-1">Slogan</label>
            <input name="slogan" value="${escapeHtml(s.slogan)}" class="w-full rounded-xl border border-[#ece8df] bg-page px-3 py-2.5 text-sm focus:outline-none focus:border-ink" />
          </div>
        </div>

        <div class="rounded-2xl border border-[#ece8df] bg-white p-5 space-y-4">
          <h3 class="text-sm font-semibold text-ink">Inventory &amp; delivery</h3>
          <div class="grid sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-muted mb-1">Low-stock threshold</label>
              <input name="lowStockThreshold" type="number" min="0" max="999" value="${Number(s.lowStockThreshold) || 5}" class="w-full rounded-xl border border-[#ece8df] bg-page px-3 py-2.5 text-sm focus:outline-none focus:border-ink" />
              <p class="text-[11px] text-muted mt-1">Products at or below this count are flagged low</p>
            </div>
            <div>
              <label class="block text-xs font-medium text-muted mb-1">Delivery fee ($)</label>
              <input name="deliveryFee" type="number" min="0" step="0.01" value="${Number(s.deliveryFee) || 0}" class="w-full rounded-xl border border-[#ece8df] bg-page px-3 py-2.5 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label class="block text-xs font-medium text-muted mb-1">Free delivery over ($)</label>
              <input name="freeDeliveryThreshold" type="number" min="0" step="0.01" value="${Number(s.freeDeliveryThreshold) || 100}" class="w-full rounded-xl border border-[#ece8df] bg-page px-3 py-2.5 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label class="block text-xs font-medium text-muted mb-1">Tax rate (%)</label>
              <input name="taxRate" type="number" min="0" max="100" step="0.1" value="${Number(s.taxRate) || 0}" class="w-full rounded-xl border border-[#ece8df] bg-page px-3 py-2.5 text-sm focus:outline-none focus:border-ink" />
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button type="submit" class="rounded-xl bg-ink text-white text-sm font-medium px-5 py-2.5 hover:opacity-90">Save settings</button>
          <button type="button" id="reset-settings" class="rounded-xl border border-[#ece8df] bg-white text-sm px-4 py-2.5 hover:bg-page">Reset defaults</button>
        </div>
      </form>
    `;

    document.getElementById('settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const next = {
        ...s,
        storeName: String(fd.get('storeName') || '').trim() || CEStore.getDefaultSettings().storeName,
        slogan: String(fd.get('slogan') || '').trim(),
        lowStockThreshold: Math.max(0, parseInt(fd.get('lowStockThreshold'), 10) || 5),
        deliveryFee: Math.max(0, parseFloat(fd.get('deliveryFee')) || 0),
        freeDeliveryThreshold: Math.max(0, parseFloat(fd.get('freeDeliveryThreshold')) || 0),
        taxRate: Math.max(0, Math.min(100, parseFloat(fd.get('taxRate')) || 0)),
        currency: s.currency || 'USD'
      };
      CEStore.saveSettings(next);
      toast('Settings saved');
      render();
    });

    document.getElementById('reset-settings').addEventListener('click', () => {
      CEStore.saveSettings(CEStore.getDefaultSettings());
      toast('Defaults restored');
      render();
    });
  }

  document.addEventListener('DOMContentLoaded', render);
})();
