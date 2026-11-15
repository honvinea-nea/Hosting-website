/**
 * Stage 5 — Order management
 * List, search, filter, details, status updates via CEStore
 */
(function () {
  const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

  let state = {
    query: '',
    status: 'all',
    sort: 'newest',
    selectedId: null
  };

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function badge(status) {
    const s = (status || 'pending').toLowerCase();
    const map = {
      pending: 'bg-amber-50 text-amber-800',
      confirmed: 'bg-sky-50 text-sky-800',
      processing: 'bg-indigo-50 text-indigo-800',
      shipped: 'bg-blue-50 text-blue-800',
      delivered: 'bg-emerald-50 text-emerald-800',
      cancelled: 'bg-red-50 text-red-800'
    };
    return `<span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[s] || map.pending}">${s}</span>`;
  }

  function stats(orders) {
    const c = { all: orders.length };
    STATUSES.forEach(s => { c[s] = 0; });
    orders.forEach(o => {
      const s = (o.status || 'pending').toLowerCase();
      if (c[s] != null) c[s]++;
    });
    return c;
  }

  function filterSort(orders) {
    let list = orders.slice();
    const q = state.query.trim().toLowerCase();
    if (q) {
      list = list.filter(o =>
        String(o.id || '').toLowerCase().includes(q) ||
        String(o.customerName || o.name || '').toLowerCase().includes(q) ||
        String(o.email || '').toLowerCase().includes(q)
      );
    }
    if (state.status !== 'all') {
      list = list.filter(o => (o.status || 'pending').toLowerCase() === state.status);
    }
    list.sort((a, b) => {
      const da = a.createdAt || a.date || '';
      const db = b.createdAt || b.date || '';
      return state.sort === 'oldest' ? da.localeCompare(db) : db.localeCompare(da);
    });
    return list;
  }

  function itemCount(o) {
    return (o.items || []).reduce((s, it) => s + (it.qty || 1), 0);
  }

  async function updateStatus(id, newStatus) {
    const apiStatus = ({ shipped: 'out_for_delivery', delivered: 'completed' })[newStatus] || newStatus;
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: apiStatus })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || 'Could not update order.');
    } catch (error) { toast(error.message); return; }
    const orders = CEStore.getOrders();
    const idx = orders.findIndex(o => o.id === id);
    if (idx < 0) return;
    orders[idx].status = newStatus;
    orders[idx].updatedAt = new Date().toISOString();
    CEStore.saveOrders(orders);
    // keep legacy in sync if present
    try {
      localStorage.setItem('bb_orders', JSON.stringify(orders));
    } catch (_) {}
    if (CEStore.pushNotification) {
      CEStore.pushNotification({
        type: 'order',
        title: `Order ${id} → ${newStatus}`,
        link: 'orders.html'
      });
    }
    toast('Status updated');
    render();
  }

  function toast(msg) {
    let el = document.getElementById('ce-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ce-toast';
      el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] rounded-xl bg-ink text-white text-sm px-4 py-2.5 shadow-lg opacity-0 transition-opacity duration-200';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 2200);
  }

  function detailsHtml(o) {
    if (!o) {
      return `<div class="rounded-2xl border border-dashed border-[#ece8df] bg-white p-10 text-center text-sm text-muted">
        Select an order to view details
      </div>`;
    }
    const items = o.items || [];
    return `
      <div class="rounded-2xl border border-[#ece8df] bg-white overflow-hidden">
        <div class="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#ece8df]">
          <div>
            <p class="text-xs text-muted">Order</p>
            <h3 class="font-semibold text-ink text-lg">${escapeHtml(o.id)}</h3>
            <div class="mt-1">${badge(o.status)}</div>
          </div>
          <button type="button" id="close-detail" class="text-xs text-muted hover:text-ink">Close</button>
        </div>
        <div class="p-5 space-y-5 text-sm">
          <div>
            <h4 class="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Customer</h4>
            <p class="font-medium text-ink">${escapeHtml(o.customerName || o.name || '—')}</p>
            <p class="text-muted">${escapeHtml(o.email || '—')}</p>
            <p class="text-muted">${escapeHtml(o.phone || '—')}</p>
            <p class="text-muted mt-1 whitespace-pre-line">${escapeHtml(o.address || '—')}</p>
            ${o.recipient ? `<p class="text-muted mt-1">Recipient: ${escapeHtml(o.recipient)}</p>` : ''}
          </div>
          <div>
            <h4 class="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Items</h4>
            <ul class="space-y-2">
              ${items.length === 0 ? '<li class="text-muted">No line items</li>' :
                items.map(it => `
                  <li class="flex justify-between gap-2 border-b border-[#f3efe6] pb-2">
                    <span>${escapeHtml(it.name)} × ${it.qty || 1}</span>
                    <span class="font-medium">${CEStore.money((it.price || 0) * (it.qty || 1))}</span>
                  </li>`).join('')}
            </ul>
          </div>
          <div class="space-y-1">
            <div class="flex justify-between text-muted"><span>Subtotal</span><span>${CEStore.money(o.subtotal != null ? o.subtotal : o.total)}</span></div>
            <div class="flex justify-between text-muted"><span>Delivery</span><span>${CEStore.money(o.deliveryFee || 0)}</span></div>
            <div class="flex justify-between font-semibold text-ink text-base pt-2 border-t border-[#ece8df]">
              <span>Total</span><span>${CEStore.money(o.total)}</span>
            </div>
            <p class="text-xs text-muted pt-1">Payment: ${escapeHtml(o.paymentMethod || 'Demo')}</p>
            ${o.message ? `<p class="text-xs text-muted italic">“${escapeHtml(o.message)}”</p>` : ''}
          </div>
          <div>
            <h4 class="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Update status</h4>
            <div class="flex flex-wrap gap-2">
              ${STATUSES.map(s => `
                <button type="button" class="status-btn rounded-lg border px-3 py-1.5 text-xs font-medium capitalize
                  ${(o.status || 'pending') === s ? 'border-ink bg-ink text-white' : 'border-[#ece8df] hover:bg-cream'}"
                  data-status="${s}">${s}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
  }

  function render() {
    const root = document.getElementById('orders-root');
    if (!root || !window.CEStore) return;

    const all = CEStore.getOrders();
    const st = stats(all);
    const list = filterSort(all);
    const selected = state.selectedId
      ? all.find(o => o.id === state.selectedId)
      : null;

    root.innerHTML = `
      <div class="mb-6">
        <h2 class="font-brand text-xl text-ink">Orders</h2>
        <p class="text-sm text-muted mt-0.5">Track and update customer orders</p>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        ${['all', ...STATUSES].map(s => {
          const label = s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1);
          const n = s === 'all' ? st.all : (st[s] || 0);
          const active = state.status === s;
          return `<button type="button" class="stat-filter rounded-xl border px-3 py-2.5 text-left transition
            ${active ? 'border-ink bg-ink text-white' : 'border-[#ece8df] bg-white hover:bg-cream'}" data-status="${s}">
            <span class="block text-xs opacity-80">${label}</span>
            <span class="block text-lg font-semibold">${n}</span>
          </button>`;
        }).join('')}
      </div>

      <div class="grid lg:grid-cols-5 gap-4">
        <div class="lg:col-span-3 rounded-2xl border border-[#ece8df] bg-white overflow-hidden">
          <div class="flex flex-col sm:flex-row gap-2 p-4 border-b border-[#ece8df]">
            <input type="search" id="order-q" value="${escapeHtml(state.query)}" placeholder="Search order ID or customer…"
              class="flex-1 rounded-xl border border-[#ece8df] bg-page px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            <select id="order-sort" class="rounded-xl border border-[#ece8df] bg-page px-3 py-2 text-sm">
              <option value="newest" ${state.sort === 'newest' ? 'selected' : ''}>Newest</option>
              <option value="oldest" ${state.sort === 'oldest' ? 'selected' : ''}>Oldest</option>
            </select>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-muted border-b border-[#ece8df]">
                  <th class="px-4 py-3 font-semibold">Order</th>
                  <th class="px-3 py-3 font-semibold">Customer</th>
                  <th class="px-3 py-3 font-semibold hidden sm:table-cell">Items</th>
                  <th class="px-3 py-3 font-semibold">Total</th>
                  <th class="px-3 py-3 font-semibold">Status</th>
                  <th class="px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                ${list.length === 0
                  ? `<tr><td colspan="6" class="px-4 py-12 text-center text-muted">No orders found. Place an order from the shop cart.</td></tr>`
                  : list.map(o => `
                    <tr class="border-b border-[#f3efe6] hover:bg-page/80 ${state.selectedId === o.id ? 'bg-cream/50' : ''}">
                      <td class="px-4 py-3 font-medium text-ink whitespace-nowrap">${escapeHtml(o.id)}</td>
                      <td class="px-3 py-3">
                        <div class="font-medium text-navy">${escapeHtml(o.customerName || o.name || '—')}</div>
                        <div class="text-xs text-muted">${(o.createdAt || o.date || '').slice(0, 10)}</div>
                      </td>
                      <td class="px-3 py-3 text-muted hidden sm:table-cell">${itemCount(o)}</td>
                      <td class="px-3 py-3 font-medium">${CEStore.money(o.total)}</td>
                      <td class="px-3 py-3">${badge(o.status)}</td>
                      <td class="px-4 py-3 text-right">
                        <button type="button" class="btn-view text-xs font-medium text-ink hover:underline" data-id="${escapeHtml(o.id)}">View</button>
                      </td>
                    </tr>`).join('')
                }
              </tbody>
            </table>
          </div>
        </div>
        <div class="lg:col-span-2" id="order-detail-panel">
          ${detailsHtml(selected)}
        </div>
      </div>
    `;

    document.getElementById('order-q').oninput = (e) => { state.query = e.target.value; render(); };
    document.getElementById('order-sort').onchange = (e) => { state.sort = e.target.value; render(); };
    root.querySelectorAll('.stat-filter').forEach(btn => {
      btn.onclick = () => { state.status = btn.dataset.status; state.selectedId = null; render(); };
    });
    root.querySelectorAll('.btn-view').forEach(btn => {
      btn.onclick = () => { state.selectedId = btn.dataset.id; render(); };
    });
    const closeBtn = document.getElementById('close-detail');
    if (closeBtn) closeBtn.onclick = () => { state.selectedId = null; render(); };
    root.querySelectorAll('.status-btn').forEach(btn => {
      btn.onclick = () => {
        if (!state.selectedId) return;
        updateStatus(state.selectedId, btn.dataset.status);
      };
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const response = await fetch('/api/admin/orders', { credentials: 'same-origin' });
      if (response.ok) {
        const payload = await response.json();
        if (Array.isArray(payload.orders)) {
          payload.orders = payload.orders.map(o => ({ ...o, status: ({ out_for_delivery: 'shipped', completed: 'delivered' })[o.status] || o.status }));
          CEStore.saveOrders(payload.orders);
        }
      }
    } catch (_) { /* Show locally cached orders if API is offline. */ }
    render();
  });
})();
