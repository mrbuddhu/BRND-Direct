-- ============================================================
--  BRND DIRECT — Complete PostgreSQL Database Schema
--  Target: Supabase (PostgreSQL 15+)
--
--  HOW TO USE:
--  1. Open your Supabase project → SQL Editor → New query
--  2. Paste this entire file and click "Run"
--  3. All tables, policies, indexes, triggers and seed data
--     will be created automatically.
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for fast text search

-- ============================================================
--  ENUMS
-- ============================================================
CREATE TYPE user_role        AS ENUM ('buyer', 'seller', 'admin');
CREATE TYPE account_status   AS ENUM ('pending', 'approved', 'suspended', 'rejected');
CREATE TYPE order_status     AS ENUM ('draft','pending','confirmed','processing','shipped','delivered','cancelled','refunded');
CREATE TYPE payment_status   AS ENUM ('unpaid','pending','paid','failed','refunded','partially_refunded');
CREATE TYPE fulfill_type     AS ENUM ('wholesale','dropship','both');
CREATE TYPE payout_status    AS ENUM ('pending','processing','paid','failed');
CREATE TYPE rfq_status       AS ENUM ('open','quoted','accepted','rejected','expired');
CREATE TYPE message_status   AS ENUM ('sent','delivered','read');
CREATE TYPE notification_type AS ENUM ('order','payment','message','system','rfq','shipment');

-- ============================================================
--  1. PROFILES  (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role              user_role   NOT NULL DEFAULT 'buyer',
  status            account_status NOT NULL DEFAULT 'pending',
  first_name        TEXT,
  last_name         TEXT,
  display_name      TEXT,
  avatar_url        TEXT,
  phone             TEXT,
  country           TEXT        DEFAULT 'US',
  timezone          TEXT        DEFAULT 'America/New_York',
  email_verified    BOOLEAN     DEFAULT FALSE,
  onboarding_done   BOOLEAN     DEFAULT FALSE,
  last_seen_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Trigger: auto-create profile (+ buyer_profiles for buyers) on new auth user ─
-- Static signup sends business_* in raw_user_meta_data so rows exist even when
-- email confirmation is on (no client session → RLS would otherwise block inserts).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r user_role;
  fn text;
  ln text;
  disp text;
  ph text;
  bn text;
BEGIN
  fn := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), '');
  ln := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'last_name', '')), '');
  ph := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
  disp := NULLIF(trim(concat_ws(' ', fn, ln)), '');

  BEGIN
    r := COALESCE(
      (NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'role', '')), ''))::user_role,
      'buyer'::user_role
    );
  EXCEPTION
    WHEN invalid_text_representation THEN
      r := 'buyer'::user_role;
  END;

  INSERT INTO profiles (id, role, first_name, last_name, phone, display_name, status)
  VALUES (NEW.id, r, fn, ln, ph, disp, 'pending'::account_status)
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role,
      first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
      last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
      phone = COALESCE(EXCLUDED.phone, profiles.phone),
      display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
      status = EXCLUDED.status;

  IF r = 'buyer'::user_role THEN
    bn := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'business_name', '')), '');
    IF bn IS NOT NULL THEN
      INSERT INTO buyer_profiles (profile_id, business_name, business_type, ein_tax_id)
      VALUES (
        NEW.id,
        bn,
        NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'business_type', '')), ''),
        NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'ein_tax_id', '')), '')
      )
      ON CONFLICT (profile_id) DO UPDATE
      SET business_name = EXCLUDED.business_name,
          business_type = COALESCE(EXCLUDED.business_type, buyer_profiles.business_type),
          ein_tax_id = COALESCE(EXCLUDED.ein_tax_id, buyer_profiles.ein_tax_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Trigger: keep updated_at current ────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  2. BUYER PROFILES
-- ============================================================
CREATE TABLE buyer_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_name       TEXT NOT NULL,
  business_type       TEXT,         -- retailer, ecommerce, boutique, distributor …
  ein_tax_id          TEXT,
  website_url         TEXT,
  annual_spend_range  TEXT,         -- 'under_1m', '1m_10m', '10m_plus'
  credit_limit        NUMERIC(12,2) DEFAULT 0,
  credit_used         NUMERIC(12,2) DEFAULT 0,
  net_terms           INTEGER       DEFAULT 30,   -- 30 | 60 | 90
  approved_at         TIMESTAMPTZ,
  notes               TEXT,         -- internal admin notes
  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(profile_id)
);

