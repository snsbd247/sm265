ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS sales_shop_idempotency_key_uidx
  ON public.sales(shop_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_breakdown JSONB;