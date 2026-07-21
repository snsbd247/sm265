// Server-only helpers for package usage limits.
// -1 or null on a limit means unlimited.

export type LimitKind =
  | "products"
  | "users"
  | "sms"
  | "customers"
  | "invoices"
  | "invoice_total";

export interface UsageInfo {
  kind: LimitKind;
  used: number;
  limit: number | null; // null = unlimited
  remaining: number | null;
  exceeded: boolean;
  packageName: string | null;
}

export class LimitExceededError extends Error {
  code = "LIMIT_EXCEEDED";
  kind: LimitKind;
  used: number;
  limit: number;
  packageName: string | null;
  constructor(kind: LimitKind, used: number, limit: number, packageName: string | null) {
    const labels: Record<LimitKind, string> = {
      products: "পণ্যের",
      users: "ইউজারের",
      sms: "SMS-এর",
      customers: "কাস্টমারের",
      invoices: "মাসিক ইনভয়েসের",
      invoice_total: "মাসিক ইনভয়েস মূল্যের",
    };
    super(`আপনার প্যাকেজে ${labels[kind]} সর্বোচ্চ সীমা (${limit}) শেষ হয়েছে। প্যাকেজ আপগ্রেড করুন।`);
    this.kind = kind;
    this.used = used;
    this.limit = limit;
    this.packageName = packageName;
  }
}

function normalize(n: number | null | undefined): number | null {
  if (n == null) return null;
  if (n < 0) return null;
  return n;
}

export async function loadShopPackageLimits(supabase: any, shopId: string) {
  const { data: shop } = await supabase
    .from("shops")
    .select("package_id, package:packages(name, max_products, max_users, max_sms_per_month, max_customers, max_invoices_per_month, max_invoice_total_per_month)")
    .eq("id", shopId)
    .maybeSingle();
  const pkg = shop?.package as any;
  return {
    packageName: (pkg?.name as string) ?? null,
    products: normalize(pkg?.max_products),
    users: normalize(pkg?.max_users),
    sms: normalize(pkg?.max_sms_per_month),
    customers: normalize(pkg?.max_customers),
    invoices: normalize(pkg?.max_invoices_per_month),
    invoice_total: normalize(pkg?.max_invoice_total_per_month),
  };
}

export async function countUsage(supabase: any, shopId: string, kind: LimitKind): Promise<number> {
  if (kind === "products") {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId);
    return count ?? 0;
  }
  if (kind === "users") {
    const { data } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("shop_id", shopId);
    const uniq = new Set((data ?? []).map((r: any) => r.user_id));
    return uniq.size;
  }
  if (kind === "customers") {
    const { count } = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId);
    return count ?? 0;
  }
  if (kind === "invoices" || kind === "invoice_total") {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    if (kind === "invoices") {
      const { count } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shopId)
        .neq("status", "cancelled")
        .gte("sale_date", start.toISOString().slice(0, 10));
      return count ?? 0;
    }
    const { data } = await supabase
      .from("sales")
      .select("total")
      .eq("shop_id", shopId)
      .neq("status", "cancelled")
      .gte("sale_date", start.toISOString().slice(0, 10));
    return (data ?? []).reduce((s: number, r: any) => s + Number(r.total || 0), 0);
  }
  // sms — current calendar month
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("sms_logs")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .eq("status", "sent")
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

export async function getUsage(supabase: any, shopId: string, kind: LimitKind): Promise<UsageInfo> {
  const limits = await loadShopPackageLimits(supabase, shopId);
  const limit = limits[kind];
  const used = await countUsage(supabase, shopId, kind);
  return {
    kind,
    used,
    limit,
    remaining: limit == null ? null : Math.max(limit - used, 0),
    exceeded: limit != null && used >= limit,
    packageName: limits.packageName,
  };
}

/** Throws LimitExceededError if adding `delta` would exceed the limit. */
export async function enforceLimit(
  supabase: any,
  shopId: string,
  kind: LimitKind,
  delta = 1,
): Promise<void> {
  const info = await getUsage(supabase, shopId, kind);
  if (info.limit == null) return;
  if (info.used + delta > info.limit) {
    throw new LimitExceededError(kind, info.used, info.limit, info.packageName);
  }
}