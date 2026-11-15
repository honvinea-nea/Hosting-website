/**
 * Shoply admin overview and browser-backed storefront control center.
 * The current app persists data in localStorage; it is not a production admin backend.
 */
(function () {
  const WIDGETS_KEY = 'ce_dashboard_widgets';
  const PERIOD_KEY = 'ce_dashboard_period';
  const WIDGETS = [
    ['revenue', 'Sales overview'],
    ['alerts', 'Store alerts'],
    ['orders', 'Recent orders'],
    ['products', 'Best-selling products']
  ];

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function contrastAgainstWhite(hex) {
    const match = /^#([\da-f]{6})$/i.exec(hex);
    if (!match) return 0;
    const channels = [0, 2, 4].map(index => parseInt(match[1].slice(index, index + 2), 16) / 255);
    const luminance = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    const relative = 0.2126 * luminance[0] + 0.7152 * luminance[1] + 0.0722 * luminance[2];
    return 1.05 / (relative + 0.05);
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  function readWidgets() {
    try {
      const saved = JSON.parse(localStorage.getItem(WIDGETS_KEY) || 'null');
      return Array.isArray(saved) ? saved.filter(id => WIDGETS.some(widget => widget[0] === id)) : WIDGETS.map(widget => widget[0]);
    } catch (error) {
      console.error('Unable to read dashboard widget preferences.', error);
      return WIDGETS.map(widget => widget[0]);
    }
  }

  function readPeriod() {
    try {
      const period = localStorage.getItem(PERIOD_KEY);
      return ['7', '30', '90', 'all'].includes(period) ? period : '30';
    } catch (error) {
      console.error('Unable to read dashboard date preference.', error);
      return '30';
    }
  }

  function ordersInPeriod(orders, period) {
    if (period === 'all') return orders;
    const days = Number(period);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - days + 1);
    const now = new Date();
    return orders.filter(order => {
      const date = new Date(order.createdAt || order.date || '');
      return !Number.isNaN(date.getTime()) && date >= start && date <= now;
    });
  }

  function computeStats(products, orders) {
    const settings = CEStore.getSettings();
    const threshold = Number(settings.lowStockThreshold) || 5;
    const completed = orders.filter(order => order.status === 'delivered').length;
    const cancelled = orders.filter(order => order.status === 'cancelled').length;
    const pending = orders.filter(order => ['pending', 'confirmed', 'processing'].includes(order.status || 'pending')).length;
    const customers = new Set(orders.map(order => (order.email || order.customerName || order.name || '').trim().toLowerCase()).filter(Boolean));
    const lowStock = products.filter(product => product.status !== 'draft' && (Number(product.stock) || 0) <= threshold);
    const revenue = orders.filter(order => !['cancelled', 'refunded'].includes(order.status)).reduce((sum, order) => sum + (Number(order.total) || 0), 0);

    return { revenue, orderCount: orders.length, pending, completed, cancelled, productCount: products.length, customerCount: customers.size, lowStockCount: lowStock.length, lowStock, threshold };
  }

  function bestSellers(products, orders) {
    const sold = {};
    orders.filter(order => order.status !== 'cancelled').forEach(order => {
      (order.items || []).forEach(item => {
        const key = String(item.id || item.name);
        if (!sold[key]) sold[key] = { id: item.id, name: item.name, qty: 0, revenue: 0, image: item.image };
        sold[key].qty += Number(item.qty) || 1;
        sold[key].revenue += (Number(item.price) || 0) * (Number(item.qty) || 1);
      });
    });
    products.forEach(product => {
      const item = sold[String(product.id)];
      if (item) {
        item.category = product.category;
        item.image = item.image || product.image;
      }
    });
    return Object.values(sold).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }

  function salesSeries(orders, period) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates = period === 'all'
      ? orders.map(order => new Date(order.createdAt || order.date || '')).filter(date => !Number.isNaN(date.getTime()))
      : [];
    const start = period === 'all' && dates.length ? new Date(Math.min(...dates.map(date => date.getTime()))) : new Date(today);
    start.setHours(0, 0, 0, 0);
    if (period !== 'all') start.setDate(start.getDate() - Number(period) + 1);
    const dayCount = Math.max(1, Math.floor((today - start) / 86400000) + 1);
    const bucketCount = Math.min(14, dayCount);
    const series = Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = new Date(start);
      bucketStart.setDate(start.getDate() + Math.floor(index * dayCount / bucketCount));
      const bucketEnd = new Date(start);
      bucketEnd.setDate(start.getDate() + Math.floor((index + 1) * dayCount / bucketCount));
      return { start: bucketStart, end: bucketEnd, total: 0 };
    });
    orders.filter(order => !['cancelled', 'refunded'].includes(order.status)).forEach(order => {
      const date = new Date(order.createdAt || order.date || '');
      if (Number.isNaN(date.getTime()) || date < start || date > new Date(today.getTime() + 86400000 - 1)) return;
      const index = Math.min(bucketCount - 1, Math.floor((date - start) / 86400000 / dayCount * bucketCount));
      series[index].total += Number(order.total) || 0;
    });
    return series;
  }

  function statusBadge(status) {
    const normalized = String(status || 'pending').toLowerCase();
    const styles = {
      pending: 'bg-amber-50 text-amber-800',
      confirmed: 'bg-sky-50 text-sky-800',
      processing: 'bg-indigo-50 text-indigo-800',
      shipped: 'bg-blue-50 text-blue-800',
      delivered: 'bg-emerald-50 text-emerald-800',
      cancelled: 'bg-red-50 text-red-800',
      refunded: 'bg-slate-100 text-slate-700'
    };
    return `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[normalized] || styles.pending}">${escapeHtml(normalized)}</span>`;
  }

  function renderChart(series) {
    const max = Math.max(1, ...series.map(bucket => bucket.total));
    return `<div class="sales-chart" role="img" aria-label="Revenue chart with ${series.length} time periods">
      ${series.map(bucket => {
        const height = Math.round(bucket.total / max * 100);
        const label = bucket.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `<div class="sales-bar-wrap" title="${escapeHtml(label)}: ${escapeHtml(CEStore.money(bucket.total))}">
          <div class="sales-bar" style="height:${Math.max(height, bucket.total > 0 ? 8 : 2)}%"></div>
          <span>${escapeHtml(label)}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  function statCard(label, value, detail, icon, tone) {
    return `<article class="stat-card">
      <div class="stat-card-top"><span>${label}</span><span class="stat-icon ${tone}"><i data-lucide="${icon}"></i></span></div>
      <strong>${value}</strong><small>${detail}</small>
    </article>`;
  }

  function renderAlerts(stats, orders) {
    const alerts = [];
    if (stats.lowStockCount) alerts.push(['amber', `${stats.lowStockCount} product${stats.lowStockCount === 1 ? '' : 's'} at or below ${stats.threshold} in stock`, 'inventory.html', 'Review stock']);
    if (stats.pending) alerts.push(['blue', `${stats.pending} order${stats.pending === 1 ? '' : 's'} need attention`, 'orders.html', 'Review orders']);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newOrders = orders.filter(order => {
      const date = new Date(order.createdAt || order.date || '');
      return !Number.isNaN(date.getTime()) && date >= today;
    }).length;
    if (newOrders) alerts.push(['green', `${newOrders} new order${newOrders === 1 ? '' : 's'} today`, 'orders.html', 'View orders']);
    if (!alerts.length) return '<p class="empty-note">Everything looks good. No alerts for this period.</p>';
    return `<ul class="alert-list">${alerts.map(([tone, title, href, action]) => `
      <li class="alert-row tone-${tone}"><span class="alert-dot"></span><span>${escapeHtml(title)}</span><a href="${href}">${escapeHtml(action)} →</a></li>`).join('')}
    </ul>`;
  }

  function controlCenter(settings) {
    return `<section id="control-center" class="control-center panel-card">
      <div class="section-heading">
        <div><p class="eyebrow">SUPER ADMIN · STORE EXPERIENCE</p><h2>Control center</h2><p>Update key storefront content and theme settings. Changes are shared with the Shoply homepage on this browser.</p></div>
        <a class="subtle-link" href="../index.html" target="_blank" rel="noopener">Preview storefront ↗</a>
      </div>
      <form id="site-settings-form" class="control-grid">
        <label class="field-span-2">Store name<input name="storeName" maxlength="60" required value="${escapeHtml(settings.storeName)}"></label>
        <label>Brand color<input name="brandColor" type="color" value="${escapeHtml(settings.brandColor)}"></label>
        <label>Accent color<input name="accentColor" type="color" value="${escapeHtml(settings.accentColor)}"></label>
        <label class="field-span-2">Homepage headline<input name="homepageTitle" maxlength="100" required value="${escapeHtml(settings.homepageTitle)}"></label>
        <label class="field-span-2">Homepage description<textarea name="homepageDescription" maxlength="240" rows="3" required>${escapeHtml(settings.homepageDescription)}</textarea></label>
        <label class="field-span-2">Announcement bar<input name="announcement" maxlength="120" required value="${escapeHtml(settings.announcement)}"></label>
        <div class="field-span-2 control-form-actions">
          <p id="control-status" class="control-status" aria-live="polite">Storefront edits are saved in this browser.</p>
          <button type="submit" class="action-primary">Save &amp; publish</button>
        </div>
      </form>
    </section>`;
  }

  function render() {
    const root = document.getElementById('dashboard-root');
    if (!root || !window.CEStore) return;

    const products = CEStore.getProducts();
    const allOrders = CEStore.getOrders().slice().sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));
    const period = readPeriod();
    const orders = ordersInPeriod(allOrders, period);
    const stats = computeStats(products, orders);
    const sellers = bestSellers(products, orders);
    const series = salesSeries(orders, period);
    const settings = CEStore.getSettings();
    const widgets = readWidgets();
    const periodLabel = period === 'all' ? 'All time' : `Last ${period} days`;
    const recent = orders.slice(0, 6);

    root.innerHTML = `
      <div class="dashboard-wrap">
        <div class="demo-banner"><i data-lucide="info"></i><div><strong>Demo environment</strong><span>Data and edits are stored in this browser only. Admin access is not protected by a secure backend.</span></div><a href="settings.html">Store settings →</a></div>
        <div class="page-heading">
          <div><p class="eyebrow">${escapeHtml(formatDate(new Date()))}</p><h2>Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, Admin</h2><p>Here’s the pulse of your store.</p></div>
          <div class="heading-actions">
            <label class="period-control"><span>Period</span><select id="period-select" aria-label="Dashboard date range">
              <option value="7" ${period === '7' ? 'selected' : ''}>Last 7 days</option>
              <option value="30" ${period === '30' ? 'selected' : ''}>Last 30 days</option>
              <option value="90" ${period === '90' ? 'selected' : ''}>Last 90 days</option>
              <option value="all" ${period === 'all' ? 'selected' : ''}>All time</option>
            </select></label>
            <button type="button" class="action-secondary" id="customize-widgets" aria-expanded="false"><i data-lucide="sliders-horizontal"></i> Customize</button>
            <a href="products.html" class="action-primary"><i data-lucide="plus"></i> Add product</a>
          </div>
        </div>
        <div class="widget-customizer panel-card" id="widget-customizer" hidden>
          <div><h3>Dashboard widgets</h3><p>Choose the sections shown on your overview.</p></div>
          <div class="widget-options">${WIDGETS.map(([id, label]) => `<label><input type="checkbox" data-widget="${id}" ${widgets.includes(id) ? 'checked' : ''}> ${label}</label>`).join('')}</div>
        </div>

        <section class="stats-grid" aria-label="Store metrics">
          ${statCard('Revenue', CEStore.money(stats.revenue), periodLabel, 'wallet', 'ink')}
          ${statCard('Orders', stats.orderCount, `${stats.pending} in progress`, 'shopping-bag', 'blue')}
          ${statCard('Products', stats.productCount, `${products.filter(product => product.status === 'active' || !product.status).length} published`, 'package', 'violet')}
          ${statCard('Customers', stats.customerCount, `In selected period`, 'users', 'sand')}
          ${statCard('Pending orders', stats.pending, 'Awaiting fulfillment', 'clock-3', 'amber')}
          ${statCard('Completed', stats.completed, 'Delivered orders', 'circle-check', 'green')}
          ${statCard('Cancelled', stats.cancelled, 'Cancelled orders', 'circle-x', 'rose')}
          ${statCard('Low stock', stats.lowStockCount, `At or below ${stats.threshold} units`, 'boxes', 'orange')}
        </section>

        <div class="dashboard-grid">
          <section class="panel-card dashboard-revenue" data-widget-panel="revenue">
            <div class="section-heading compact"><div><h3>Revenue overview</h3><p>${periodLabel} · excludes cancelled and refunded</p></div><strong>${CEStore.money(stats.revenue)}</strong></div>
            ${renderChart(series)}
          </section>
          <section class="panel-card" data-widget-panel="alerts">
            <div class="section-heading compact"><div><h3>Needs your attention</h3><p>Store alerts for ${periodLabel.toLowerCase()}</p></div><span class="live-pill">LIVE</span></div>
            ${renderAlerts(stats, orders)}
            <a class="panel-footer-link" href="inventory.html">Open inventory &amp; orders →</a>
          </section>
          <section class="panel-card dashboard-orders" data-widget-panel="orders">
            <div class="section-heading compact"><div><h3>Recent orders</h3><p>Latest activity in this period</p></div><a class="subtle-link" href="orders.html">View all →</a></div>
            <div class="table-scroll"><table class="orders-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>${recent.length ? recent.map(order => `<tr>
                <td class="order-id">${escapeHtml(order.id || '—')}</td><td>${escapeHtml(order.customerName || order.name || 'Customer')}</td>
                <td>${escapeHtml((order.createdAt || order.date || '').slice(0, 10) || '—')}</td><td class="order-total">${escapeHtml(CEStore.money(order.total))}</td><td>${statusBadge(order.status)}</td>
              </tr>`).join('') : '<tr><td class="empty-table" colspan="5">No orders in this period yet.</td></tr>'}</tbody>
            </table></div>
          </section>
          <section class="panel-card dashboard-sellers" data-widget-panel="products">
            <div class="section-heading compact"><div><h3>Best sellers</h3><p>Top products by units sold</p></div><a class="subtle-link" href="products.html">Products →</a></div>
            ${sellers.length ? `<ul class="seller-list">${sellers.map(seller => {
              const sImg = seller.image ? (seller.image.startsWith('http') || seller.image.startsWith('/') ? seller.image : '../' + seller.image) : '';
              return `<li>
              <div class="seller-image">${sImg ? `<img src="${escapeHtml(sImg)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<i data-lucide="flower-2"></i>'}</div>
              <div class="seller-info"><strong>${escapeHtml(seller.name || 'Product')}</strong><span>${escapeHtml(seller.category || 'General')} · ${seller.qty} sold</span></div>
              <strong class="seller-revenue">${escapeHtml(CEStore.money(seller.revenue))}</strong>
            </li>`;
            }).join('')}</ul>` : '<p class="empty-note">Product performance will appear after your first orders.</p>'}
          </section>
        </div>

        <section class="operations-section">
          <div class="section-heading"><div><p class="eyebrow">SHOPLY ECOSYSTEM</p><h2>Manage your store</h2><p>Jump into the tools behind your customer experience.</p></div></div>
          <div class="module-grid">
            <a class="module-card" href="products.html"><span class="module-icon"><i data-lucide="package"></i></span><strong>Catalog</strong><span>Products, pricing and categories</span><i data-lucide="arrow-up-right" class="module-arrow"></i></a>
            <a class="module-card" href="orders.html"><span class="module-icon"><i data-lucide="shopping-bag"></i></span><strong>Orders</strong><span>Fulfillment and customer orders</span><i data-lucide="arrow-up-right" class="module-arrow"></i></a>
            <a class="module-card" href="customers.html"><span class="module-icon"><i data-lucide="users"></i></span><strong>Customers</strong><span>Customer records and activity</span><i data-lucide="arrow-up-right" class="module-arrow"></i></a>
            <a class="module-card" href="promotions.html"><span class="module-icon"><i data-lucide="ticket-percent"></i></span><strong>Marketing</strong><span>Offers and promotions</span><i data-lucide="arrow-up-right" class="module-arrow"></i></a>
            <a class="module-card" href="analytics.html"><span class="module-icon"><i data-lucide="chart-no-axes-combined"></i></span><strong>Reports</strong><span>Performance and sales analytics</span><i data-lucide="arrow-up-right" class="module-arrow"></i></a>
            <a class="module-card" href="settings.html"><span class="module-icon"><i data-lucide="settings-2"></i></span><strong>Settings</strong><span>Delivery, inventory and store setup</span><i data-lucide="arrow-up-right" class="module-arrow"></i></a>
            ${ADMIN.permissions.includes('admins.view') ? '<a class="module-card" href="team.html"><span class="module-icon"><i data-lucide="shield-check"></i></span><strong>Team &amp; access</strong><span>Administrator roles and activity</span><i data-lucide="arrow-up-right" class="module-arrow"></i></a>' : ''}
          </div>
        </section>

        ${ADMIN.permissions.includes('content.manage') ? controlCenter(settings) : ''}
      </div>
    `;

    root.querySelectorAll('[data-widget-panel]').forEach(panel => {
      panel.hidden = !widgets.includes(panel.dataset.widgetPanel);
    });
    root.querySelector('#period-select').addEventListener('change', event => {
      try {
        localStorage.setItem(PERIOD_KEY, event.target.value);
        render();
      } catch (error) {
        console.error('Unable to save dashboard date preference.', error);
      }
    });
    root.querySelector('#customize-widgets').addEventListener('click', event => {
      const panel = root.querySelector('#widget-customizer');
      panel.hidden = !panel.hidden;
      event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
    });
    root.querySelectorAll('[data-widget]').forEach(input => {
      input.addEventListener('change', () => {
        const selected = Array.from(root.querySelectorAll('[data-widget]:checked')).map(item => item.dataset.widget);
        try {
          localStorage.setItem(WIDGETS_KEY, JSON.stringify(selected));
          root.querySelectorAll('[data-widget-panel]').forEach(panel => {
            panel.hidden = !selected.includes(panel.dataset.widgetPanel);
          });
        } catch (error) {
          console.error('Unable to save dashboard widget preferences.', error);
          input.checked = !input.checked;
        }
      });
    });
    root.querySelector('#site-settings-form').addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      const next = {
        ...CEStore.getSettings(),
        storeName: String(formData.get('storeName')).trim(),
        brandColor: String(formData.get('brandColor')),
        accentColor: String(formData.get('accentColor')),
        homepageTitle: String(formData.get('homepageTitle')).trim(),
        homepageDescription: String(formData.get('homepageDescription')).trim(),
        announcement: String(formData.get('announcement')).trim()
      };
      if (contrastAgainstWhite(next.brandColor) < 4.5) {
        root.querySelector('#control-status').textContent = 'Choose a darker brand color to keep white button text accessible (4.5:1 contrast).';
        return;
      }
      if (!next.storeName || !next.homepageTitle || !next.homepageDescription || !next.announcement) {
        root.querySelector('#control-status').textContent = 'Please fill in all required storefront fields.';
        return;
      }
      try {
        CEStore.saveSettings(next);
        root.querySelector('#control-status').textContent = 'Published. Refresh the storefront preview to see your changes.';
      } catch (error) {
        console.error('Unable to save storefront settings.', error);
        root.querySelector('#control-status').textContent = 'Could not save changes in this browser. Check storage availability and try again.';
      }
    });
    if (window.lucide) lucide.createIcons();
  }

  window.renderShoplyDashboard = render;
  document.addEventListener('DOMContentLoaded', render);
})();
