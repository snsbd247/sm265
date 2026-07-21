
-- 1) invoice_templates (per shop)
CREATE TABLE public.invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0f766e',
  accent_color TEXT NOT NULL DEFAULT '#f0fdfa',
  text_color TEXT NOT NULL DEFAULT '#0f172a',
  address_line TEXT,
  contact_line TEXT,
  footer_note TEXT,
  terms_note TEXT,
  show_logo BOOLEAN NOT NULL DEFAULT true,
  show_qr BOOLEAN NOT NULL DEFAULT true,
  show_signature BOOLEAN NOT NULL DEFAULT false,
  signature_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_templates TO authenticated;
GRANT SELECT ON public.invoice_templates TO anon;
GRANT ALL ON public.invoice_templates TO service_role;
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop members manage own template"
  ON public.invoice_templates FOR ALL
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "public read invoice templates"
  ON public.invoice_templates FOR SELECT
  TO anon
  USING (true);

CREATE TRIGGER trg_invoice_templates_updated
  BEFORE UPDATE ON public.invoice_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) invoice_deliveries (sms + email history)
CREATE TABLE public.invoice_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms','email')),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  response TEXT,
  provider TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_deliveries TO authenticated;
GRANT ALL ON public.invoice_deliveries TO service_role;
ALTER TABLE public.invoice_deliveries ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_invoice_deliveries_sale ON public.invoice_deliveries(sale_id, created_at DESC);
CREATE INDEX idx_invoice_deliveries_customer ON public.invoice_deliveries(customer_id, created_at DESC);

CREATE POLICY "shop members read own deliveries"
  ON public.invoice_deliveries FOR SELECT
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "shop members write deliveries"
  ON public.invoice_deliveries FOR INSERT
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));

-- 3) sale_revisions (snapshot before edit)
CREATE TABLE public.sale_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  reason TEXT,
  snapshot JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sale_id, version)
);
GRANT SELECT, INSERT ON public.sale_revisions TO authenticated;
GRANT ALL ON public.sale_revisions TO service_role;
ALTER TABLE public.sale_revisions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_sale_revisions_sale ON public.sale_revisions(sale_id, version DESC);

CREATE POLICY "shop members read own revisions"
  ON public.sale_revisions FOR SELECT
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "shop members write revisions"
  ON public.sale_revisions FOR INSERT
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_super_admin(auth.uid()));