CREATE TRIGGER buyer_updated_at BEFORE UPDATE ON buyer_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  3. SELLER / BRAND PROFILES
-- ============================================================
CREATE TABLE seller_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  brand_name          TEXT NOT NULL,
  brand_slug          TEXT UNIQUE NOT NULL,   -- url-safe e.g. "maison-margiela"
  description         TEXT,
  logo_url            TEXT,
  website_url         TEXT,
  annual_revenue_range TEXT,
  primary_category    TEXT,
  fulfillment_type    fulfill_type  DEFAULT 'both',
  map_enforcement     BOOLEAN       DEFAULT TRUE,
  commission_rate     NUMERIC(5,2)  DEFAULT 12.00,  -- % BRND Direct takes
  stripe_account_id   TEXT,         -- Stripe Connect account ID
  approved_at         TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(profile_id)
);

CREATE TRIGGER seller_updated_at BEFORE UPDATE ON seller_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  4. BRANDS  (public catalog entries — separate from sellers)
-- ============================================================
CREATE TABLE brands (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_profile_id UUID REFERENCES seller_profiles(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  logo_url          TEXT,
  banner_url        TEXT,
  description       TEXT,
  category          TEXT,           -- fragrances | beauty | skincare | bags | sneakers …
  country_of_origin TEXT,
  is_verified       BOOLEAN   DEFAULT FALSE,
  is_active         BOOLEAN   DEFAULT TRUE,
  sort_order        INTEGER   DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER brands_updated_at BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_brands_category ON brands(category);
CREATE INDEX idx_brands_slug     ON brands(slug);
CREATE INDEX idx_brands_name_trgm ON brands USING GIN (name gin_trgm_ops);

-- ============================================================
--  5. PRODUCTS
-- ============================================================
CREATE TABLE products (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id          UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  seller_profile_id UUID REFERENCES seller_profiles(id) ON DELETE SET NULL,
  sku               TEXT UNIQUE NOT NULL,
  upc               TEXT UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT,
  category          TEXT NOT NULL,
  subcategory       TEXT[],           -- ['edt','men','gift-sets']
  tags              TEXT[],           -- ['weekly','today','holiday']
  fulfillment_type  fulfill_type      DEFAULT 'both',
  wholesale_price   NUMERIC(10,2)     NOT NULL,
  msrp              NUMERIC(10,2),    -- suggested retail price
  moq               INTEGER           DEFAULT 1,
  stock_qty         INTEGER           DEFAULT 0,
  is_active         BOOLEAN           DEFAULT TRUE,
  is_top_seller     BOOLEAN           DEFAULT FALSE,
  images            TEXT[],           -- array of storage URLs
  meta              JSONB             DEFAULT '{}',  -- concentration, size, gender …
  created_at        TIMESTAMPTZ       DEFAULT NOW(),
  updated_at        TIMESTAMPTZ       DEFAULT NOW()
);

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_products_brand      ON products(brand_id);
CREATE INDEX idx_products_category   ON products(category);
CREATE INDEX idx_products_sku        ON products(sku);
CREATE INDEX idx_products_upc        ON products(upc);
CREATE INDEX idx_products_tags       ON products USING GIN (tags);
CREATE INDEX idx_products_subcat     ON products USING GIN (subcategory);
CREATE INDEX idx_products_name_trgm  ON products USING GIN (name gin_trgm_ops);
CREATE INDEX idx_products_active     ON products(is_active, is_top_seller);

-- ============================================================
--  6. ORDERS
-- ============================================================
CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number      TEXT UNIQUE NOT NULL DEFAULT 'BD-' || LPAD(FLOOR(RANDOM()*999999)::TEXT, 6, '0'),
  buyer_profile_id  UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE RESTRICT,
  status            order_status    DEFAULT 'pending',
  payment_status    payment_status  DEFAULT 'unpaid',
  subtotal          NUMERIC(12,2)   DEFAULT 0,
  discount_amount   NUMERIC(12,2)   DEFAULT 0,
  tax_amount        NUMERIC(12,2)   DEFAULT 0,
  shipping_amount   NUMERIC(12,2)   DEFAULT 0,
  total_amount      NUMERIC(12,2)   DEFAULT 0,
  net_terms         INTEGER         DEFAULT 30,
  due_date          DATE,
  stripe_payment_intent TEXT,
  notes             TEXT,
  shipping_address  JSONB,
  tracking_info     JSONB,          -- { carrier, tracking_number, url, estimated_delivery }
  created_at        TIMESTAMPTZ     DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     DEFAULT NOW()
);

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_orders_buyer   ON orders(buyer_profile_id);
CREATE INDEX idx_orders_status  ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- ── Order line items ─────────────────────────────────────────
CREATE TABLE order_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  seller_profile_id UUID REFERENCES seller_profiles(id) ON DELETE SET NULL,
  sku               TEXT NOT NULL,
  name              TEXT NOT NULL,
  quantity          INTEGER          NOT NULL CHECK (quantity > 0),
  unit_price        NUMERIC(10,2)    NOT NULL,
  line_total        NUMERIC(12,2)    GENERATED ALWAYS AS (quantity * unit_price) STORED,
  fulfillment_type  fulfill_type     DEFAULT 'wholesale',
  created_at        TIMESTAMPTZ      DEFAULT NOW()
);

CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ── Trigger: recalculate order totals when items change ──────
CREATE OR REPLACE FUNCTION recalc_order_total()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE orders
  SET subtotal     = (SELECT COALESCE(SUM(line_total),0) FROM order_items WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)),
      total_amount = subtotal + tax_amount + shipping_amount - discount_amount,
      updated_at   = NOW()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER order_items_recalc
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION recalc_order_total();

-- ============================================================
--  7. INVOICES
-- ============================================================
CREATE TABLE invoices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number    TEXT UNIQUE NOT NULL DEFAULT 'INV-' || LPAD(FLOOR(RANDOM()*999999)::TEXT, 6, '0'),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  buyer_profile_id  UUID NOT NULL REFERENCES buyer_profiles(id),
  amount            NUMERIC(12,2) NOT NULL,
  payment_status    payment_status  DEFAULT 'unpaid',
  stripe_invoice_id TEXT,
  due_date          DATE,
  paid_at           TIMESTAMPTZ,
  pdf_url           TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_invoices_buyer  ON invoices(buyer_profile_id);
CREATE INDEX idx_invoices_order  ON invoices(order_id);
CREATE INDEX idx_invoices_status ON invoices(payment_status);

-- ============================================================
--  8. PAYOUTS  (to sellers)
-- ============================================================
CREATE TABLE payouts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_profile_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT,
  amount            NUMERIC(12,2) NOT NULL,
  commission_deducted NUMERIC(12,2) DEFAULT 0,
  net_amount        NUMERIC(12,2) GENERATED ALWAYS AS (amount - commission_deducted) STORED,
  status            payout_status   DEFAULT 'pending',
  stripe_transfer_id TEXT,
  period_start      DATE,
  period_end        DATE,
  paid_at           TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER payouts_updated_at BEFORE UPDATE ON payouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_payouts_seller ON payouts(seller_profile_id);
CREATE INDEX idx_payouts_status ON payouts(status);

-- ============================================================
--  9. RFQ (Request for Quote)
-- ============================================================
CREATE TABLE rfqs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_number        TEXT UNIQUE DEFAULT 'RFQ-' || LPAD(FLOOR(RANDOM()*999999)::TEXT, 6, '0'),
  buyer_profile_id  UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
  seller_profile_id UUID REFERENCES seller_profiles(id) ON DELETE SET NULL,
  product_id        UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity_requested INTEGER NOT NULL,
  target_price      NUMERIC(10,2),
  quoted_price      NUMERIC(10,2),
  status            rfq_status   DEFAULT 'open',
  notes             TEXT,
  expires_at        TIMESTAMPTZ  DEFAULT (NOW() + INTERVAL '14 days'),
  responded_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TRIGGER rfqs_updated_at BEFORE UPDATE ON rfqs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  10. MESSAGES
-- ============================================================
CREATE TABLE conversations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_profile_id  UUID NOT NULL REFERENCES buyer_profiles(id)  ON DELETE CASCADE,
  seller_profile_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
  subject           TEXT,
  last_message_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(buyer_profile_id, seller_profile_id)
);

