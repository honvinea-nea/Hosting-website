CREATE TABLE IF NOT EXISTS admin_roles (
  id text PRIMARY KEY,
  label text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_permissions (
  id text PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_id text NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  permission_id text NOT NULL REFERENCES admin_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  totp_secret text NOT NULL,
  role_id text NOT NULL REFERENCES admin_roles(id),
  active boolean NOT NULL DEFAULT true,
  totp_last_counter bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip_address inet,
  user_agent text
);
CREATE INDEX IF NOT EXISTS admin_sessions_active_user_idx ON admin_sessions(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id bigserial PRIMARY KEY,
  email_hash char(64) NOT NULL,
  ip_address inet,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  succeeded boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS admin_login_attempts_window_idx ON admin_login_attempts(email_hash, ip_address, attempted_at DESC);
CREATE INDEX IF NOT EXISTS admin_login_attempts_ip_window_idx ON admin_login_attempts(ip_address, attempted_at DESC) WHERE succeeded = false;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_idx ON admin_audit_logs(actor_id, created_at DESC);

INSERT INTO admin_roles (id, label) VALUES
  ('super_admin', 'Super Admin'),
  ('admin', 'Admin'),
  ('manager', 'Manager'),
  ('product_manager', 'Product Manager'),
  ('order_manager', 'Order Manager'),
  ('customer_support', 'Customer Support'),
  ('marketing_manager', 'Marketing Manager'),
  ('inventory_manager', 'Inventory Manager'),
  ('finance_manager', 'Finance Manager')
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label;

INSERT INTO admin_permissions (id, description) VALUES
  ('dashboard.view', 'View dashboard'),
  ('products.view', 'View products'),
  ('products.create', 'Create products'),
  ('products.update', 'Update products'),
  ('products.delete', 'Delete products'),
  ('products.publish', 'Publish products'),
  ('orders.view', 'View orders'),
  ('orders.update', 'Update orders'),
  ('orders.refund', 'Process order refunds'),
  ('customers.view', 'View customer records'),
  ('customers.update', 'Update customer records'),
  ('categories.manage', 'Manage product categories'),
  ('promotions.manage', 'Manage promotions'),
  ('content.manage', 'Manage website and app content'),
  ('inventory.manage', 'Manage inventory'),
  ('analytics.view', 'View reports and analytics'),
  ('settings.view', 'View store settings'),
  ('settings.update', 'Update store settings'),
  ('payments.manage', 'Manage payment configuration'),
  ('admins.view', 'View administrator accounts'),
  ('admins.create', 'Create administrator accounts'),
  ('admins.update', 'Update administrator accounts and roles'),
  ('admins.delete', 'Delete administrator accounts'),
  ('audit.view', 'View administrator activity logs')
ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 'super_admin', id FROM admin_permissions
ON CONFLICT DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT role_id, permission_id
FROM (VALUES
  ('admin', 'dashboard.view'), ('admin', 'products.view'), ('admin', 'products.create'), ('admin', 'products.update'), ('admin', 'products.delete'), ('admin', 'products.publish'),
  ('admin', 'orders.view'), ('admin', 'orders.update'), ('admin', 'orders.refund'), ('admin', 'customers.view'), ('admin', 'customers.update'), ('admin', 'categories.manage'),
  ('admin', 'promotions.manage'), ('admin', 'content.manage'), ('admin', 'inventory.manage'), ('admin', 'analytics.view'), ('admin', 'settings.view'),
  ('manager', 'dashboard.view'), ('manager', 'products.view'), ('manager', 'products.update'), ('manager', 'orders.view'), ('manager', 'orders.update'), ('manager', 'customers.view'), ('manager', 'inventory.manage'), ('manager', 'analytics.view'),
  ('product_manager', 'dashboard.view'), ('product_manager', 'products.view'), ('product_manager', 'products.create'), ('product_manager', 'products.update'), ('product_manager', 'products.publish'), ('product_manager', 'categories.manage'), ('product_manager', 'inventory.manage'),
  ('order_manager', 'dashboard.view'), ('order_manager', 'orders.view'), ('order_manager', 'orders.update'),
  ('customer_support', 'dashboard.view'), ('customer_support', 'orders.view'), ('customer_support', 'customers.view'), ('customer_support', 'customers.update'),
  ('marketing_manager', 'dashboard.view'), ('marketing_manager', 'products.view'), ('marketing_manager', 'promotions.manage'), ('marketing_manager', 'content.manage'), ('marketing_manager', 'analytics.view'),
  ('inventory_manager', 'dashboard.view'), ('inventory_manager', 'products.view'), ('inventory_manager', 'inventory.manage'),
  ('finance_manager', 'dashboard.view'), ('finance_manager', 'orders.view'), ('finance_manager', 'analytics.view'), ('finance_manager', 'payments.manage')
) AS grants(role_id, permission_id)
ON CONFLICT DO NOTHING;
