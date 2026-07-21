
-- 1. Extend demo_requests
ALTER TABLE public.demo_requests
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS review_note TEXT,
  ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT;

-- Default status is 'pending'
ALTER TABLE public.demo_requests ALTER COLUMN status SET DEFAULT 'pending';

-- 2. Seed a Trial package if missing (idempotent)
INSERT INTO public.packages (name, description, price_monthly, price_yearly, max_products, max_users, max_customers, max_sms_per_month, max_invoices_per_month, max_invoice_total_per_month, features, is_active, sort_order)
SELECT 'Trial', '১৪ দিনের ফ্রি ট্রায়াল', 0, 0, 50, 2, 50, 20, 100, 50000, '["Basic POS", "Inventory", "Customers"]'::jsonb, true, 0
WHERE NOT EXISTS (SELECT 1 FROM public.packages WHERE lower(name) = 'trial');

-- 3. Auto-lock function: shops whose subscription_end passed => status 'locked'
CREATE OR REPLACE FUNCTION public.auto_lock_expired_shops()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.shops
     SET status = 'locked'
   WHERE status IN ('active','expired')
     AND subscription_end IS NOT NULL
     AND subscription_end < now();
END;
$$;

-- 4. Schedule (requires pg_cron)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule if already exists then reschedule
DO $$
BEGIN
  PERFORM cron.unschedule('auto-lock-expired-shops');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('auto-lock-expired-shops', '*/30 * * * *', $$SELECT public.auto_lock_expired_shops();$$);
