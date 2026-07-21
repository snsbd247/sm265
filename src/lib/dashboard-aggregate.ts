// Pure helpers used by dashboard server functions and unit tests.
// Keeping these framework-free lets us cover drill-down math without
// spinning up a Supabase mock.

export type PaymentRow = { amount: number | string | null; payment_method?: string | null; payment_date?: string | null };
export type SaleItemRow = {
  product_id?: string | null;
  quantity: number | string | null;
  unit_cost?: number | string | null;
  line_total?: number | string | null;
  product?: { name?: string | null } | null;
};
export type ProductRow = {
  stock_quantity?: number | string | null;
  low_stock_alert?: number | string | null;
  purchase_price?: number | string | null;
  sale_price?: number | string | null;
};

const n = (v: unknown) => Number(v ?? 0) || 0;

export function sumBy<T>(arr: T[] | null | undefined, pick: (r: T) => number, filter: (r: T) => boolean = () => true): number {
  if (!arr) return 0;
  let s = 0;
  for (const r of arr) if (filter(r)) s += pick(r);
  return s;
}

export function sumPositive<T>(arr: T[] | null | undefined, pick: (r: T) => number): number {
  return sumBy(arr, (r) => Math.max(pick(r), 0));
}

export function cashFor(payments: PaymentRow[] | null | undefined, opts: { date: string; method: string }): number {
  return sumBy(payments, (r) => n(r.amount), (r) => r.payment_date === opts.date && r.payment_method === opts.method);
}

export function stockValues(products: ProductRow[] | null | undefined) {
  let cost = 0, retail = 0, low = 0;
  for (const p of products ?? []) {
    const q = n(p.stock_quantity);
    cost += q * n(p.purchase_price);
    retail += q * n(p.sale_price);
    if (q <= n(p.low_stock_alert)) low++;
  }
  return { cost, retail, lowStockCount: low, productsCount: (products ?? []).length };
}

export function monthProfitFromItems(items: SaleItemRow[] | null | undefined): { revenue: number; cost: number; profit: number } {
  let revenue = 0, cost = 0;
  for (const it of items ?? []) {
    const q = n(it.quantity);
    revenue += n(it.line_total);
    cost += n(it.unit_cost) * q;
  }
  return { revenue, cost, profit: revenue - cost };
}

export function topProductsFromItems(items: SaleItemRow[] | null | undefined, limit = 5) {
  const map = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const it of items ?? []) {
    const key = it.product_id ?? "unknown";
    const cur = map.get(key) ?? { name: it.product?.name ?? "-", qty: 0, revenue: 0 };
    cur.qty += n(it.quantity);
    cur.revenue += n(it.line_total);
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, limit);
}

export function dailyTrendMap(days: string[], rows: { date: string; total: number | string | null }[] | null | undefined) {
  const m = new Map<string, number>();
  for (const d of days) m.set(d, 0);
  for (const r of rows ?? []) {
    const d = String(r.date).slice(0, 10);
    if (m.has(d)) m.set(d, (m.get(d) ?? 0) + n(r.total));
  }
  return days.map((d) => ({ date: d, total: m.get(d) ?? 0 }));
}