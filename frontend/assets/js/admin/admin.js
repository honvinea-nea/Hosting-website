
/*
 * admin.js — shared layout for every admin page.
 * It builds the sidebar and the top bar, so we write them only once.
 * Each page just needs <div id="sidebar-root"> and <div id="topbar-root">.
 */

// Brand shown in the admin. Change these two lines to rename the whole dashboard.
const STORE_SETTINGS = window.CEStore ? CEStore.getSettings() : {};
const BRAND = { name: STORE_SETTINGS.storeName || 'Shoply', tagline: 'Control center' };

// 1. The pages in the menu. "file" must match the HTML file name.
const NAV_SECTIONS = [
  {
    title: 'MAIN MENU',
    items: [
      { label: 'Overview',   file: 'index.html',      icon: 'layout-dashboard', permission: 'dashboard.view' },
      { label: 'Control Center', file: 'index.html#control-center', icon: 'panels-top-left', permission: 'content.manage' },
      { label: 'Products',   file: 'products.html',   icon: 'flower-2', permission: 'products.view' },
      { label: 'Orders',     file: 'orders.html',     icon: 'shopping-bag', permission: 'orders.view' },
      { label: 'Inventory',  file: 'inventory.html',  icon: 'boxes', permission: 'inventory.manage' },
      { label: 'Customers',  file: 'customers.html',  icon: 'users', permission: 'customers.view' },
      { label: 'Categories', file: 'categories.html', icon: 'tags', permission: 'categories.manage' },
      { label: 'Promotions', file: 'promotions.html', icon: 'ticket-percent', permission: 'promotions.manage' },
      { label: 'Team & Access', file: 'team.html', icon: 'shield-check', permission: 'admins.view' }
    ]
  },
  {
    title: 'MANAGEMENT',
    items: [
      { label: 'Analytics',      file: 'analytics.html', icon: 'chart-column', permission: 'analytics.view' },
      { label: 'Store Settings', file: 'settings.html',  icon: 'settings', permission: 'settings.view' }
    ]
  }
];

// Temporary admin details.
let ADMIN = { name: 'Admin', role: 'Administrator', email: '', permissions: [] };