CREATE TABLE messages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body              TEXT NOT NULL,
  attachment_url    TEXT,
  status            message_status DEFAULT 'sent',
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_convo   ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender  ON messages(sender_id);

-- Trigger: update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations SET last_message_at = NOW() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER messages_update_convo
  AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION update_conversation_ts();

-- ============================================================
--  11. NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type              notification_type DEFAULT 'system',
  title             TEXT NOT NULL,
  body              TEXT,
  link              TEXT,
  is_read           BOOLEAN     DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifs_profile ON notifications(profile_id, is_read, created_at DESC);

-- ============================================================
--  12. ANALYTICS EVENTS  (lightweight, append-only)
-- ============================================================
CREATE TABLE analytics_events (
  id          BIGSERIAL PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,   -- 'page_view','product_view','add_to_cart','order_placed' …
  payload     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_profile ON analytics_events(profile_id, created_at DESC);
CREATE INDEX idx_analytics_type    ON analytics_events(event_type, created_at DESC);

-- ============================================================
--  13. ADMIN SETTINGS  (key-value store for app config)
-- ============================================================
CREATE TABLE app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value, description) VALUES
  ('platform_name',     '"BRND Direct"',                  'Platform display name'),
  ('commission_rate',   '12.0',                           'Default seller commission %'),
  ('default_net_terms', '30',                             'Default net payment terms (days)'),
  ('stripe_mode',       '"live"',                         'live or test'),
  ('max_credit_limit',  '100000',                         'Maximum buyer credit limit USD'),
  ('support_email',     '"support@brnddirect.com"',       'Customer support email'),
  ('maintenance_mode',  'false',                          'Set true to show maintenance page');

-- ============================================================
--  ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands            ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events  ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ── profiles ─────────────────────────────────────────────────
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can do anything on profiles"
  ON profiles FOR ALL USING (is_admin());

-- ── buyer_profiles ───────────────────────────────────────────
CREATE POLICY "Buyers see own record"
  ON buyer_profiles FOR SELECT USING (
    profile_id = auth.uid() OR is_admin()
  );
CREATE POLICY "Buyers update own record"
  ON buyer_profiles FOR UPDATE USING (profile_id = auth.uid());
CREATE POLICY "Buyers insert own record"
  ON buyer_profiles FOR INSERT WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Admins full access buyer_profiles"
  ON buyer_profiles FOR ALL USING (is_admin());

-- ── seller_profiles ──────────────────────────────────────────
CREATE POLICY "Sellers see own record"
  ON seller_profiles FOR SELECT USING (
    profile_id = auth.uid() OR is_admin()
  );
CREATE POLICY "Sellers update own record"
  ON seller_profiles FOR UPDATE USING (profile_id = auth.uid());
CREATE POLICY "Sellers insert own record"
  ON seller_profiles FOR INSERT WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Admins full access seller_profiles"
  ON seller_profiles FOR ALL USING (is_admin());

-- ── brands & products — publicly readable ────────────────────
CREATE POLICY "Anyone can read active brands"
  ON brands FOR SELECT USING (is_active = TRUE OR is_admin());
CREATE POLICY "Sellers manage own brands"
  ON brands FOR ALL USING (
    seller_profile_id IN (SELECT id FROM seller_profiles WHERE profile_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "Anyone can read active products"
  ON products FOR SELECT USING (is_active = TRUE OR is_admin());
CREATE POLICY "Sellers manage own products"
  ON products FOR ALL USING (
    seller_profile_id IN (SELECT id FROM seller_profiles WHERE profile_id = auth.uid())
    OR is_admin()
  );

-- ── orders ───────────────────────────────────────────────────
CREATE POLICY "Buyers see own orders"
  ON orders FOR SELECT USING (
    buyer_profile_id IN (SELECT id FROM buyer_profiles WHERE profile_id = auth.uid())
    OR is_admin()
  );
CREATE POLICY "Buyers create orders"
  ON orders FOR INSERT WITH CHECK (
    buyer_profile_id IN (SELECT id FROM buyer_profiles WHERE profile_id = auth.uid())
  );
CREATE POLICY "Buyers update draft orders"
  ON orders FOR UPDATE USING (
    buyer_profile_id IN (SELECT id FROM buyer_profiles WHERE profile_id = auth.uid())
    AND status = 'draft'
  );
CREATE POLICY "Admins full access orders"
  ON orders FOR ALL USING (is_admin());

-- ── order_items ──────────────────────────────────────────────
CREATE POLICY "Order items visible to order owner"
  ON order_items FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN buyer_profiles bp ON bp.id = o.buyer_profile_id
      WHERE bp.profile_id = auth.uid()
    ) OR is_admin()
  );
