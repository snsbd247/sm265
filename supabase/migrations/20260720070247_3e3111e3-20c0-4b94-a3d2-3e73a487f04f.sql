
CREATE TABLE public.impersonation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  admin_user_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.impersonation_tokens TO service_role;
ALTER TABLE public.impersonation_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (server functions) may access.

CREATE TABLE public.impersonation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'issued' | 'redeemed'
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.impersonation_audit TO authenticated;
GRANT ALL ON public.impersonation_audit TO service_role;
ALTER TABLE public.impersonation_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can view impersonation audit"
  ON public.impersonation_audit FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE INDEX idx_impersonation_audit_shop ON public.impersonation_audit(shop_id, created_at DESC);
CREATE INDEX idx_impersonation_tokens_token ON public.impersonation_tokens(token);
