// Audit log helper — server-only. Records who did what and when.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AuditAction =
  | "shop.created"
  | "shop.updated"
  | "shop.deleted"
  | "shop.status_changed"
  | "invoice.created"
  | "invoice.paid"
  | "invoice.approved"
  | "invoice.rejected"
  | "invoice.cancelled"
  | "invoice.trx_submitted"
  | "invoice.reminder_sent"
  | "invoice.webhook_processed"
  | "package.upgrade_requested"
  | "package.upgrade_cancelled"
  | "package.downgraded"
  | "package.changed"
  | "subscription.extended";

export async function logAudit(entry: {
  actor_user_id?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  shop_id?: string | null;
  action: AuditAction | string;
  target_type?: string | null;
  target_id?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: entry.actor_user_id ?? null,
      actor_email: entry.actor_email ?? null,
      actor_role: entry.actor_role ?? null,
      shop_id: entry.shop_id ?? null,
      action: entry.action,
      target_type: entry.target_type ?? null,
      target_id: entry.target_id ?? null,
      details: (entry.details ?? {}) as any,
    });
  } catch (e) {
    console.error("[audit] failed", entry.action, e);
  }
}

// Resolve actor email from auth for readable logs
export async function resolveActor(userId: string | null | undefined) {
  if (!userId) return { actor_email: null, actor_role: null };
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    return { actor_email: data.user?.email ?? null, actor_role: null };
  } catch {
    return { actor_email: null, actor_role: null };
  }
}