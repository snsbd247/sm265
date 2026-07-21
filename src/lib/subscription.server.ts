// Shared server-only activation logic — reused by admin approval and bKash callback
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function activatePaymentAndExtendShop(
  paymentId: string,
  opts?: { actorUserId?: string | null; actorEmail?: string | null; source?: string },
) {
  // Atomic idempotency claim: set paid_at while status is still pending.
  // Only the first caller wins; concurrent callers get no row back.
  const claim = await supabaseAdmin
    .from("subscription_payments")
    .update({ paid_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("status", "pending")
    .is("paid_at", null)
    .select("id")
    .maybeSingle();

  const { data: pay, error: payErr } = await supabaseAdmin
    .from("subscription_payments")
    .select("*")
    .eq("id", paymentId)
    .single();
  if (payErr || !pay) throw new Error(payErr?.message ?? "Payment not found");
  if (pay.status === "success") return { alreadyProcessed: true };
  if (!claim.data) {
    return { alreadyProcessed: true, skipped: true, currentStatus: pay.status };
  }

  const { data: shop } = await supabaseAdmin
    .from("shops")
    .select("*, package:packages!package_id(*), pending_package:packages!pending_package_id(*)")
    .eq("id", pay.shop_id)
    .single();
  if (!shop) throw new Error("Shop not found");

  const invoiceType = (pay.invoice_type ?? "renewal") as
    | "initial" | "renewal" | "upgrade" | "downgrade";

  const raw: any = pay.raw_response ?? {};
  let pkgId: string | null = raw.package_id ?? shop.package_id;
  let cycle: "monthly" | "yearly" = (raw.billing_cycle ?? shop.billing_cycle) as any;
  let months = cycle === "yearly" ? 12 : 1;

  if (pay.subscription_id) {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions").select("*").eq("id", pay.subscription_id).single();
    if (sub) {
      cycle = sub.billing_cycle as any;
      pkgId = sub.package_id;
      months = sub.billing_cycle === "yearly" ? 12 : 1;
    }
  }

  // For initial / upgrade: use pending package if present; period restarts from today
  if (invoiceType === "upgrade" && shop.pending_package_id) {
    pkgId = shop.pending_package_id;
    cycle = (shop.pending_billing_cycle ?? cycle) as any;
    months = cycle === "yearly" ? 12 : 1;
  }

  const start = new Date();
  const restartCycle = invoiceType === "initial" || invoiceType === "upgrade";
  const base = restartCycle
    ? new Date(start)
    : (shop.subscription_end && new Date(shop.subscription_end) > new Date()
        ? new Date(shop.subscription_end) : new Date());
  base.setMonth(base.getMonth() + months);

  await supabaseAdmin.from("shops").update({
    status: "active",
    subscription_end: base.toISOString(),
    subscription_start: restartCycle ? start.toISOString() : (shop.subscription_start ?? start.toISOString()),
    package_id: pkgId,
    billing_cycle: cycle,
    pending_package_id: null,
    pending_billing_cycle: null,
    // Consume credit on upgrade approval
    credit_balance: invoiceType === "upgrade" ? 0 : shop.credit_balance,
  }).eq("id", shop.id);

  await supabaseAdmin.from("subscription_payments").update({
    status: "success",
    paid_at: new Date().toISOString(),
  }).eq("id", pay.id);

  if (pay.subscription_id) {
    await supabaseAdmin.from("subscriptions").update({
      status: "active", ends_at: base.toISOString(),
    }).eq("id", pay.subscription_id);
  } else {
    await supabaseAdmin.from("subscriptions").insert({
      shop_id: shop.id,
      package_id: pkgId!,
      billing_cycle: cycle,
      amount: pay.amount,
      status: "active",
      starts_at: start.toISOString(),
      ends_at: base.toISOString(),
    });
  }

  // Audit log
  try {
    const { logAudit } = await import("./audit.server");
    await logAudit({
      actor_user_id: opts?.actorUserId ?? null,
      actor_email: opts?.actorEmail ?? null,
      actor_role: opts?.source ?? "system",
      shop_id: shop.id,
      action: invoiceType === "initial" ? "invoice.paid"
            : invoiceType === "upgrade" ? "package.changed"
            : "invoice.paid",
      target_type: "subscription_payment",
      target_id: pay.id,
      details: {
        invoice_no: (pay as any).invoice_no,
        invoice_type: invoiceType,
        amount: pay.amount,
        new_package_id: pkgId,
        billing_cycle: cycle,
        source: opts?.source ?? "manual",
      },
    });
  } catch (e) { console.error("audit failed", e); }

  // SMS notification
  try {
    const { sendTemplateSMS } = await import("./sms.server");
    const { data: pkgRow } = await supabaseAdmin
      .from("packages").select("name").eq("id", pkgId!).maybeSingle();
    const isUpgrade = invoiceType === "upgrade" || (pkgId && shop.package_id && pkgId !== shop.package_id);
    const endStr = new Date(base).toLocaleDateString("bn-BD");
    const code = invoiceType === "initial" ? "renewed" : (isUpgrade ? "upgraded" : "renewed");
    await sendTemplateSMS(code, shop.phone, {
      shop_name: shop.name, owner: shop.owner_name,
      package: pkgRow?.name ?? "", end_date: endStr, amount: pay.amount,
    }, { shopId: shop.id });
  } catch (e) {
    console.error("activation SMS failed", e);
  }

  return { alreadyProcessed: false, shopId: shop.id };
}