CREATE POLICY "Sellers see order items for their products"
  ON order_items FOR SELECT USING (
    seller_profile_id IN (SELECT id FROM seller_profiles WHERE profile_id = auth.uid())
  );

-- ── invoices ─────────────────────────────────────────────────
CREATE POLICY "Buyers see own invoices"
  ON invoices FOR SELECT USING (
    buyer_profile_id IN (SELECT id FROM buyer_profiles WHERE profile_id = auth.uid())
    OR is_admin()
  );

-- ── payouts ──────────────────────────────────────────────────
CREATE POLICY "Sellers see own payouts"
  ON payouts FOR SELECT USING (
    seller_profile_id IN (SELECT id FROM seller_profiles WHERE profile_id = auth.uid())
    OR is_admin()
  );

-- ── rfqs ─────────────────────────────────────────────────────
CREATE POLICY "Buyers manage own RFQs"
  ON rfqs FOR ALL USING (
    buyer_profile_id IN (SELECT id FROM buyer_profiles WHERE profile_id = auth.uid())
    OR is_admin()
  );
CREATE POLICY "Sellers see RFQs addressed to them"
  ON rfqs FOR SELECT USING (
    seller_profile_id IN (SELECT id FROM seller_profiles WHERE profile_id = auth.uid())
  );

-- ── messages ─────────────────────────────────────────────────
CREATE POLICY "Conversation participants read"
  ON conversations FOR SELECT USING (
    buyer_profile_id  IN (SELECT id FROM buyer_profiles  WHERE profile_id = auth.uid())
    OR seller_profile_id IN (SELECT id FROM seller_profiles WHERE profile_id = auth.uid())
    OR is_admin()
  );
CREATE POLICY "Message participants read"
  ON messages FOR SELECT USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      LEFT JOIN buyer_profiles  bp ON bp.id  = c.buyer_profile_id
      LEFT JOIN seller_profiles sp ON sp.id  = c.seller_profile_id
      WHERE bp.profile_id = auth.uid() OR sp.profile_id = auth.uid()
    ) OR is_admin()
  );
CREATE POLICY "Users send messages in own conversations"
  ON messages FOR INSERT WITH CHECK (
    sender_id = auth.uid()
  );

-- ── notifications ────────────────────────────────────────────
CREATE POLICY "Users see own notifications"
  ON notifications FOR SELECT USING (profile_id = auth.uid() OR is_admin());
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE USING (profile_id = auth.uid());
CREATE POLICY "Users insert own notifications"
  ON notifications FOR INSERT WITH CHECK (profile_id = auth.uid());

-- ── analytics — write-only for own user ──────────────────────
CREATE POLICY "Users insert own events"
  ON analytics_events FOR INSERT WITH CHECK (
    profile_id = auth.uid() OR profile_id IS NULL
  );
CREATE POLICY "Admins read all events"
  ON analytics_events FOR SELECT USING (is_admin());

-- ============================================================
--  ADMIN VIEWS  (easy to query from the admin dashboard)
-- ============================================================
CREATE OR REPLACE VIEW admin_overview AS
SELECT
  (SELECT COUNT(*) FROM profiles WHERE role = 'buyer')                        AS total_buyers,
  (SELECT COUNT(*) FROM profiles WHERE role = 'seller')                       AS total_sellers,
  (SELECT COUNT(*) FROM profiles WHERE status = 'pending')                    AS pending_approvals,
  (SELECT COUNT(*) FROM products WHERE is_active = TRUE)                      AS active_products,
  (SELECT COUNT(*) FROM orders WHERE status NOT IN ('draft','cancelled'))      AS total_orders,
  (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE payment_status='paid') AS total_revenue,
  (SELECT COUNT(*) FROM orders WHERE status = 'pending')                      AS pending_orders,
  (SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '24h')     AS orders_today,
  (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE created_at > NOW() - INTERVAL '30d' AND payment_status='paid') AS revenue_mtd,
  (SELECT COUNT(*) FROM rfqs WHERE status = 'open')                           AS open_rfqs,
  (SELECT COUNT(*) FROM payouts WHERE status = 'pending')                     AS pending_payouts,
  (SELECT COALESCE(SUM(net_amount),0) FROM payouts WHERE status = 'pending')  AS payouts_owed;