function escapeAdminText(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

// 2. Which page are we on? (used to highlight the active menu item)
function getCurrentFile() {
  const file = window.location.pathname.split('/').pop();
  return file || 'index.html';
}

function getCurrentItem() {
  const file = getCurrentFile();
  for (const section of NAV_SECTIONS) {
    const found = section.items.find(item => {
      const [itemFile, itemHash] = item.file.split('#');
      return itemFile === file && (itemHash ? window.location.hash === `#${itemHash}` : !window.location.hash);
    });
    if (found) return found;
  }
  return NAV_SECTIONS[0].items[0];
}

function syncCurrentNav() {
  const current = getCurrentItem();
  document.querySelectorAll('#sidebar .nav-link').forEach(link => {
    const [itemFile, itemHash] = link.getAttribute('href').split('#');
    const active = itemFile === getCurrentFile() && (itemHash ? window.location.hash === `#${itemHash}` : !window.location.hash);
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const title = document.querySelector('#topbar-root h1');
  const breadcrumb = document.querySelector('#topbar-root nav span:last-child');
  if (title) title.textContent = current.label;
  if (breadcrumb) breadcrumb.textContent = current.label;
}

// 3. Build the sidebar
function renderSidebar() {
  const current = getCurrentFile();

  const permissions = new Set(ADMIN.permissions || []);
  const navHtml = NAV_SECTIONS.map(section => {
    const items = section.items.filter(item => permissions.has(item.permission));
    if (!items.length) return '';
    return `
    <div class="mb-6">
      <p class="section-title px-3 mb-2 text-[11px] font-semibold tracking-widest text-taupe">${section.title}</p>
      <nav class="space-y-1">
        ${items.map(item => {
          const [itemFile, itemHash] = item.file.split('#');
          const active = itemFile === current && (itemHash ? window.location.hash === `#${itemHash}` : !window.location.hash);
          return `
          <a href="${item.file}" class="nav-link ${active ? 'active' : ''}"
             ${active ? 'aria-current="page"' : ''} title="${item.label}">
            <i data-lucide="${item.icon}"></i>
            <span class="label-text">${item.label}</span>
          </a>`;
        }).join('')}
      </nav>
    </div>`;
  }).join('');

  document.getElementById('sidebar-root').innerHTML = `
    <aside class="sidebar" id="sidebar" aria-label="Main navigation">
      <div class="flex items-center justify-between px-5 h-16 border-b border-[#ece8df]">
        <a href="index.html" class="brand-text leading-tight">
          <span class="block font-brand text-lg tracking-wide text-ink">${escapeAdminText(BRAND.name)}</span>
          <span class="block text-[10px] font-semibold tracking-widest text-taupe">${BRAND.tagline}</span>
        </a>
        <button class="icon-btn lg:hidden" id="sidebar-close" aria-label="Close menu"><i data-lucide="x"></i></button>
      </div>

      <div class="flex-1 overflow-y-auto px-3 py-5">${navHtml}</div>

      <div class="border-t border-[#ece8df] p-3">
        <div class="flex items-center gap-3 px-2 py-2">
          <div class="h-10 w-10 shrink-0 rounded-full bg-cream text-ink flex items-center justify-center text-sm font-semibold">
            ${escapeAdminText(ADMIN.name.charAt(0).toUpperCase())}
          </div>
          <div class="label-text min-w-0">
            <p class="truncate text-sm font-semibold text-ink">${escapeAdminText(ADMIN.name)}</p>
            <p class="truncate text-xs text-muted">${escapeAdminText(ADMIN.role)}</p>
          </div>
        </div>
        <a href="login.html" class="nav-link mt-1 admin-logout" title="Logout">
          <i data-lucide="log-out"></i><span class="label-text">Logout</span>
        </a>
      </div>
    </aside>
    <div class="sidebar-backdrop" id="sidebar-backdrop"></div>`;
}

// 4. Build the top bar (page title, breadcrumb, notifications, profile)
function renderTopbar() {
  const page = getCurrentItem();

  document.getElementById('topbar-root').innerHTML = `
    <header class="topbar">
      <div class="flex items-center gap-2 min-w-0">
        <button class="icon-btn" id="sidebar-toggle" aria-label="Toggle menu"><i data-lucide="panel-left"></i></button>
        <div class="min-w-0">
          <h1 class="truncate text-base md:text-lg font-semibold text-ink leading-tight">${page.label}</h1>
          <nav aria-label="Breadcrumb" class="hidden sm:block text-xs text-muted">
            <a href="index.html" class="hover:text-ink">Home</a>
            <span class="mx-1">/</span><span>${page.label}</span>
          </nav>
        </div>
      </div>

      <div class="flex items-center gap-1">
        <div class="relative">
          <button class="icon-btn" id="notif-btn" aria-label="Notifications" aria-expanded="false">
            <i data-lucide="bell"></i>
          </button>
          <div class="dropdown w-80" id="notif-menu">
            <div class="px-4 py-3 border-b border-[#ece8df] text-sm font-semibold text-ink">Notifications</div>
            <div class="px-4 py-8 text-center text-sm text-muted" id="notif-list">No notifications yet.</div>
          </div>
        </div>

        <div class="relative">
          <button class="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-page" id="profile-btn" aria-expanded="false">
            <span class="h-8 w-8 rounded-full bg-cream text-ink flex items-center justify-center text-sm font-semibold">
              ${escapeAdminText(ADMIN.name.charAt(0).toUpperCase())}
            </span>
            <i data-lucide="chevron-down" class="h-4 w-4 text-muted"></i>
          </button>
          <div class="dropdown" id="profile-menu">
            <div class="px-4 py-3 border-b border-[#ece8df]">
              <p class="text-sm font-semibold text-ink">${escapeAdminText(ADMIN.name)}</p>
              <p class="text-xs text-muted">${escapeAdminText(ADMIN.email)}</p>
            </div>
            <a href="settings.html" class="block px-4 py-2.5 text-sm hover:bg-page">Store Settings</a>
            <a href="login.html" class="block px-4 py-2.5 text-sm text-danger hover:bg-page rounded-b-2xl admin-logout">Logout</a>
          </div>
        </div>
      </div>
    </header>`;
}

// 5. Behaviour: collapse sidebar, mobile drawer, dropdowns
function setupInteractions() {
  const body = document.body;
  const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

  // Remember if the desktop sidebar was collapsed
  try {
    if (localStorage.getItem('ce_sidebar_collapsed') === '1') body.classList.add('sidebar-collapsed');
  } catch (e) { /* localStorage may be blocked — ignore */ }

  // The same button collapses on desktop and opens the drawer on mobile
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    if (isDesktop()) {
      body.classList.toggle('sidebar-collapsed');
      try {
        localStorage.setItem('ce_sidebar_collapsed', body.classList.contains('sidebar-collapsed') ? '1' : '0');
      } catch (e) {}
    } else {
      body.classList.add('sidebar-open');
    }
  });

  const closeDrawer = () => body.classList.remove('sidebar-open');
  document.getElementById('sidebar-close').addEventListener('click', closeDrawer);
  document.getElementById('sidebar-backdrop').addEventListener('click', closeDrawer);
  document.querySelectorAll('#sidebar .nav-link').forEach(link => link.addEventListener('click', closeDrawer));
  window.addEventListener('hashchange', syncCurrentNav);

  // Dropdowns: open one at a time, close on outside click or Escape
  const dropdowns = [
    { btn: document.getElementById('notif-btn'),   menu: document.getElementById('notif-menu') },
    { btn: document.getElementById('profile-btn'), menu: document.getElementById('profile-menu') }
  ];

  function closeAll() {
    dropdowns.forEach(d => { d.menu.classList.remove('open'); d.btn.setAttribute('aria-expanded', 'false'); });
  }

  dropdowns.forEach(d => {
    d.btn.addEventListener('click', event => {
      event.stopPropagation();
      const wasOpen = d.menu.classList.contains('open');
      closeAll();
      if (!wasOpen) { d.menu.classList.add('open'); d.btn.setAttribute('aria-expanded', 'true'); }
    });
  });

  document.addEventListener('click', closeAll);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeAll(); closeDrawer(); }
  });
  document.querySelectorAll('.admin-logout').forEach(link => link.addEventListener('click', async event => {
    event.preventDefault();
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    } finally {
      window.location.replace('login.html');
    }
  }));
}

// 6. Start everything when the page loads
document.addEventListener('DOMContentLoaded', async () => {
  let response;
  try {
    response = await fetch('/api/admin/auth/me', { credentials: 'same-origin' });
  } catch (error) {
    console.error('Unable to reach the admin authentication service.', error);
    window.location.replace('login.html');
    return;
  }
  if (!response.ok) {
    window.location.replace('login.html');
    return;
  }
  const session = await response.json();
  ADMIN = {
    name: session.user.name,
    role: session.user.roleLabel,
    email: session.user.email,
    permissions: session.user.permissions
  };
  renderSidebar();
  renderTopbar();
  setupInteractions();
  if (typeof window.renderShoplyDashboard === 'function') window.renderShoplyDashboard();
  if (window.lucide) lucide.createIcons();
});
