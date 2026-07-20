GRANT SELECT ON public.packages TO anon;
CREATE POLICY "Anyone can view active packages" ON public.packages FOR SELECT TO anon USING (is_active = true);