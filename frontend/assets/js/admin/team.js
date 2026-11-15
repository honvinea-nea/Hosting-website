/**
 * Administrator accounts, role grants, and audit history backed by the admin API.
 */
(function () {
  const root = document.getElementById('team-root');
  const ROLE_LABELS = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    manager: 'Manager',
    product_manager: 'Product Manager',
    order_manager: 'Order Manager',
    customer_support: 'Customer Support',
    marketing_manager: 'Marketing Manager',
    inventory_manager: 'Inventory Manager',
    finance_manager: 'Finance Manager'
  };
  const PERMISSION_LABELS = {
    'dashboard.view': 'View dashboard',
    'products.view': 'View products',
    'products.create': 'Create products',
    'products.update': 'Edit products',
    'products.delete': 'Delete products',
    'products.publish': 'Publish products',
    'orders.view': 'View orders',
    'orders.update': 'Update orders',
    'orders.refund': 'Process refunds',
    'customers.view': 'View customer records',
    'customers.update': 'Edit customer records',
    'categories.manage': 'Manage categories',
    'promotions.manage': 'Manage promotions',
    'content.manage': 'Publish site content',
    'inventory.manage': 'Manage inventory',
    'analytics.view': 'View analytics',
    'settings.view': 'View settings',
    'settings.update': 'Change settings',
    'payments.manage': 'Manage payment methods',
    'admins.view': 'View administrator accounts',
    'admins.create': 'Create administrator accounts',
    'admins.update': 'Edit roles and access',
    'admins.delete': 'Delete administrator accounts',
    'audit.view': 'View audit history'
  };
  let roles = [];
  let canManage = false;
  let canDelete = false;
  let canAudit = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function dateTime(value) {
    if (!value) return 'Never';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
    });
    const result = response.status === 204 ? {} : await response.json();
    if (!response.ok) throw new Error(result.error?.message || `Request failed (${response.status}).`);
    return result;
  }

  function renderUsers(users) {
    return users.length ? `<div class="table-scroll"><table class="team-table">
      <thead><tr><th>Administrator</th><th>Role</th><th>Status</th><th>Last sign in</th><th>Actions</th></tr></thead>
      <tbody>${users.map(user => `<tr data-user-id="${escapeHtml(user.id)}">
        <td><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.email)}</span></td>
        <td><select class="team-role" aria-label="Role for ${escapeHtml(user.name)}" ${canManage ? '' : 'disabled'}>
          ${roles.map(role => `<option value="${escapeHtml(role.id)}" ${role.id === user.role ? 'selected' : ''}>${escapeHtml(role.label)}</option>`).join('')}
        </select></td>
        <td><label class="team-active"><input type="checkbox" class="team-status" ${user.active ? 'checked' : ''} ${canManage ? '' : 'disabled'}><span>${user.active ? 'Active' : 'Suspended'}</span></label></td>
        <td>${escapeHtml(dateTime(user.lastLoginAt))}</td>
        <td><div class="team-actions">
          ${canManage ? '<button type="button" class="team-save">Save</button>' : ''}
          ${canDelete ? '<button type="button" class="team-delete">Delete</button>' : ''}
        </div></td>
      </tr>`).join('')}</tbody></table></div>` : '<p class="team-empty">No administrator accounts found.</p>';
  }

  function renderPermissions(role) {
    return `<div class="permission-grid">${Object.entries(PERMISSION_LABELS).map(([id, label]) => `
      <label><input type="checkbox" value="${escapeHtml(id)}" ${role.permissions.includes(id) ? 'checked' : ''}> <span>${escapeHtml(label)}</span></label>`).join('')}
    </div>`;
  }

  function renderAudit(logs) {
    if (!canAudit) return '<p class="team-empty">You do not have permission to view audit history.</p>';
    if (!logs.length) return '<p class="team-empty">No administrator activity has been recorded yet.</p>';
    return `<div class="audit-list">${logs.map(log => `<article class="audit-row">
      <span class="audit-marker"></span>
      <div><strong>${escapeHtml(log.action.replace(/^admin\./, '').replaceAll('_', ' '))}</strong>
        <p>${escapeHtml(log.actor_name || 'System')} · ${escapeHtml(log.actor_email || 'account removed')}</p>
        <small>${escapeHtml(dateTime(log.created_at))}${log.target_type ? ` · ${escapeHtml(log.target_type)} ${escapeHtml(log.target_id || '')}` : ''}</small>
      </div>
    </article>`).join('')}</div>`;
  }

  function render(users, logs) {
    const editableRoles = roles.filter(role => role.id !== 'super_admin');
    root.innerHTML = `<div class="team-page">
      <div class="team-notice"><i data-lucide="shield-check"></i><div><strong>Protected administrator access</strong><span>Changes are authorized by server-side role checks and recorded in the audit history.</span></div></div>
      <section class="team-card">
        <div class="team-heading"><div><p class="team-eyebrow">PEOPLE &amp; PERMISSIONS</p><h2>Administrator accounts</h2><p>Create staff access, update roles, and suspend accounts. TOTP secrets are encrypted before storage.</p></div><span class="team-count">${users.length} accounts</span></div>
        ${renderUsers(users)}
      </section>
      ${canManage ? `<section class="team-card">
        <div class="team-heading"><div><p class="team-eyebrow">INVITE A TEAMMATE</p><h2>Create administrator</h2><p>Set a unique password and configure the authenticator secret with the new administrator before sharing access.</p></div></div>
        <form id="create-admin-form" class="team-form">
          <label>Full name<input name="name" maxlength="120" required autocomplete="off"></label>
          <label>Email address<input name="email" type="email" maxlength="254" required autocomplete="off"></label>
          <label>Temporary password<input name="password" type="password" minlength="12" maxlength="1024" required autocomplete="new-password"><small>At least 12 characters. Share it through a secure channel.</small></label>
          <label>Role<select name="role" required>${editableRoles.map(role => `<option value="${escapeHtml(role.id)}">${escapeHtml(role.label)}</option>`).join('')}</select></label>
          <label class="team-field-wide">Authenticator secret<input name="totpSecret" minlength="16" maxlength="64" pattern="[A-Za-z2-7]{16,64}" required autocomplete="off" placeholder="Base32 secret from the authenticator setup"><small>This secret is encrypted at rest; do not send it over an untrusted connection.</small></label>
          <div class="team-field-wide team-form-actions"><p id="team-status" role="status" aria-live="polite"></p><button class="team-primary" type="submit">Create account</button></div>
        </form>
      </section>` : ''}
      ${canManage ? `<section class="team-card">
        <div class="team-heading"><div><p class="team-eyebrow">ROLE-BASED ACCESS CONTROL</p><h2>Role permissions</h2><p>Permission changes apply immediately to every account assigned to that role. Super Admin grants are fixed.</p></div></div>
        <div class="role-editor">
          <label class="role-select-label">Choose a role<select id="permission-role">${editableRoles.map(role => `<option value="${escapeHtml(role.id)}">${escapeHtml(role.label)}</option>`).join('')}</select></label>
          <div id="permission-options"></div>
          <div class="team-form-actions"><p id="permission-status" role="status" aria-live="polite"></p><button id="save-permissions" class="team-primary" type="button">Save permissions</button></div>
        </div>
      </section>` : ''}
      <section class="team-card">
        <div class="team-heading"><div><p class="team-eyebrow">SECURITY TRAIL</p><h2>Activity log</h2><p>Recent administrator sign-ins and access changes.</p></div></div>
        ${renderAudit(logs)}
      </section>
    </div>`;

    root.querySelectorAll('.team-save').forEach(button => button.addEventListener('click', async () => {
      const row = button.closest('[data-user-id]');
      button.disabled = true;
      try {
        const result = await api(`/api/admin/users/${encodeURIComponent(row.dataset.userId)}`, {
          method: 'PATCH',
          body: JSON.stringify({ role: row.querySelector('.team-role').value, active: row.querySelector('.team-status').checked })
        });
        await refresh(result.user.active ? 'Administrator access updated.' : 'Account suspended and sessions revoked.');
      } catch (error) {
        showMessage(error.message, true);
        button.disabled = false;
      }
    }));

    root.querySelectorAll('.team-delete').forEach(button => button.addEventListener('click', async () => {
      const row = button.closest('[data-user-id]');
      const email = row.querySelector('td strong').nextElementSibling.textContent;
      if (!window.confirm(`Permanently delete administrator ${email}? This cannot be undone.`)) return;
      button.disabled = true;
      try {
        await api(`/api/admin/users/${encodeURIComponent(row.dataset.userId)}`, { method: 'DELETE', body: '{}' });
        await refresh('Administrator deleted.');
      } catch (error) {
        showMessage(error.message, true);
        button.disabled = false;
      }
    }));

    const createForm = root.querySelector('#create-admin-form');
    if (createForm) createForm.addEventListener('submit', async event => {
      event.preventDefault();
      const button = createForm.querySelector('button[type="submit"]');
      button.disabled = true;
      const formData = new FormData(createForm);
      try {
        await api('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify(Object.fromEntries(formData.entries()))
        });
        createForm.reset();
        await refresh('Administrator account created.');
      } catch (error) {
        showMessage(error.message, true);
      } finally {
        button.disabled = false;
      }
    });

    const roleSelect = root.querySelector('#permission-role');
    const permissionsRoot = root.querySelector('#permission-options');
    if (roleSelect && permissionsRoot) {
      const paintPermissions = () => {
        const role = roles.find(item => item.id === roleSelect.value);
        permissionsRoot.innerHTML = role ? renderPermissions(role) : '';
      };
      roleSelect.addEventListener('change', paintPermissions);
      paintPermissions();
      root.querySelector('#save-permissions').addEventListener('click', async event => {
        const button = event.currentTarget;
        const status = root.querySelector('#permission-status');
        button.disabled = true;
        const permissions = Array.from(permissionsRoot.querySelectorAll('input:checked')).map(input => input.value);
        try {
          await api(`/api/admin/roles/${encodeURIComponent(roleSelect.value)}/permissions`, {
            method: 'PUT',
            body: JSON.stringify({ permissions })
          });
          status.textContent = 'Permissions saved and active.';
          await refresh();
        } catch (error) {
          status.textContent = error.message;
        } finally {
          button.disabled = false;
        }
      });
    }

    if (window.lucide) lucide.createIcons();
  }

  function showMessage(message, isError = false) {
    const status = root.querySelector('#team-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('team-error', isError);
  }

  async function refresh(message = '') {
    const [userResult, logResult] = await Promise.all([
      api('/api/admin/users'),
      canAudit ? api('/api/admin/audit-logs?limit=50') : Promise.resolve({ logs: [] })
    ]);
    render(userResult.users, logResult.logs);
    if (message) showMessage(message);
  }

  async function init() {
    try {
      const [session, roleResult] = await Promise.all([
        api('/api/admin/auth/me'),
        api('/api/admin/roles')
      ]);
      const permissions = new Set(session.user.permissions);
      canManage = permissions.has('admins.update') && permissions.has('admins.create');
      canDelete = permissions.has('admins.delete');
      canAudit = permissions.has('audit.view');
      roles = roleResult.roles;
      await refresh();
    } catch (error) {
      root.innerHTML = `<p class="team-error-message" role="alert">${escapeHtml(error.message)}</p>`;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