-- Revenue by month (last 12 months)
CREATE OR REPLACE VIEW revenue_by_month AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*)                         AS order_count,
  SUM(total_amount)                AS revenue
FROM orders
WHERE payment_status = 'paid'
  AND created_at > NOW() - INTERVAL '12 months'
GROUP BY 1
ORDER BY 1;

-- Top products view
CREATE OR REPLACE VIEW top_products AS
SELECT
  p.id, p.name, p.sku, p.category, b.name AS brand_name,
  COUNT(oi.id)       AS total_orders,
  SUM(oi.quantity)   AS total_units_sold,
  SUM(oi.line_total) AS total_revenue
FROM products p
JOIN brands b ON b.id = p.brand_id
JOIN order_items oi ON oi.product_id = p.id
JOIN orders o ON o.id = oi.order_id AND o.payment_status = 'paid'
GROUP BY p.id, p.name, p.sku, p.category, b.name
ORDER BY total_revenue DESC;

-- ============================================================
--  REALTIME  (enable for live dashboard updates)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- ============================================================
--  STORAGE BUCKETS  (run in Supabase Storage settings or SQL)
-- ============================================================
-- NOTE: Supabase storage buckets are created via the Dashboard UI
-- or the Management API. Create these buckets:
--   • product-images   (public)
--   • brand-logos      (public)
--   • avatars          (public)
--   • documents        (private — invoices, KYC docs)

-- ============================================================
--  SEED DATA — Brands and sample products
-- ============================================================
-- (These match the products already in buyer/products.html)

INSERT INTO brands (name, slug, category, is_verified, is_active) VALUES
  ('Maison Margiela',          'maison-margiela',          'fragrances', TRUE,  TRUE),
  ('Chanel',                   'chanel',                   'fragrances', TRUE,  TRUE),
  ('Dior',                     'dior',                     'fragrances', TRUE,  TRUE),
  ('Yves Saint Laurent',       'yves-saint-laurent',       'fragrances', TRUE,  TRUE),
  ('Jo Malone',                'jo-malone',                'fragrances', TRUE,  TRUE),
  ('Maison Francis Kurkdjian', 'maison-francis-kurkdjian', 'fragrances', TRUE,  TRUE),
  ('Charlotte Tilbury',        'charlotte-tilbury',        'beauty',     TRUE,  TRUE),
  ('NARS Cosmetics',           'nars-cosmetics',           'beauty',     TRUE,  TRUE),
  ('MAC Cosmetics',            'mac-cosmetics',            'beauty',     TRUE,  TRUE),
  ('La Mer',                   'la-mer',                   'skincare',   TRUE,  TRUE),
  ('Kiehls',                   'kiehls',                   'skincare',   TRUE,  TRUE),
  ('Elemis',                   'elemis',                   'skincare',   TRUE,  TRUE),
  ('Clinique',                 'clinique',                 'skincare',   TRUE,  TRUE),
  ('Gucci',                    'gucci',                    'bags',       TRUE,  TRUE),
  ('Prada',                    'prada',                    'bags',       TRUE,  TRUE),
  ('New Balance',              'new-balance',              'sneakers',   TRUE,  TRUE),
  ('Jordan Brand / Nike',      'jordan-brand-nike',        'sneakers',   TRUE,  TRUE),
  ('Versace',                  'versace',                  'apparel',    TRUE,  TRUE),
  ('Polo Ralph Lauren',        'polo-ralph-lauren',        'apparel',    TRUE,  TRUE),
  ('Make Up For Ever',         'make-up-for-ever',         'cosmetics',  TRUE,  TRUE),
  ('Benefit Cosmetics',        'benefit-cosmetics',        'cosmetics',  TRUE,  TRUE);

-- ============================================================
--  Done! Your BRND Direct database is ready.
-- ============================================================
