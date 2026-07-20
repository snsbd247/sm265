CREATE TABLE public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  shop_name text,
  message text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_requests TO authenticated;
GRANT INSERT ON public.demo_requests TO anon;
GRANT ALL ON public.demo_requests TO service_role;
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit demo requests" ON public.demo_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Super admins can view demo requests" ON public.demo_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can update demo requests" ON public.demo_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));