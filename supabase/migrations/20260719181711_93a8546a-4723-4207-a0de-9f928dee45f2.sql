
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'shop_owner', 'shop_manager', 'shop_cashier');
CREATE TYPE public.shop_status AS ENUM ('active', 'expired', 'locked', 'suspended');
CREATE TYPE public.billing_cycle AS ENUM ('monthly', 'yearly');
CREATE TYPE public.subscription_status AS ENUM ('pending', 'active', 'expired', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('pending', 'success', 'failed', 'refunded');
CREATE TYPE public.sms_status AS ENUM ('pending', 'sent', 'failed');

-- ============ UPDATED-AT HELPER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ PACKAGES ============
CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_products INTEGER NOT NULL DEFAULT 0,
  max_users INTEGER NOT NULL DEFAULT 1,
  max_sms_per_month INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.packages TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_packages_updated BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SHOPS ============
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  logo_url TEXT,
  package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  billing_cycle public.billing_cycle NOT NULL DEFAULT 'monthly',
  status public.shop_status NOT NULL DEFAULT 'active',
  subscription_start TIMESTAMPTZ,
  subscription_end TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_shops_updated BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_shops_status ON public.shops(status);
CREATE INDEX idx_shops_end ON public.shops(subscription_end);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, shop_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_shop ON public.user_roles(shop_id);

-- has_role helpers (security definer to avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.user_shop_ids(_user_id UUID)
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT shop_id FROM public.user_roles WHERE user_id = _user_id AND shop_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_shop_member(_user_id UUID, _shop_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND shop_id = _shop_id);
$$;

-- user_roles policies
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "user_roles_super_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- packages policies (super admin manages; everyone reads active)
CREATE POLICY "packages_select_all" ON public.packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "packages_super_admin_write" ON public.packages FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- shops policies
CREATE POLICY "shops_super_admin_all" ON public.shops FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "shops_member_select" ON public.shops FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), id));
CREATE POLICY "shops_owner_update" ON public.shops FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND shop_id = shops.id AND role = 'shop_owner'));

-- ============ SUBSCRIPTIONS ============
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE RESTRICT,
  billing_cycle public.billing_cycle NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'pending',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_subs_shop ON public.subscriptions(shop_id);
CREATE POLICY "subs_super_admin_all" ON public.subscriptions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "subs_member_select" ON public.subscriptions FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));

-- ============ SUBSCRIPTION PAYMENTS ============
CREATE TABLE public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bkash',
  transaction_id TEXT,
  bkash_payment_id TEXT,
  status public.payment_status NOT NULL DEFAULT 'pending',
  raw_response JSONB,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_sub_pay_updated BEFORE UPDATE ON public.subscription_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "sub_pay_super_admin_all" ON public.subscription_payments FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "sub_pay_member_select" ON public.subscription_payments FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));

-- ============ PAYMENT GATEWAY SETTINGS (bKash) ============
CREATE TABLE public.payment_gateway_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE DEFAULT 'bkash',
  mode TEXT NOT NULL DEFAULT 'sandbox',
  app_key TEXT,
  app_secret TEXT,
  username TEXT,
  password TEXT,
  merchant_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_gateway_settings TO authenticated;
GRANT ALL ON public.payment_gateway_settings TO service_role;
ALTER TABLE public.payment_gateway_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_pgs_updated BEFORE UPDATE ON public.payment_gateway_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "pgs_super_admin_all" ON public.payment_gateway_settings FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- ============ SMS GATEWAY SETTINGS (Greenweb) ============
CREATE TABLE public.sms_gateway_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE DEFAULT 'greenweb',
  api_token TEXT,
  sender_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_gateway_settings TO authenticated;
GRANT ALL ON public.sms_gateway_settings TO service_role;
ALTER TABLE public.sms_gateway_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_sgs_updated BEFORE UPDATE ON public.sms_gateway_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "sgs_super_admin_all" ON public.sms_gateway_settings FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- ============ SMS TEMPLATES ============
CREATE TABLE public.sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_templates TO authenticated;
GRANT ALL ON public.sms_templates TO service_role;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_sms_tpl_updated BEFORE UPDATE ON public.sms_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "sms_tpl_super_admin_all" ON public.sms_templates FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- ============ SMS LOGS ============
CREATE TABLE public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  template_code TEXT,
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  status public.sms_status NOT NULL DEFAULT 'pending',
  response TEXT,
  cost NUMERIC(10,2),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sms_logs TO authenticated;
GRANT ALL ON public.sms_logs TO service_role;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sms_logs_shop ON public.sms_logs(shop_id);
CREATE POLICY "sms_logs_super_admin_all" ON public.sms_logs FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "sms_logs_shop_select" ON public.sms_logs FOR SELECT TO authenticated
  USING (shop_id IS NOT NULL AND public.is_shop_member(auth.uid(), shop_id));

-- ============ SEED DEFAULT PACKAGES + SMS TEMPLATES + GATEWAY ROWS ============
INSERT INTO public.packages (name, description, price_monthly, price_yearly, max_products, max_users, max_sms_per_month, features, sort_order) VALUES
  ('Basic',    'ছোট দোকানের জন্য', 500,  5000,  500,  2, 100,  '["POS","Stock","Customer Ledger"]'::jsonb, 1),
  ('Standard', 'মাঝারি দোকানের জন্য', 1000, 10000, 2000, 5, 500,  '["POS","Stock","Ledger","Reports","Installment"]'::jsonb, 2),
  ('Premium',  'বড় দোকানের জন্য', 2000, 20000, 10000, 15, 2000, '["সব ফিচার","Priority Support"]'::jsonb, 3);

INSERT INTO public.sms_templates (code, title, body) VALUES
  ('account_created', 'একাউন্ট তৈরি', 'স্বাগতম {shop_name}! আপনার লগিন: ফোন {phone}, পাসওয়ার্ড: {password}. প্যাকেজ: {package}, মেয়াদ: {end_date}.'),
  ('expiry_warning',  'মেয়াদ সতর্কতা',  'প্রিয় {owner}, আপনার {shop_name} এর সাবস্ক্রিপশন {days} দিন পর শেষ হবে ({end_date}). দ্রুত রিনিউ করুন।'),
  ('expired',         'মেয়াদ শেষ',      'প্রিয় {owner}, আপনার {shop_name} এর সাবস্ক্রিপশন শেষ হয়েছে। রিনিউ করতে লগিন করুন।'),
  ('renewed',         'রিনিউ',          'ধন্যবাদ! {shop_name} এর সাবস্ক্রিপশন রিনিউ হয়েছে। নতুন মেয়াদ: {end_date}. পরিমাণ: {amount} টাকা।'),
  ('upgraded',        'প্যাকেজ আপগ্রেড', 'অভিনন্দন! {shop_name} এখন {package} প্যাকেজে আপগ্রেড হয়েছে। মেয়াদ: {end_date}.');

INSERT INTO public.payment_gateway_settings (provider, mode, is_active) VALUES ('bkash', 'sandbox', false);
INSERT INTO public.sms_gateway_settings (provider, is_active) VALUES ('greenweb', false);
