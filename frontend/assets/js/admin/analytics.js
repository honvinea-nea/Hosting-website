/**
 * Analytics — summary stats + simple bar visuals from orders & products
 */
(function () {
  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function monthKey(iso) {
    if (!iso) return 'unknown';
    const d = new Date(iso);
    if (isNaN(d)) return String(iso).slice(0, 7) || 'unknown';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function render() {
    const root = document.getElementById('analytics-root');
    if (!root || !window.CEStore) return;

    const products = CEStore.getProducts();
    const orders = CEStore.getOrders();
    const active = CEStore.activeOrders(orders);
    const revenue = active.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const aov = active.length ? revenue / active.length : 0;

    const byStatus = {};
    orders.forEach(o => {
      const st = o.status || 'pending';
      byStatus[st] = (byStatus[st] || 0) + 1;
    });

    const byMonth = {};
    active.forEach(o => {
      const k = monthKey(o.createdAt || o.date);
      if (!byMonth[k]) byMonth[k] = { key: k, revenue: 0, orders: 0 };
      byMonth[k].revenue += Number(o.total) || 0;
      byMonth[k].orders += 1;
    });
    const months = Object.values(byMonth).sort((a, b) => a.key.localeCompare(b.key)).slice(-6);
    const maxRev = Math.max(1, ...months.map(m => m.revenue));

    const sold = {};
    active.forEach(o => {
      (o.items || []).forEach(it => {
        const id = it.id;
        if (!sold[id]) sold[id] = { id, name: it.name || 'Item', qty: 0, revenue: 0 };
        sold[id].qty += it.qty || 1;
        sold[id].revenue += (it.price || 0) * (it.qty || 1);
      });
    });
    const top = Object.values(sold).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
    const maxTop = Math.max(1, ...top.map(t => t.revenue));

    const byCat = {};
    products.forEach(p => {
      const c = (p.category || 'other').toLowerCase();
      if (!byCat[c]) byCat[c] = { name: p.category || 'Other', count: 0, stock: 0 };
      byCat[c].count++;
      byCat[c].stock += Number(p.stock) || 0;
    });
    const cats = Object.values(byCat).sort((a, b) => b.count - a.count).slice(0, 8);

    const low = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= (CEStore.getSettings().lowStockThreshold || 5)).length;
    const out = products.filter(p => (p.stock || 0) <= 0).length;

    root.innerHTML = `
      <div class="mb-6">
        <h2 class="font-brand text-xl text-ink">Analytics</h2>
        <p class="text-sm text-muted mt-0.5">Demo insights from local orders &amp; catalog</p>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        ${[
          ['Revenue', CEStore.money(revenue), 'All non-cancelled'],
          ['Orders', String(orders.length), active.length + ' active'],
          ['Avg order', CEStore.money(aov), 'Active only'],
          ['Products', String(products.length), low + ' low · ' + out + ' out']
        ].map(([label, value, sub]) => `
          <div class="rounded-2xl border border-[#ece8df] bg-white p-4">
            <p class="text-xs text-muted uppercase tracking-wider">${label}</p>
            <p class="mt-1 text-xl font-semibold text-ink">${value}</p>
            <p class="text-[11px] text-muted mt-0.5">${sub}</p>
          </div>
        `).join('')}
      </div>

      <div class="grid lg:grid-cols-2 gap-4 mb-4">
        <div class="rounded-2xl border border-[#ece8df] bg-white p-5">
          <h3 class="text-sm font-semibold text-ink mb-4">Revenue by month</h3>
          ${months.length === 0 ? `<p class="text-sm text-muted">No order data yet — place a demo order from the shop.</p>` : `
            <div class="space-y-3">
              ${months.map(m => `
                <div>
                  <div class="flex justify-between text-xs mb-1">
                    <span class="text-muted">${escapeHtml(m.key)}</span>
                    <span class="font-medium text-ink">${CEStore.money(m.revenue)} · ${m.orders} ord</span>
                  </div>
                  <div class="h-2 rounded-full bg-page overflow-hidden">
                    <div class="h-full rounded-full bg-ink" style="width:${Math.round((m.revenue / maxRev) * 100)}%"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="rounded-2xl border border-[#ece8df] bg-white p-5">
          <h3 class="text-sm font-semibold text-ink mb-4">Order status</h3>
          ${Object.keys(byStatus).length === 0 ? `<p class="text-sm text-muted">No orders yet</p>` : `
            <div class="space-y-2">
              ${Object.entries(byStatus).sort((a,b)=>b[1]-a[1]).map(([st, n]) => `
                <div class="flex items-center justify-between text-sm">
                  <span class="capitalize text-ink">${escapeHtml(st)}</span>
                  <span class="font-medium tabular-nums">${n}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>

      <div class="grid lg:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-[#ece8df] bg-white p-5">
          <h3 class="text-sm font-semibold text-ink mb-4">Top products by revenue</h3>
          ${top.length === 0 ? `<p class="text-sm text-muted">No sales data yet</p>` : `
            <div class="space-y-3">
              ${top.map(t => `
                <div>
                  <div class="flex justify-between text-xs mb-1 gap-2">
                    <span class="text-ink truncate">${escapeHtml(t.name)}</span>
                    <span class="font-medium shrink-0">${CEStore.money(t.revenue)} · ${t.qty} sold</span>
                  </div>
                  <div class="h-2 rounded-full bg-page overflow-hidden">
                    <div class="h-full rounded-full bg-taupe" style="width:${Math.round((t.revenue / maxTop) * 100)}%"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="rounded-2xl border border-[#ece8df] bg-white p-5">
          <h3 class="text-sm font-semibold text-ink mb-4">Catalog by category</h3>
          <div class="space-y-2">
            ${cats.map(c => `
              <div class="flex items-center justify-between text-sm">
                <span class="capitalize text-ink">${escapeHtml(c.name)}</span>
                <span class="text-muted">${c.count} products · ${c.stock} units</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', render);
})();
