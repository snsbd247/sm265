
CREATE TABLE public.customer_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'general',
  body TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX customer_notes_customer_idx ON public.customer_notes(customer_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_notes TO authenticated;
GRANT ALL ON public.customer_notes TO service_role;

ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop members manage customer notes"
  ON public.customer_notes FOR ALL
  TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));
