'use strict';

require('dotenv').config({ quiet: true });

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const pool = require('./database');
const {
  decryptTotpSecret,
  encryptTotpSecret,
  hashPassword,
  hashToken,
  newSessionToken,
  totpEncryptionKey,
  validateTotpSecret,
  verifyPassword
} = require('./security');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'frontend');
const PORT = Number(process.env.PORT) || 3000;
const SESSION_HOURS = 8;
const LOGIN_WINDOW_MINUTES = 15;
const MAX_LOGIN_FAILURES = 10;
const MAX_IP_LOGIN_FAILURES = 50;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const originSetting = process.env.ALLOWED_ORIGINS;
totpEncryptionKey();
if (process.env.NODE_ENV === 'production' && !originSetting) {
  throw new Error('ALLOWED_ORIGINS must be configured explicitly in production.');
}
const ORIGINS = new Set((originSetting || `http://localhost:${PORT},http://127.0.0.1:${PORT}`)
  .split(',').map(origin => origin.trim()).filter(Boolean));
const DUMMY_PASSWORD_HASH_PROMISE = hashPassword(randomBytes(32).toString('base64url'));
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function json(response, status, value, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  response.end(JSON.stringify(value));
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    const key = part.slice(0, index).trim();
    try {
      return [key, decodeURIComponent(part.slice(index + 1).trim())];
    } catch {
      return [key, ''];
    }
  }).filter(([key]) => key));
}

function sessionCookie(token, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `shoply_admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function clientIp(request) {
  return request.socket.remoteAddress || null;
}

function assertSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin || !ORIGINS.has(origin)) {
    throw new HttpError(403, 'ORIGIN_REJECTED', 'Request origin is not allowed.');
  }
}

async function readJson(request) {
  const contentType = request.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'JSON_REQUIRED', 'Send a JSON request body.');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16 * 1024) throw new HttpError(413, 'BODY_TOO_LARGE', 'Request body is too large.');
    chunks.push(chunk);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected object');
    return parsed;
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Request body must be a JSON object.');
  }
}

async function audit(client, { actorId = null, action, targetType = null, targetId = null, metadata = {}, ip }) {
  await client.query(
    `INSERT INTO admin_audit_logs (actor_id, action, target_type, target_id, metadata, ip_address)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [actorId, action, targetType, targetId, JSON.stringify(metadata), ip || null]
  );
}

async function rejectLogin(emailHash, ip, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO admin_login_attempts (email_hash, ip_address, succeeded) VALUES ($1, $2, false)',
      [emailHash, ip]
    );
    await audit(client, { action: 'admin.login_failed', targetType: 'admin_user', targetId: user ? user.id : null, metadata: { emailHash }, ip });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
}

async function login(request, response) {
  assertSameOrigin(request);
  const body = await readJson(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!EMAIL_PATTERN.test(email) || password.length > 1024) {
    throw new HttpError(400, 'INVALID_CREDENTIALS', 'Enter a valid email and password.');
  }

  const emailHash = hashToken(email);
  const ip = clientIp(request);
  const failures = await pool.query(
    `SELECT count(*) FILTER (WHERE email_hash = $1)::int AS account_count, count(*)::int AS ip_count
     FROM admin_login_attempts
     WHERE ip_address IS NOT DISTINCT FROM $2::inet
       AND succeeded = false AND attempted_at > now() - ($3 * interval '1 minute')`,
    [emailHash, ip, LOGIN_WINDOW_MINUTES]
  );
  if (failures.rows[0].account_count >= MAX_LOGIN_FAILURES || failures.rows[0].ip_count >= MAX_IP_LOGIN_FAILURES) {
    throw new HttpError(429, 'LOGIN_RATE_LIMITED', 'Too many sign-in attempts. Try again later.');
  }

  const result = await pool.query(
    `SELECT u.id, u.email, u.display_name, u.password_hash, u.role_id, r.label AS role_label, u.active
     FROM admin_users u JOIN admin_roles r ON r.id = u.role_id
     WHERE u.email = $1`,
    [email]
  );
  const user = result.rows[0];
  const passwordOk = await verifyPassword(password, user ? user.password_hash : await DUMMY_PASSWORD_HASH_PROMISE);
  if (!user || !user.active || !passwordOk) {
    return rejectLogin(emailHash, ip, user);
  }

  const token = newSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO admin_sessions (user_id, token_hash, expires_at, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
      [user.id, tokenHash, expiresAt, ip, String(request.headers['user-agent'] || '').slice(0, 512)]
    );
    await client.query('UPDATE admin_users SET last_login_at = now() WHERE id = $1', [user.id]);
    await client.query(
      'INSERT INTO admin_login_attempts (email_hash, ip_address, succeeded) VALUES ($1, $2, true)',
      [emailHash, ip]
    );
    await audit(client, { actorId: user.id, action: 'admin.login_succeeded', targetType: 'admin_user', targetId: user.id, ip });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  json(response, 200, { ok: true }, { 'Set-Cookie': sessionCookie(token, SESSION_HOURS * 60 * 60) });
}

