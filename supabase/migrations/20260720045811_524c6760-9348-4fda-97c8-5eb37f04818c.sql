CREATE TABLE public.app_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name TEXT NOT NULL DEFAULT 'Supershop',
  tagline TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_address TEXT,
  facebook_url TEXT,
  website_url TEXT,
  footer_note TEXT,
  singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_branding TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_branding TO authenticated;
GRANT ALL ON public.app_branding TO service_role;

ALTER TABLE public.app_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read branding"
  ON public.app_branding FOR SELECT USING (true);

CREATE POLICY "Super admin manages branding"
  ON public.app_branding FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_app_branding_updated
  BEFORE UPDATE ON public.app_branding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_branding (site_name, tagline)
VALUES ('Supershop', 'মুদি দোকানের সম্পূর্ণ ম্যানেজমেন্ট সফটওয়্যার')
ON CONFLICT DO NOTHING;
