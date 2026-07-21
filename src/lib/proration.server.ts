// Proration + package-change math. Server-only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PackageChange = {
  old_package_id: string | null;
  old_package_name: string | null;
  new_package_id: string;
  new_package_name: string;
  old_billing_cycle: "monthly" | "yearly" | null;
  new_billing_cycle: "monthly" | "yearly";
  old_amount: number; // what the current cycle originally cost
  new_amount: number; // sticker price of the new package/cycle
  total_days: number; // total days in the current cycle
  used_days: number; // days used so far in the current cycle
  remaining_days: number;
  unused_value: number; // credit from unused days of current package
  credit_applied: number; // shop.credit_balance applied
  net_amount: number; // >0 → pay; ≤0 → immediate downgrade with credit
  kind: "upgrade" | "downgrade" | "same";
};

const DAYS = (cycle: "monthly" | "yearly") => (cycle === "yearly" ? 365 : 30);

export async function computePackageChange(input: {
  shop_id: string;
  new_package_id: string;
  new_billing_cycle: "monthly" | "yearly";
}): Promise<PackageChange> {
  const { data: shop, error } = await supabaseAdmin
    .from("shops")
    .select("id, package_id, billing_cycle, subscription_start, subscription_end, credit_balance, package:packages!package_id(id, name, price_monthly, price_yearly)")
    .eq("id", input.shop_id)
    .single();
  if (error || !shop) throw new Error(error?.message ?? "Shop not found");

  const { data: newPkg, error: pkgErr } = await supabaseAdmin
    .from("packages").select("id, name, price_monthly, price_yearly")
    .eq("id", input.new_package_id).single();
  if (pkgErr || !newPkg) throw new Error(pkgErr?.message ?? "Package not found");

  const oldCycle = (shop.billing_cycle ?? null) as "monthly" | "yearly" | null;
  const oldPkg: any = shop.package;
  const oldAmount = oldCycle && oldPkg
    ? Number(oldCycle === "monthly" ? oldPkg.price_monthly : oldPkg.price_yearly) || 0
    : 0;
  const newAmount = Number(input.new_billing_cycle === "monthly" ? newPkg.price_monthly : newPkg.price_yearly) || 0;

  // Compute unused value from current cycle
  let totalDays = 0;
  let usedDays = 0;
  let unusedValue = 0;
  if (oldCycle && shop.subscription_start && shop.subscription_end) {
    totalDays = DAYS(oldCycle);
    const start = new Date(shop.subscription_start).getTime();
    const now = Date.now();
    usedDays = Math.max(0, Math.floor((now - start) / 86400_000));
    if (usedDays > totalDays) usedDays = totalDays;
    const remaining = Math.max(0, totalDays - usedDays);
    const daily = totalDays > 0 ? oldAmount / totalDays : 0;
    unusedValue = Math.round(daily * remaining);
  }

  const creditBalance = Number(shop.credit_balance ?? 0);
  const net = Math.round(newAmount - unusedValue - creditBalance);

  const samePkg = shop.package_id === input.new_package_id && oldCycle === input.new_billing_cycle;
  const kind: PackageChange["kind"] = samePkg ? "same" : net > 0 ? "upgrade" : "downgrade";

  return {
    old_package_id: shop.package_id ?? null,
    old_package_name: oldPkg?.name ?? null,
    new_package_id: newPkg.id,
    new_package_name: newPkg.name,
    old_billing_cycle: oldCycle,
    new_billing_cycle: input.new_billing_cycle,
    old_amount: oldAmount,
    new_amount: newAmount,
    total_days: totalDays,
    used_days: usedDays,
    remaining_days: Math.max(0, totalDays - usedDays),
    unused_value: unusedValue,
    credit_applied: Math.min(creditBalance, Math.max(0, newAmount - unusedValue)),
    net_amount: net,
    kind,
  };
}

// Immediate switch (downgrade or same-or-lower); adds absolute net to credit_balance
export async function applyImmediateDowngrade(shopId: string, change: PackageChange) {
  const newCredit = Math.max(0, -change.net_amount); // amount added to credit
  const start = new Date();
  const end = new Date(start);
  const days = DAYS(change.new_billing_cycle);
  end.setDate(end.getDate() + days);

  await supabaseAdmin.from("shops").update({
    package_id: change.new_package_id,
    billing_cycle: change.new_billing_cycle,
    subscription_start: start.toISOString(),
    subscription_end: end.toISOString(),
    credit_balance: newCredit, // reset then add
    pending_package_id: null,
    pending_billing_cycle: null,
  }).eq("id", shopId);

  await supabaseAdmin.from("subscriptions").insert({
    shop_id: shopId,
    package_id: change.new_package_id,
    billing_cycle: change.new_billing_cycle,
    amount: change.new_amount,
    status: "active",
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
  });
}