async function authenticate(request) {
  const token = parseCookies(request.headers.cookie).shoply_admin_session;
  if (!token || token.length > 128) throw new HttpError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
  const result = await pool.query(
    `SELECT u.id, u.email, u.display_name, u.role_id, r.label AS role_label,
            s.expires_at,
            COALESCE(array_agg(rp.permission_id) FILTER (WHERE rp.permission_id IS NOT NULL), '{}') AS permissions
     FROM admin_sessions s
     JOIN admin_users u ON u.id = s.user_id
     JOIN admin_roles r ON r.id = u.role_id
     LEFT JOIN admin_role_permissions rp ON rp.role_id = u.role_id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.active
     GROUP BY u.id, r.label, s.expires_at`,
    [hashToken(token)]
  );
  const user = result.rows[0];
  if (!user) throw new HttpError(401, 'AUTH_REQUIRED', 'Your admin session has expired. Sign in again.');
  return { ...user, tokenHash: hashToken(token) };
}

function requirePermission(user, permission) {
  if (!user.permissions.includes(permission)) throw new HttpError(403, 'PERMISSION_DENIED', 'You do not have permission to perform this action.');
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.display_name,
    role: user.role_id,
    roleLabel: user.role_label,
    permissions: user.permissions,
    expiresAt: user.expires_at
  };
}

