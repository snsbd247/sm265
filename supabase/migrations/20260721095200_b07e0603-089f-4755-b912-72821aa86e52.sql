
-- 1) audit_logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID,
  actor_email TEXT,
  actor_role TEXT,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_shop_idx ON public.audit_logs(shop_id, created_at DESC);
CREATE INDEX audit_logs_action_idx ON public.audit_logs(action, created_at DESC);
CREATE INDEX audit_logs_created_idx ON public.audit_logs(created_at DESC);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can view all audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin can insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 2) reminder tracking on subscription_payments
ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0;

-- 3) unique transaction_id (case-insensitive) — prevents double-submission
CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_txn_unique
  ON public.subscription_payments (lower(transaction_id))
  WHERE transaction_id IS NOT NULL;
