
-- Add pending_payment status
ALTER TYPE shop_status ADD VALUE IF NOT EXISTS 'pending_payment';

-- Shops table extensions
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS credit_balance NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_package_id UUID REFERENCES public.packages(id),
  ADD COLUMN IF NOT EXISTS pending_billing_cycle TEXT;

-- Subscription_payments extensions
ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS invoice_no TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS invoice_type TEXT NOT NULL DEFAULT 'renewal',
  ADD COLUMN IF NOT EXISTS proration_details JSONB,
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- Allow 'cancelled' payment status (skip if enum, we use text-compat)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='payment_status' AND e.enumlabel='cancelled') THEN
      ALTER TYPE payment_status ADD VALUE 'cancelled';
    END IF;
  END IF;
END$$;

-- Sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START 1000;

-- Trigger function to auto-generate invoice_no
CREATE OR REPLACE FUNCTION public.set_invoice_no()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_no IS NULL THEN
    NEW.invoice_no := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_invoice_no ON public.subscription_payments;
CREATE TRIGGER trg_set_invoice_no
BEFORE INSERT ON public.subscription_payments
FOR EACH ROW EXECUTE FUNCTION public.set_invoice_no();

-- Backfill invoice_no for existing rows
UPDATE public.subscription_payments
SET invoice_no = 'INV-' || to_char(created_at, 'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 6, '0')
WHERE invoice_no IS NULL;