async function logout(request, response, user) {
  assertSameOrigin(request);
  await pool.query('UPDATE admin_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [user.tokenHash]);
  await pool.query(
    `INSERT INTO admin_audit_logs (actor_id, action, target_type, target_id, ip_address)
     VALUES ($1, 'admin.logout', 'admin_user', $1, $2)`,
    [user.id, clientIp(request)]
  );
  json(response, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
}

async function listUsers(user) {
  requirePermission(user, 'admins.view');
  const result = await pool.query(
    `SELECT u.id, u.email, u.display_name, u.role_id, r.label AS role_label, u.active, u.created_at, u.last_login_at
     FROM admin_users u JOIN admin_roles r ON r.id = u.role_id
     ORDER BY u.created_at DESC LIMIT 200`
  );
  return result.rows.map(row => ({
    id: row.id, email: row.email, name: row.display_name, role: row.role_id,
    roleLabel: row.role_label, active: row.active, createdAt: row.created_at, lastLoginAt: row.last_login_at
  }));
}

async function createUser(request, user) {
  requirePermission(user, 'admins.create');
  if (user.role_id !== 'super_admin') throw new HttpError(403, 'PERMISSION_DENIED', 'Only a Super Admin can create administrators.');
  const body = await readJson(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const totpSecret = typeof body.totpSecret === 'string' ? body.totpSecret.trim().toUpperCase() : '';
  const role = typeof body.role === 'string' ? body.role : '';
  if (!EMAIL_PATTERN.test(email) || name.length < 1 || name.length > 120 || !validateTotpSecret(totpSecret)) {
    throw new HttpError(400, 'INVALID_ADMIN', 'Provide a valid email, name, and base32 authenticator secret.');
  }
  if (password.length < 12 || password.length > 1024) {
    throw new HttpError(400, 'INVALID_PASSWORD', 'Password must be between 12 and 1024 characters.');
  }
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO admin_users (email, display_name, password_hash, totp_secret, role_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, display_name, role_id, active, created_at`,
      [email, name, passwordHash, encryptTotpSecret(totpSecret), role]
    );
    await audit(client, { actorId: user.id, action: 'admin.user_created', targetType: 'admin_user', targetId: inserted.rows[0].id, metadata: { role }, ip: clientIp(request) });
    await client.query('COMMIT');
    return inserted.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new HttpError(409, 'EMAIL_EXISTS', 'An administrator with this email already exists.');
    if (error.code === '23503') throw new HttpError(400, 'INVALID_ROLE', 'The selected role does not exist.');
    throw error;
  } finally {
    client.release();
  }
}

async function updateUser(request, user, id) {
  requirePermission(user, 'admins.update');
  if (user.role_id !== 'super_admin') throw new HttpError(403, 'PERMISSION_DENIED', 'Only a Super Admin can change administrator access.');
  const body = await readJson(request);
  if (id === user.id && (body.active === false || (body.role && body.role !== 'super_admin'))) {
    throw new HttpError(400, 'SELF_LOCKOUT', 'You cannot deactivate or demote your own account.');
  }
  if (body.role !== undefined && (typeof body.role !== 'string' || !/^(super_admin|admin|manager|product_manager|order_manager|customer_support|marketing_manager|inventory_manager|finance_manager)$/.test(body.role))) {
    throw new HttpError(400, 'INVALID_ROLE', 'Choose a supported administrator role.');
  }
  if (body.active !== undefined && typeof body.active !== 'boolean') {
    throw new HttpError(400, 'INVALID_STATUS', 'The active field must be true or false.');
  }
  if (body.role === undefined && body.active === undefined) throw new HttpError(400, 'EMPTY_UPDATE', 'Provide a role or active status to update.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const target = await client.query('SELECT id, role_id, active FROM admin_users WHERE id = $1 FOR UPDATE', [id]);
    if (!target.rowCount) throw new HttpError(404, 'ADMIN_NOT_FOUND', 'Administrator was not found.');
    const current = target.rows[0];
    const nextRole = body.role || current.role_id;
    const nextActive = body.active === undefined ? current.active : body.active;
    if (current.role_id === 'super_admin' && (nextRole !== 'super_admin' || !nextActive)) {
      const admins = await client.query(`SELECT id FROM admin_users WHERE role_id = 'super_admin' AND active ORDER BY id FOR UPDATE`);
      if (admins.rowCount <= 1) throw new HttpError(409, 'LAST_SUPER_ADMIN', 'The last active Super Admin cannot be demoted or deactivated.');
    }
    const updated = await client.query(
      `UPDATE admin_users SET role_id = $1, active = $2, updated_at = now()
       WHERE id = $3
       RETURNING id, email, display_name, role_id, active, created_at, last_login_at`,
      [nextRole, nextActive, id]
    );
    if (!nextActive) await client.query('UPDATE admin_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
    await audit(client, { actorId: user.id, action: 'admin.user_updated', targetType: 'admin_user', targetId: id, metadata: { role: nextRole, active: nextActive }, ip: clientIp(request) });
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23503') throw new HttpError(400, 'INVALID_ROLE', 'The selected role does not exist.');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteUser(request, user, id) {
  requirePermission(user, 'admins.delete');
  if (user.role_id !== 'super_admin') throw new HttpError(403, 'PERMISSION_DENIED', 'Only a Super Admin can delete administrators.');
  if (id === user.id) throw new HttpError(400, 'SELF_DELETE', 'You cannot delete your own account.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const target = await client.query('SELECT id, role_id, active FROM admin_users WHERE id = $1 FOR UPDATE', [id]);
    if (!target.rowCount) throw new HttpError(404, 'ADMIN_NOT_FOUND', 'Administrator was not found.');
    if (target.rows[0].role_id === 'super_admin' && target.rows[0].active) {
      const admins = await client.query(`SELECT id FROM admin_users WHERE role_id = 'super_admin' AND active ORDER BY id FOR UPDATE`);
      if (admins.rowCount <= 1) throw new HttpError(409, 'LAST_SUPER_ADMIN', 'The last active Super Admin cannot be deleted.');
    }
    await audit(client, { actorId: user.id, action: 'admin.user_deleted', targetType: 'admin_user', targetId: id, ip: clientIp(request) });
    await client.query('DELETE FROM admin_users WHERE id = $1', [id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateRolePermissions(request, user, roleId) {
  requirePermission(user, 'admins.update');
  if (user.role_id !== 'super_admin') throw new HttpError(403, 'PERMISSION_DENIED', 'Only a Super Admin can change role permissions.');
  if (!/^(admin|manager|product_manager|order_manager|customer_support|marketing_manager|inventory_manager|finance_manager)$/.test(roleId)) {
    throw new HttpError(400, 'INVALID_ROLE', 'The Super Admin role permissions cannot be changed here.');
  }
  const body = await readJson(request);
  if (!Array.isArray(body.permissions) || body.permissions.length > 100 ||
      body.permissions.some(permission => typeof permission !== 'string')) {
    throw new HttpError(400, 'INVALID_PERMISSIONS', 'Provide a list of permission identifiers.');
  }
  const permissions = [...new Set(body.permissions)];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const role = await client.query('SELECT id FROM admin_roles WHERE id = $1 FOR UPDATE', [roleId]);
    if (!role.rowCount) throw new HttpError(404, 'ROLE_NOT_FOUND', 'Administrator role was not found.');
    const known = await client.query('SELECT id FROM admin_permissions WHERE id = ANY($1::text[])', [permissions]);
    if (known.rowCount !== permissions.length) throw new HttpError(400, 'UNKNOWN_PERMISSION', 'One or more permissions are not recognized.');
    await client.query('DELETE FROM admin_role_permissions WHERE role_id = $1', [roleId]);
    for (const permission of permissions) {
      await client.query('INSERT INTO admin_role_permissions (role_id, permission_id) VALUES ($1, $2)', [roleId, permission]);
    }
    await audit(client, { actorId: user.id, action: 'admin.role_permissions_updated', targetType: 'admin_role', targetId: roleId, metadata: { permissions }, ip: clientIp(request) });
    await client.query('COMMIT');
    return permissions;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


function productDto(row) {
  return { id: row.id, name: row.name, sku: row.sku, category: row.category_name,
    price: Number(row.price), discountPrice: row.discount_price == null ? null : Number(row.discount_price),
    image: row.image_url, desc: row.description, stock: row.stock, status: row.status,
    featured: row.featured, sizes: row.sizes || [], colors: row.colors || [], updatedAt: row.updated_at };
}

async function seedCatalogIfEmpty() {
  const count = await pool.query('SELECT count(*)::int AS count FROM shop_products');
  if (count.rows[0].count) return;
  const vm = require('node:vm');
  const source = await fs.readFile(path.join(PUBLIC, 'products.js'), 'utf8');
  const sandbox = {};
  const seed = vm.runInNewContext(`${source}\nproducts`, sandbox, { timeout: 1000 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of seed) {
      await client.query(
        `INSERT INTO shop_products (id,name,sku,category_name,description,price,image_url,stock,status,featured)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9) ON CONFLICT (id) DO NOTHING`,
        [String(p.id), p.name, `CE-${String(p.id).padStart(4,'0')}`, p.category || 'general',
          p.desc || '', Number(p.price) || 0, p.image || '', 10, Number(p.id) <= 4]
      );
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function listProducts(includeHidden = false) {
  await seedCatalogIfEmpty();
  const result = await pool.query(
    `SELECT * FROM shop_products ${includeHidden ? '' : "WHERE status = 'active' AND stock >= 0"} ORDER BY featured DESC, created_at DESC`
  );
  return result.rows.map(productDto);
}

async function saveProduct(request, user, id = null) {
  requirePermission(user, id ? 'products.update' : 'products.create');
  const b = await readJson(request);
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const price = Number(b.price), stock = Number(b.stock);
  const status = ['active','draft','archived'].includes(b.status) ? b.status : 'active';
  if (!name || name.length > 180 || !Number.isFinite(price) || price < 0 ||
      !Number.isInteger(stock) || stock < 0) throw new HttpError(400,'INVALID_PRODUCT','Name, non-negative price, and whole-number stock are required.');
  const discount = b.discountPrice == null || b.discountPrice === '' ? null : Number(b.discountPrice);
  if (discount != null && (!Number.isFinite(discount) || discount < 0 || discount > price)) throw new HttpError(400,'INVALID_DISCOUNT','Discount must be between zero and the regular price.');
  const values = [name, String(b.sku || '').trim() || null, String(b.category || 'general').trim(),
    String(b.desc || '').trim(), price, discount, String(b.image || '').trim(), stock, status,
    Boolean(b.featured), JSON.stringify(Array.isArray(b.sizes) ? b.sizes : []), JSON.stringify(Array.isArray(b.colors) ? b.colors : [])];
  let result;
  if (id) {
    requirePermission(user,'products.update');
    result = await pool.query(
      `UPDATE shop_products SET name=$1,sku=$2,category_name=$3,description=$4,price=$5,discount_price=$6,image_url=$7,stock=$8,status=$9,featured=$10,sizes=$11::jsonb,colors=$12::jsonb,updated_at=now()
       WHERE id=$13 RETURNING *`, [...values,id]);
  } else {
    requirePermission(user,'products.create');
    const newId = b.id != null && /^[a-zA-Z0-9_-]{1,64}$/.test(String(b.id)) ? String(b.id) : `p-${randomBytes(8).toString('hex')}`;
    result = await pool.query(
      `INSERT INTO shop_products (id,name,sku,category_name,description,price,discount_price,image_url,stock,status,featured,sizes,colors)
       VALUES ($13,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb) RETURNING *`, [...values,newId]);
  }
  if (!result.rowCount) throw new HttpError(404,'PRODUCT_NOT_FOUND','Product not found.');
  return productDto(result.rows[0]);
}

async function createOrder(request) {
  const b = await readJson(request);
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length || items.length > 50) throw new HttpError(400,'INVALID_ORDER','An order must contain 1 to 50 items.');
  const name = String(b.customerName || b.name || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const phone = String(b.phone || '').trim();
  const address = String(b.address || b.deliveryAddress || '').trim();
  if (!name || name.length > 120 || !EMAIL_PATTERN.test(email) || !address || address.length > 500) {
    throw new HttpError(400,'INVALID_CUSTOMER','Name, valid email, and delivery address are required.');
  }
  const paymentMethod = ['KHQR','ABA Mobile','Cash on Delivery'].includes(b.paymentMethod) ? b.paymentMethod : 'Cash on Delivery';
  const client = await pool.connect();
  const orderId = `CE-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  try {
    await client.query('BEGIN');
    let subtotal = 0;
    const orderItems = [];
    for (const item of items) {
      const productId = String(item.id ?? '');
      const qty = Number(item.qty);
      if (!productId || !Number.isInteger(qty) || qty < 1 || qty > 99) throw new HttpError(400,'INVALID_ITEM','Each item needs a valid product and quantity.');
      const found = await client.query('SELECT * FROM shop_products WHERE id=$1 AND status=$2 FOR UPDATE',[productId,'active']);
      if (!found.rowCount) throw new HttpError(409,'PRODUCT_UNAVAILABLE',`Product ${productId} is no longer available.`);
      const p = found.rows[0];
      if (p.stock < qty) throw new HttpError(409,'INSUFFICIENT_STOCK',`${p.name} has only ${p.stock} left.`);
      const price = Number(p.discount_price ?? p.price);
      subtotal += price * qty;
      orderItems.push({p,qty,price});
    }
    const deliveryFee = 0;
    const total = subtotal + deliveryFee;
    await client.query(
      `INSERT INTO shop_orders (id,customer_name,email,phone,delivery_address,delivery_date,delivery_time,recipient,gift_message,subtotal,delivery_fee,total,currency,payment_method,payment_status,status,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'USD',$13,'pending','pending',$14)`,
      [orderId,name,email,phone,address,b.deliveryDate || null,b.deliveryTime || '',String(b.recipient || name),
       String(b.message || ''),subtotal,deliveryFee,total,paymentMethod,String(b.paymentReference || '')]);
    for (const item of orderItems) {
      await client.query(
        `INSERT INTO shop_order_items (order_id,product_id,product_name,sku,image_url,unit_price,quantity,line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [orderId,item.p.id,item.p.name,item.p.sku || '',item.p.image_url,item.price,item.qty,item.price*item.qty]);
      await client.query('UPDATE shop_products SET stock=stock-$2,updated_at=now() WHERE id=$1',[item.p.id,item.qty]);
      await client.query(
        `INSERT INTO shop_inventory_movements (product_id,quantity_change,reason,reference_type,reference_id)
         VALUES ($1,$2,'Order placed','order',$3)`,[item.p.id,-item.qty,orderId]);
    }
    await client.query('COMMIT');
    return { id:orderId, customerName:name,email,phone,address,items:orderItems.map(({p,qty,price})=>({id:p.id,name:p.name,price,qty,image:p.image_url})),
      subtotal,deliveryFee,total,paymentMethod,paymentStatus:'Awaiting merchant verification',status:'pending',createdAt:new Date().toISOString() };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function listOrders(user) {
  requirePermission(user,'orders.view');
  const result = await pool.query(
    `SELECT o.*, COALESCE(json_agg(json_build_object('id',i.product_id,'name',i.product_name,'price',i.unit_price,'qty',i.quantity,'image',i.image_url)) FILTER (WHERE i.id IS NOT NULL),'[]') AS items
     FROM shop_orders o LEFT JOIN shop_order_items i ON i.order_id=o.id GROUP BY o.id ORDER BY o.created_at DESC LIMIT 500`);
  return result.rows.map(o=>({id:o.id,customerName:o.customer_name,email:o.email,phone:o.phone,address:o.delivery_address,
    date:o.delivery_date,time:o.delivery_time,recipient:o.recipient,message:o.gift_message,items:o.items,
    subtotal:Number(o.subtotal),deliveryFee:Number(o.delivery_fee),total:Number(o.total),paymentMethod:o.payment_method,
    paymentStatus:o.payment_status,status:o.status,createdAt:o.created_at}));
}

async function updateOrderStatus(request,user,id) {
  requirePermission(user,'orders.update');
  const b=await readJson(request);
  const allowed=['pending','confirmed','processing','out_for_delivery','completed','cancelled'];
  if(!allowed.includes(b.status)) throw new HttpError(400,'INVALID_STATUS','Invalid order status.');
  const result=await pool.query('UPDATE shop_orders SET status=$1,updated_at=now() WHERE id=$2 RETURNING id,status',[b.status,id]);
  if(!result.rowCount) throw new HttpError(404,'ORDER_NOT_FOUND','Order not found.');
  return result.rows[0];
}


async function serveStatic(request, response, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, 'INVALID_PATH', 'Invalid URL path.');
  }
  if (decoded.includes('\0') || decoded.includes('\\')) throw new HttpError(400, 'INVALID_PATH', 'Invalid URL path.');
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const file = path.resolve(PUBLIC, relative);
  if (file !== PUBLIC && !file.startsWith(`${PUBLIC}${path.sep}`)) throw new HttpError(404, 'NOT_FOUND', 'Page not found.');
  const isAdminPage = /^admin(?:\/|$)/.test(relative) && /\.html$/i.test(relative) && !/^(?:admin\/)?login\.html$/i.test(relative);
  if (isAdminPage) {
    try {
      const user = await authenticate(request);
      const pagePermissions = {
        'admin/index.html': 'dashboard.view',
        'admin/products.html': 'products.view',
        'admin/orders.html': 'orders.view',
        'admin/inventory.html': 'inventory.manage',
        'admin/customers.html': 'customers.view',
        'admin/categories.html': 'categories.manage',
        'admin/promotions.html': 'promotions.manage',
        'admin/analytics.html': 'analytics.view',
        'admin/settings.html': 'settings.view',
        'admin/team.html': 'admins.view'
      };
      const permission = pagePermissions[relative.toLowerCase()];
      if (permission) requirePermission(user, permission);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        response.writeHead(302, { Location: '/admin/login.html', 'Cache-Control': 'no-store' });
        response.end();
        return;
      }
      if (error instanceof HttpError && error.status === 403) {
        response.writeHead(302, { Location: '/admin/index.html', 'Cache-Control': 'no-store' });
        response.end();
        return;
      }
      throw error;
    }
  }
  let content;
  try {
    content = await fs.readFile(file);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') throw new HttpError(404, 'NOT_FOUND', 'Page not found.');
    throw error;
  }
  const extension = path.extname(file).toLowerCase();
  response.writeHead(200, {
    'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
    'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(content);
}

async function handle(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const method = request.method || 'GET';
  try {
    if (url.pathname === '/health' && method === 'GET') {
      await pool.query('SELECT 1');
      return json(response, 200, { ok: true });
    }
    if (url.pathname === '/api/products' && method === 'GET') {
      return json(response,200,{products:await listProducts(false)});
    }
    if (url.pathname === '/api/orders' && method === 'POST') {
      return json(response,201,{order:await createOrder(request)});
    }

    if (url.pathname === '/api/admin/auth/login' && method === 'POST') return await login(request, response);

    if (url.pathname.startsWith('/api/')) {
      let user = null;
      if (!(url.pathname === '/api/admin/auth/me' && method === 'GET')) user = await authenticate(request);
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) assertSameOrigin(request);

      if (url.pathname === '/api/admin/auth/me' && method === 'GET') {
        user = await authenticate(request);
        return json(response, 200, { user: publicUser(user) });
      }
      if (url.pathname === '/api/admin/auth/logout' && method === 'POST') return await logout(request, response, user);
      if (url.pathname === '/api/admin/roles' && method === 'GET') {
        requirePermission(user, 'admins.view');
        const roles = await pool.query(
          `SELECT r.id, r.label, COALESCE(array_agg(rp.permission_id) FILTER (WHERE rp.permission_id IS NOT NULL), '{}') AS permissions
           FROM admin_roles r LEFT JOIN admin_role_permissions rp ON rp.role_id = r.id
           GROUP BY r.id ORDER BY r.label`
        );
        return json(response, 200, { roles: roles.rows });
      }
      if (url.pathname === '/api/admin/users' && method === 'GET') return json(response, 200, { users: await listUsers(user) });
      if (url.pathname === '/api/admin/users' && method === 'POST') return json(response, 201, { user: await createUser(request, user) });
      const userMatch = url.pathname.match(/^\/api\/admin\/users\/([0-9a-f-]{36})$/i);
      if (userMatch && method === 'PATCH') return json(response, 200, { user: await updateUser(request, user, userMatch[1]) });
      if (userMatch && method === 'DELETE') {
        await deleteUser(request, user, userMatch[1]);
        return json(response, 200, { ok: true });
      }
      const roleMatch = url.pathname.match(/^\/api\/admin\/roles\/([a-z_]+)\/permissions$/);
      if (roleMatch && method === 'PUT') {
        return json(response, 200, { permissions: await updateRolePermissions(request, user, roleMatch[1]) });
      }
      if (url.pathname === '/api/admin/products' && method === 'GET') {
        requirePermission(user,'products.view');
        return json(response,200,{products:await listProducts(true)});
      }
      if (url.pathname === '/api/admin/products' && method === 'POST') {
        return json(response,201,{product:await saveProduct(request,user)});
      }
      const productMatch=url.pathname.match(/^\/api\/admin\/products\/([a-zA-Z0-9_-]+)$/);
      if (productMatch && method === 'PUT') return json(response,200,{product:await saveProduct(request,user,productMatch[1])});
      if (productMatch && method === 'DELETE') {
        requirePermission(user,'products.delete');
        const deleted=await pool.query('DELETE FROM shop_products WHERE id=$1 RETURNING id',[productMatch[1]]);
        if(!deleted.rowCount) throw new HttpError(404,'PRODUCT_NOT_FOUND','Product not found.');
        return json(response,200,{ok:true});
      }
      if (url.pathname === '/api/admin/orders' && method === 'GET') return json(response,200,{orders:await listOrders(user)});
      const orderMatch=url.pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
      if (orderMatch && method === 'PATCH') return json(response,200,{order:await updateOrderStatus(request,user,decodeURIComponent(orderMatch[1]))});
      if (url.pathname === '/api/admin/audit-logs' && method === 'GET') {
        requirePermission(user, 'audit.view');
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));
        const logs = await pool.query(
          `SELECT l.id, l.action, l.target_type, l.target_id, l.metadata, l.ip_address, l.created_at,
                  u.email AS actor_email, u.display_name AS actor_name
           FROM admin_audit_logs l LEFT JOIN admin_users u ON u.id = l.actor_id
           ORDER BY l.created_at DESC LIMIT $1`,
          [limit]
        );
        return json(response, 200, { logs: logs.rows });
      }
      throw new HttpError(404, 'NOT_FOUND', 'API endpoint not found.');
    }

    if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    return await serveStatic(request, response, url.pathname);
  } catch (error) {
    if (error instanceof HttpError) return json(response, error.status, { error: { code: error.code, message: error.message } });
    console.error('Request failed.', error);
    return json(response, 500, { error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } });
  }
}

const server = http.createServer((request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'same-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  handle(request, response).catch(error => {
    console.error('Unhandled request failure.', error);
    if (!response.headersSent) json(response, 500, { error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } });
    else response.destroy();
  });
  server.requestTimeout = 15000;
});

server.listen(PORT, () => {
  console.log(`Shoply admin server listening on port ${PORT}.`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
