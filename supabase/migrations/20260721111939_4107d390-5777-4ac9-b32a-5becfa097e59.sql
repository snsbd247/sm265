ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS share_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS sales_share_token_key ON public.sales(share_token);