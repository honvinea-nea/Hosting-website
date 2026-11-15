-- Persistent commerce data for Classic Eleven / Shoply.
-- The Node.js server connects using the Supabase PostgreSQL connection string.
-- Keep database credentials server-side; do not expose them to browser JavaScript.

CREATE TABLE IF NOT EXISTS shop_categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop_products (
  id text PRIMARY KEY,
  name text NOT NULL,
  sku text UNIQUE,
  category_id text REFERENCES shop_categories(id) ON DELETE SET NULL,
  category_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  discount_price numeric(12,2) CHECK (discount_price IS NULL OR discount_price >= 0),
  image_url text NOT NULL DEFAULT '',
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','archived')),
  featured boolean NOT NULL DEFAULT false,
  sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  colors jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_products_status_idx ON shop_products(status);
CREATE INDEX IF NOT EXISTS shop_products_category_idx ON shop_products(category_id);

CREATE TABLE IF NOT EXISTS shop_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text NOT NULL DEFAULT '',
  password_hash text,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_customers_created_idx ON shop_customers(created_at DESC);

CREATE TABLE IF NOT EXISTS shop_orders (
  id text PRIMARY KEY,
  customer_id uuid REFERENCES shop_customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  delivery_address text NOT NULL DEFAULT '',
  delivery_date date,
  delivery_time text NOT NULL DEFAULT '',
  recipient text NOT NULL DEFAULT '',
  gift_message text NOT NULL DEFAULT '',
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  tax numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total numeric(12,2) NOT NULL CHECK (total >= 0),
  currency text NOT NULL DEFAULT 'USD',
  payment_method text NOT NULL DEFAULT 'unpaid',
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded','not_required')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','processing','out_for_delivery','completed','cancelled')),
  promotion_code text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_orders_created_idx ON shop_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS shop_orders_customer_idx ON shop_orders(customer_id);
CREATE INDEX IF NOT EXISTS shop_orders_status_idx ON shop_orders(status);

CREATE TABLE IF NOT EXISTS shop_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  product_id text REFERENCES shop_products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  sku text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  line_total numeric(12,2) NOT NULL CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_order_items_order_idx ON shop_order_items(order_id);

CREATE TABLE IF NOT EXISTS shop_promotions (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  active boolean NOT NULL DEFAULT true,
  note text NOT NULL DEFAULT '',
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit >= 0),
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  quantity_change integer NOT NULL CHECK (quantity_change <> 0),
  reason text NOT NULL,
  reference_type text NOT NULL DEFAULT '',
  reference_id text NOT NULL DEFAULT '',
  actor_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_inventory_product_idx ON shop_inventory_movements(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS shop_notifications (
  id text PRIMARY KEY,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_notifications_created_idx ON shop_notifications(created_at DESC);

-- No anon/authenticated table grants are created here. Commerce writes are intended
-- to go through the Node.js server, which performs validation and admin authorization.
