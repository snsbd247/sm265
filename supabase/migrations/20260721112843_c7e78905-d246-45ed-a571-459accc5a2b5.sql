
-- 1. Extend packages with new limits
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS max_customers integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_invoices_per_month integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_invoice_total_per_month numeric(14,2) NOT NULL DEFAULT 0;

-- 2. Extend subscription_payments
ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS paid_via text,
  ADD COLUMN IF NOT EXISTS payment_note text;

-- 3. Ledger table for each partial/full receipt against a subscription invoice
CREATE TABLE IF NOT EXISTS public.subscription_payment_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.subscription_payments(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount <> 0),
  method text NOT NULL DEFAULT 'cash',
  reference text,
  note text,
  received_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_payment_ledger TO authenticated;
GRANT ALL ON public.subscription_payment_ledger TO service_role;

ALTER TABLE public.subscription_payment_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spl_member_select" ON public.subscription_payment_ledger;
CREATE POLICY "spl_member_select" ON public.subscription_payment_ledger
  FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));

DROP POLICY IF EXISTS "spl_super_admin_all" ON public.subscription_payment_ledger;
CREATE POLICY "spl_super_admin_all" ON public.subscription_payment_ledger
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_spl_payment ON public.subscription_payment_ledger(payment_id);
CREATE INDEX IF NOT EXISTS idx_spl_shop ON public.subscription_payment_ledger(shop_id);

-- 4. Race protection: only one active subscription per shop
CREATE UNIQUE INDEX IF NOT EXISTS one_active_sub_per_shop
  ON public.subscriptions(shop_id) WHERE status = 'active';

-- 5. Helper: receive a manual payment against a subscription invoice.
-- Adds ledger row, updates aggregate paid amount on subscription_payments,
-- and returns json with { total_paid, remaining, fully_paid }.
CREATE OR REPLACE FUNCTION public.receive_subscription_payment(
  _payment_id uuid,
  _amount numeric,
  _method text,
  _reference text,
  _note text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pay RECORD;
  _total_paid numeric;
  _remaining numeric;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  SELECT * INTO _pay FROM public.subscription_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment not found'; END IF;

  -- authorization: shop member or super admin
  IF NOT (public.is_shop_member(auth.uid(), _pay.shop_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.subscription_payment_ledger(payment_id, shop_id, amount, method, reference, note, received_by)
  VALUES (_payment_id, _pay.shop_id, _amount, COALESCE(_method,'cash'), NULLIF(_reference,''), NULLIF(_note,''), auth.uid());

  SELECT COALESCE(SUM(amount),0) INTO _total_paid
    FROM public.subscription_payment_ledger WHERE payment_id = _payment_id;

  _remaining := GREATEST(_pay.amount - _total_paid, 0);

  -- Track the latest method on the invoice for quick display
  UPDATE public.subscription_payments
     SET paid_via = COALESCE(_method, paid_via),
         payment_note = COALESCE(NULLIF(_note,''), payment_note)
   WHERE id = _payment_id;

  RETURN jsonb_build_object(
    'total_paid', _total_paid,
    'remaining', _remaining,
    'fully_paid', (_remaining = 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.receive_subscription_payment(uuid, numeric, text, text, text) TO authenticated;
