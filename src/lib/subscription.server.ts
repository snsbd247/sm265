// Shared server-only activation logic — reused by admin approval and bKash callback
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function activatePaymentAndExtendShop(paymentId: string) {
  const { data: pay, error: payErr } = await supabaseAdmin
    .from("subscription_payments")
    .select("*")
    .eq("id", paymentId)
    .single();
  if (payErr || !pay) throw new Error(payErr?.message ?? "Payment not found");
  if (pay.status === "success") return { alreadyProcessed: true };

  const { data: shop } = await supabaseAdmin
    .from("shops")
    .select("*, package:packages(*)")
    .eq("id", pay.shop_id)
    .single();
  if (!shop) throw new Error("Shop not found");

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

  const base = shop.subscription_end && new Date(shop.subscription_end) > new Date()
    ? new Date(shop.subscription_end) : new Date();
  const start = new Date();
  base.setMonth(base.getMonth() + months);

  await supabaseAdmin.from("shops").update({
    status: "active",
    subscription_end: base.toISOString(),
    subscription_start: shop.subscription_start ?? start.toISOString(),
    package_id: pkgId,
    billing_cycle: cycle,
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

  // SMS notification
  try {
    const { sendTemplateSMS } = await import("./sms.server");
    const { data: pkgRow } = await supabaseAdmin
      .from("packages").select("name").eq("id", pkgId!).maybeSingle();
    const isUpgrade = pkgId && shop.package_id && pkgId !== shop.package_id;
    const endStr = new Date(base).toLocaleDateString("bn-BD");
    const code = isUpgrade ? "upgraded" : "renewed";
    await sendTemplateSMS(code, shop.phone, {
      shop_name: shop.name, owner: shop.owner_name,
      package: pkgRow?.name ?? "", end_date: endStr, amount: pay.amount,
    }, { shopId: shop.id });
  } catch (e) {
    console.error("activation SMS failed", e);
  }

  return { alreadyProcessed: false, shopId: shop.id };
}
