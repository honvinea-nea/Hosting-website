/**
 * Stage 6 — Customer management (derived from orders)
 */
(function () {
  let state = { query: '', filter: 'all', selectedKey: null };

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function buildCustomers(orders) {
    const map = {};
    orders.forEach(o => {
      const email = (o.email || '').trim().toLowerCase();
      const name = o.customerName || o.name || 'Customer';
      const key = email || name + '|' + (o.phone || '');
      if (!map[key]) {
        map[key] = {
          key,
          name,
          email: o.email || '',
          phone: o.phone || '',
          orders: [],
          totalSpent: 0,
          lastOrder: ''
        };
      }
      const c = map[key];
      c.orders.push(o);
      if ((o.status || '') !== 'cancelled') {
        c.totalSpent += Number(o.total) || 0;
      }
      const d = o.createdAt || o.date || '';
      if (d > c.lastOrder) c.lastOrder = d;
      if (!c.email && o.email) c.email = o.email;
      if (!c.phone && o.phone) c.phone = o.phone;
    });
    return Object.values(map).sort((a, b) => b.lastOrder.localeCompare(a.lastOrder));
  }

  function render() {
    const root = document.getElementById('customers-root');
    if (!root || !window.CEStore) return;

    const orders = CEStore.getOrders();
    let customers = buildCustomers(orders);
    const total = customers.length;
    const returning = customers.filter(c => c.orders.length > 1).length;
    const oneTime = total - returning;
    const orderCount = orders.length;

    const q = state.query.trim().toLowerCase();
    if (q) {
      customers = customers.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
      );
    }
    if (state.filter === 'new') customers = customers.filter(c => c.orders.length === 1);
    if (state.filter === 'returning') customers = customers.filter(c => c.orders.length > 1);

    const selected = state.selectedKey
      ? customers.find(c => c.key === state.selectedKey) || buildCustomers(orders).find(c => c.key === state.selectedKey)
      : null;

    root.innerHTML = `
      <div class="mb-6">
        <h2 class="font-brand text-xl text-ink">Customers</h2>
        <p class="text-sm text-muted mt-0.5">From placed orders only (no invented contacts)</p>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div class="rounded-2xl border border-[#ece8df] bg-white p-4">
          <p class="text-xs text-muted">Total customers</p>
          <p class="text-xl font-semibold text-ink mt-1">${total}</p>
        </div>
        <div class="rounded-2xl border border-[#ece8df] bg-white p-4">
          <p class="text-xs text-muted">One-time</p>
          <p class="text-xl font-semibold text-ink mt-1">${oneTime}</p>
        </div>
        <div class="rounded-2xl border border-[#ece8df] bg-white p-4">
          <p class="text-xs text-muted">Returning</p>
          <p class="text-xl font-semibold text-ink mt-1">${returning}</p>
        </div>
        <div class="rounded-2xl border border-[#ece8df] bg-white p-4">
          <p class="text-xs text-muted">Total orders</p>
          <p class="text-xl font-semibold text-ink mt-1">${orderCount}</p>
        </div>
      </div>

      <div class="grid lg:grid-cols-5 gap-4">
        <div class="lg:col-span-3 rounded-2xl border border-[#ece8df] bg-white overflow-hidden">
          <div class="flex flex-col sm:flex-row gap-2 p-4 border-b border-[#ece8df]">
            <input type="search" id="cust-q" value="${escapeHtml(state.query)}" placeholder="Search name, email, phone…"
              class="flex-1 rounded-xl border border-[#ece8df] bg-page px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            <select id="cust-filter" class="rounded-xl border border-[#ece8df] bg-page px-3 py-2 text-sm">
              <option value="all" ${state.filter === 'all' ? 'selected' : ''}>All</option>
              <option value="new" ${state.filter === 'new' ? 'selected' : ''}>One-time</option>
              <option value="returning" ${state.filter === 'returning' ? 'selected' : ''}>Returning</option>
            </select>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-muted border-b border-[#ece8df]">
                  <th class="px-4 py-3 font-semibold">Customer</th>
                  <th class="px-3 py-3 font-semibold">Orders</th>
                  <th class="px-3 py-3 font-semibold">Spent</th>
                  <th class="px-3 py-3 font-semibold hidden sm:table-cell">Last order</th>
                  <th class="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                ${customers.length === 0
                  ? `<tr><td colspan="5" class="px-4 py-12 text-center text-muted">No customers yet. They appear after shop checkouts.</td></tr>`
                  : customers.map(c => `
                    <tr class="border-b border-[#f3efe6] hover:bg-page/80">
                      <td class="px-4 py-3">
                        <div class="font-medium text-ink">${escapeHtml(c.name)}</div>
                        <div class="text-xs text-muted">${escapeHtml(c.email || c.phone || '—')}</div>
                      </td>
                      <td class="px-3 py-3">${c.orders.length}</td>
                      <td class="px-3 py-3 font-medium">${CEStore.money(c.totalSpent)}</td>
                      <td class="px-3 py-3 text-muted hidden sm:table-cell">${(c.lastOrder || '').slice(0, 10) || '—'}</td>
                      <td class="px-4 py-3 text-right">
                        <button type="button" class="btn-view text-xs font-medium text-ink hover:underline" data-key="${escapeHtml(c.key)}">View</button>
                      </td>
                    </tr>`).join('')
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="lg:col-span-2">
          ${!selected
            ? `<div class="rounded-2xl border border-dashed border-[#ece8df] bg-white p-10 text-center text-sm text-muted">Select a customer</div>`
            : `<div class="rounded-2xl border border-[#ece8df] bg-white overflow-hidden">
                <div class="px-5 py-4 border-b border-[#ece8df]">
                  <h3 class="font-semibold text-ink">${escapeHtml(selected.name)}</h3>
                  <p class="text-sm text-muted mt-1">${escapeHtml(selected.email || '—')}</p>
                  <p class="text-sm text-muted">${escapeHtml(selected.phone || '—')}</p>
                </div>
                <div class="p-5">
                  <p class="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Order history</p>
                  <ul class="space-y-2 text-sm">
                    ${selected.orders.slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).map(o => `
                      <li class="flex justify-between gap-2 border-b border-[#f3efe6] pb-2">
                        <div>
                          <span class="font-medium text-ink">${escapeHtml(o.id)}</span>
                          <span class="text-xs text-muted block">${(o.createdAt || o.date || '').slice(0, 10)} · ${escapeHtml(o.status || 'pending')}</span>
                        </div>
                        <span class="font-medium">${CEStore.money(o.total)}</span>
                      </li>`).join('')}
                  </ul>
                  <p class="mt-4 text-sm font-semibold text-ink">Lifetime spent (excl. cancelled): ${CEStore.money(selected.totalSpent)}</p>
                </div>
              </div>`
          }
        </div>
      </div>
    `;

    document.getElementById('cust-q').oninput = (e) => { state.query = e.target.value; render(); };
    document.getElementById('cust-filter').onchange = (e) => { state.filter = e.target.value; render(); };
    root.querySelectorAll('.btn-view').forEach(btn => {
      btn.onclick = () => { state.selectedKey = btn.dataset.key; render(); };
    });
  }

  document.addEventListener('DOMContentLoaded', render);
})();
