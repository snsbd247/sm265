import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyShop } from "@/lib/shop.functions";
import { getReportSnapshot, getDashboardExtras, getShopTrend } from "@/lib/reports.functions";
import { listSales, listInstallments } from "@/lib/sales.functions";
import {
  Package, Wallet, TrendingUp, TrendingDown, Users, Receipt, CalendarClock,
  ShoppingCart, ArrowRight, AlertTriangle, PackageX,
  Coins, Smartphone, Trophy, Truck, LineChart as LineIcon, Plus, Warehouse, Rows3, Grid3x3,
} from "lucide-react";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { KpiSkeleton, BlockSkeleton } from "@/components/dashboard/kpi-skeleton";
import { useEffect, useMemo, useState } from "react";
import { KpiDialog, type DrillColumn } from "@/components/dashboard/kpi-dialog";
import { CardMeta } from "@/components/dashboard/card-meta";
import { withTiming, dashboardRetry, dashboardRetryDelay, notifyQueryError } from "@/lib/query-timing";

export const Route = createFileRoute("/app/")({ component: ShopDashboard });

const fmt = (n: number) => `৳${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 0 })}`;
const num = (n: number) => Number(n || 0).toLocaleString("bn-BD");

type Tone = "emerald" | "blue" | "amber" | "violet" | "rose" | "orange" | "sky" | "teal" | "pink";
const toneChip: Record<Tone, string> = {
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  blue:    "bg-blue-50 text-blue-600 border-blue-100",
  amber:   "bg-amber-50 text-amber-600 border-amber-100",
  violet:  "bg-violet-50 text-violet-600 border-violet-100",
  rose:    "bg-rose-50 text-rose-600 border-rose-100",
  orange:  "bg-orange-50 text-orange-600 border-orange-100",
  sky:     "bg-sky-50 text-sky-600 border-sky-100",
  teal:    "bg-teal-50 text-teal-600 border-teal-100",
  pink:    "bg-pink-50 text-pink-600 border-pink-100",
};
const toneValue: Record<Tone, string> = {
  emerald: "text-emerald-700", blue: "text-slate-900", amber: "text-slate-900",
  violet: "text-violet-700", rose: "text-rose-600", orange: "text-orange-600",
  sky: "text-slate-900", teal: "text-teal-700", pink: "text-pink-600",
};

function ShopDashboard() {
  const shopFnRaw = useServerFn(getMyShop);
  const snapFnRaw = useServerFn(getReportSnapshot);
  const extraFnRaw = useServerFn(getDashboardExtras);
  const trendFnRaw = useServerFn(getShopTrend);
  const salesFnRaw = useServerFn(listSales);
  const instFnRaw = useServerFn(listInstallments);

  // Wrap once so the timing/error handler identity is stable across renders.
  const shopFn = useMemo(() => withTiming(shopFnRaw, { label: "my-shop" }), [shopFnRaw]);
  const snapFn = useMemo(() => withTiming(snapFnRaw, { label: "report-snap" }), [snapFnRaw]);
  const extraFn = useMemo(() => withTiming(extraFnRaw, { label: "dashboard-extras", slowMs: 2500 }), [extraFnRaw]);
  const trendFn = useMemo(() => withTiming(trendFnRaw, { label: "shop-trend" }), [trendFnRaw]);
  const salesFn = useMemo(() => withTiming(salesFnRaw, { label: "recent-sales" }), [salesFnRaw]);
  const instFn = useMemo(() => withTiming(instFnRaw, { label: "overdue-installments" }), [instFnRaw]);

  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [compact, setCompact] = useState(false);
  type Drill = null | "today" | "month" | "due" | "lowStock" | "topProducts" | "purchaseMonth" | "supplierDue" | "cashToday" | "products";
  const [drill, setDrill] = useState<Drill>(null);

  const commonRetry = { retry: dashboardRetry, retryDelay: dashboardRetryDelay } as const;
  const { data, error: shopErr } = useQuery({ queryKey: ["my-shop"], queryFn: () => shopFn(), ...commonRetry });
  const snapQ = useQuery({ queryKey: ["report-snap"], queryFn: () => snapFn(), refetchInterval: 60_000, ...commonRetry });
  const extraQ = useQuery({ queryKey: ["dash-extras"], queryFn: () => extraFn(), refetchInterval: 60_000, ...commonRetry });
  const trendQ = useQuery({ queryKey: ["shop-trend", range], queryFn: () => trendFn({ data: { days: range } }), refetchInterval: 120_000, ...commonRetry });
  const recentSalesQ = useQuery({ queryKey: ["recent-sales"], queryFn: () => salesFn({ data: {} }), refetchInterval: 60_000, ...commonRetry });
  const overdueQ = useQuery({ queryKey: ["overdue-inst"], queryFn: () => instFn({ data: { status: "overdue" } }), refetchInterval: 60_000, ...commonRetry });

  // Surface any final query error as a toast (rate-limited inside helper).
  useEffect(() => { if (shopErr) notifyQueryError("দোকানের তথ্য", shopErr); }, [shopErr]);
  useEffect(() => { if (snapQ.error) notifyQueryError("রিপোর্ট স্ন্যাপশট", snapQ.error); }, [snapQ.error]);
  useEffect(() => { if (extraQ.error) notifyQueryError("ড্যাশবোর্ড ডেটা", extraQ.error); }, [extraQ.error]);
  useEffect(() => { if (trendQ.error) notifyQueryError("ট্রেন্ড চার্ট", trendQ.error); }, [trendQ.error]);
  useEffect(() => { if (recentSalesQ.error) notifyQueryError("সাম্প্রতিক বিক্রয়", recentSalesQ.error); }, [recentSalesQ.error]);
  useEffect(() => { if (overdueQ.error) notifyQueryError("বকেয়া কিস্তি", overdueQ.error); }, [overdueQ.error]);

  const shop = data?.shop;
  const end = shop?.subscription_end ? new Date(shop.subscription_end) : null;
  const daysLeft = end ? Math.ceil((end.getTime() - Date.now()) / (24 * 3600 * 1000)) : 0;
  const snap = snapQ.data;
  const extras = extraQ.data;
  const isLoading = snapQ.isLoading || extraQ.isLoading;

  const recent = (recentSalesQ.data ?? []).slice(0, 6);
  const overdue = (overdueQ.data as any)?.rows ?? [];
  const allRecentSales = (recentSalesQ.data ?? []) as any[];
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = allRecentSales.filter((s: any) => (s.sale_date ?? "").slice(0, 10) === today);
  const monthStartStr = today.slice(0, 8) + "01";
  const monthSales = allRecentSales.filter((s: any) => (s.sale_date ?? "") >= monthStartStr && (s.sale_date ?? "") <= today);

  const monthStartLabel = monthStartStr.split("-").slice(1).join("-");
  type Stat = { label: string; value: string; sub: string; icon: any; tone: Tone; drill?: Drill; source: string; filter: string };
  const stats: Stat[] = [
    { label: "আজকের বিক্রয়",  value: fmt(snap?.sales_today ?? 0),      sub: "আজকের মোট আয়",         icon: TrendingUp,   tone: "emerald", drill: "today", source: "sales", filter: `sale_date = ${today}` },
    { label: "এ মাসের বিক্রয়", value: fmt(snap?.sales_month ?? 0),      sub: "চলতি মাস",              icon: Receipt,      tone: "blue", drill: "month", source: "sales", filter: `sale_date ${monthStartLabel} → আজ` },
    { label: "এ মাসের ক্রয়",   value: fmt(snap?.purchase_month ?? 0),   sub: "সাপ্লায়ার থেকে",         icon: TrendingDown, tone: "amber", drill: "purchaseMonth", source: "purchases", filter: `purchase_date ${monthStartLabel} → আজ` },
    { label: "এ মাসের লাভ",    value: fmt(extras?.monthProfit ?? 0),    sub: `রেভিনিউ ${fmt(extras?.monthRevenue ?? 0)}`, icon: LineIcon, tone: "violet", drill: "topProducts", source: "sale_items ⋈ sales", filter: `চলতি মাস` },
    { label: "কাস্টমার বাকি",   value: fmt(snap?.customer_due ?? 0),     sub: "মোট বকেয়া",             icon: Wallet,       tone: "rose", drill: "due", source: "customers", filter: "current_balance > 0" },
    { label: "সাপ্লায়ার বাকি",  value: fmt(extras?.supplierDue ?? 0),   sub: "দিতে হবে",              icon: Truck,        tone: "orange", drill: "supplierDue", source: "suppliers", filter: "current_balance > 0" },
    { label: "স্টক ভ্যালু",     value: fmt(extras?.stockValue ?? 0),     sub: `রিটেইল ${fmt(extras?.stockRetailValue ?? 0)}`, icon: Warehouse, tone: "sky", drill: "lowStock", source: "products", filter: "is_active = true" },
    { label: "পণ্য সংখ্যা",     value: num(extras?.productsCount ?? 0),  sub: `${num(extras?.lowStockCount ?? 0)} টি কম স্টক`, icon: Package, tone: "pink", drill: "products", source: "products", filter: "is_active = true" },
    { label: "নগদ (আজ)",       value: `${fmt(extras?.cashInToday ?? 0)} / ${fmt(extras?.cashOutToday ?? 0)}`, sub: "ইন / আউট", icon: Coins, tone: "teal", drill: "cashToday", source: "customer_payments + supplier_payments", filter: `payment_date = ${today}` },
  ];

  const salesCols: DrillColumn[] = [
    { key: "invoice_no", label: "ইনভয়েস", render: (r: any) => `#${r.invoice_no ?? r.id.slice(0, 8)}` },
    { key: "customer", label: "কাস্টমার", render: (r: any) => r.customer?.name ?? "Walk-in" },
    { key: "sale_date", label: "তারিখ", render: (r: any) => new Date(r.sale_date).toLocaleDateString("bn-BD") },
    { key: "total", label: "মোট", align: "right", render: (r: any) => fmt(r.total) },
    { key: "due", label: "বাকি", align: "right", render: (r: any) => Number(r.due) > 0 ? <span className="font-semibold text-rose-600">{fmt(r.due)}</span> : "-" },
  ];
  const customerDueCols: DrillColumn[] = [
    { key: "name", label: "কাস্টমার" },
    { key: "phone", label: "মোবাইল", render: (r: any) => r.phone ?? "-" },
    { key: "current_balance", label: "বাকি", align: "right", render: (r: any) => <span className="font-semibold text-rose-600">{fmt(r.current_balance)}</span> },
  ];
  const supplierDueCols: DrillColumn[] = [
    { key: "name", label: "সাপ্লায়ার" },
    { key: "phone", label: "মোবাইল", render: (r: any) => r.phone ?? "-" },
    { key: "current_balance", label: "বাকি", align: "right", render: (r: any) => <span className="font-semibold text-orange-600">{fmt(r.current_balance)}</span> },
  ];
  const purchaseCols: DrillColumn[] = [
    { key: "invoice_no", label: "ইনভয়েস", render: (r: any) => `#${r.invoice_no ?? r.id.slice(0,8)}` },
    { key: "supplier", label: "সাপ্লায়ার", render: (r: any) => r.supplier?.name ?? "-" },
    { key: "purchase_date", label: "তারিখ", render: (r: any) => new Date(r.purchase_date).toLocaleDateString("bn-BD") },
    { key: "total", label: "মোট", align: "right", render: (r: any) => fmt(r.total) },
    { key: "due", label: "বাকি", align: "right", render: (r: any) => Number(r.due) > 0 ? <span className="font-semibold text-rose-600">{fmt(r.due)}</span> : "-" },
  ];
  const cashCols: DrillColumn[] = [
    { key: "type", label: "ধরন", render: (r: any) => r._kind === "in" ? <span className="text-emerald-700">ইন</span> : <span className="text-rose-600">আউট</span> },
    { key: "party", label: "পার্টি", render: (r: any) => r.customer?.name ?? r.supplier?.name ?? "-" },
    { key: "payment_method", label: "মাধ্যম" },
    { key: "amount", label: "পরিমাণ", align: "right", render: (r: any) => fmt(r.amount) },
  ];
  const lowStockCols: DrillColumn[] = [
    { key: "name", label: "পণ্য" },
    { key: "stock_quantity", label: "স্টক", align: "right", render: (r: any) => `${num(r.stock_quantity)} ${r.unit?.short_name ?? ""}` },
    { key: "low_stock_alert", label: "Alert", align: "right", render: (r: any) => num(r.low_stock_alert) },
  ];
  const productsCols: DrillColumn[] = [
    { key: "name", label: "পণ্য" },
    { key: "stock_quantity", label: "স্টক", align: "right", render: (r: any) => `${num(r.stock_quantity)} ${r.unit?.short_name ?? ""}` },
    { key: "sale_price", label: "বিক্রয় মূল্য", align: "right", render: (r: any) => fmt(r.sale_price) },
  ];
  const topCols: DrillColumn[] = [
    { key: "name", label: "পণ্য" },
    { key: "qty", label: "একক", align: "right", render: (r: any) => num(r.qty) },
    { key: "revenue", label: "রেভিনিউ", align: "right", render: (r: any) => fmt(r.revenue) },
  ];
  const cashRows = [
    ...((extras?.cashInTodayRows ?? []) as any[]).map((r) => ({ ...r, _kind: "in" })),
    ...((extras?.cashOutTodayRows ?? []) as any[]).map((r) => ({ ...r, _kind: "out" })),
  ];

  const trendData = trendQ.data ?? [];

  return (
    <div className="space-y-6 p-4 sm:p-8">
      {/* Page header */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">ড্যাশবোর্ড</h1>
          <p className="mt-1 truncate text-sm text-slate-500">
            স্বাগতম, <span className="font-medium text-slate-700">{shop?.owner_name}</span> • {shop?.name} • প্যাকেজ: {shop?.package?.name ?? "-"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setCompact((v) => !v)}
            title={compact ? "স্বাভাবিক ভিউ" : "কম্প্যাক্ট ভিউ"}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {compact ? <Grid3x3 className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}
            {compact ? "নরমাল" : "কম্প্যাক্ট"}
          </button>
          {daysLeft <= 7 && daysLeft >= 0 && (
            <Link to="/app/subscription"
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                daysLeft <= 2
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}>
              <AlertTriangle className="h-3.5 w-3.5" /> {daysLeft} দিনে শেষ
            </Link>
          )}
          <Link to="/app/sales/new"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
            <Plus className="h-4 w-4" /> নতুন বিক্রয়
          </Link>
        </div>
      </div>

      {/* KPI grid */}
      {isLoading ? (
        <KpiSkeleton count={stats.length} compact={compact} />
      ) : (
      <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${compact ? "xl:grid-cols-6" : "xl:grid-cols-3"}`}>
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => s.drill && setDrill(s.drill)}
            disabled={!s.drill}
            className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition ${
              s.drill ? "cursor-pointer hover:border-emerald-200 hover:shadow-md" : "cursor-default"
            } ${compact ? "p-3" : "p-5"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
                <p className={`mt-2 truncate font-bold leading-tight ${compact ? "text-lg" : "text-2xl"} ${toneValue[s.tone]}`}>{s.value}</p>
                {!compact && <p className="mt-1 truncate text-xs text-slate-500">{s.sub}</p>}
              </div>
              <div className={`flex shrink-0 items-center justify-center rounded-lg border ${toneChip[s.tone]} ${compact ? "h-7 w-7" : "h-9 w-9"}`}>
                <s.icon className="h-4.5 w-4.5" />
              </div>
            </div>
            {!compact && <CardMeta source={s.source} filter={s.filter} />}
          </button>
        ))}
      </div>
      )}

      <KpiDialog
        open={drill === "today"} onOpenChange={(v) => !v && setDrill(null)}
        title="আজকের বিক্রয়" subtitle={`${todaySales.length} টি ইনভয়েস • ${fmt(snap?.sales_today ?? 0)}`}
        source={`sales · sale_date = ${today}`}
        columns={salesCols} rows={todaySales}
        loading={recentSalesQ.isLoading} error={recentSalesQ.error as Error | null}
        onRetry={() => recentSalesQ.refetch()}
      />
      <KpiDialog
        open={drill === "month"} onOpenChange={(v) => !v && setDrill(null)}
        title="এ মাসের বিক্রয়" subtitle={`${monthSales.length} টি ইনভয়েস • ${fmt(snap?.sales_month ?? 0)}`}
        source={`sales · sale_date ${monthStartLabel} → আজ`}
        columns={salesCols} rows={monthSales.slice(0, 200)}
        loading={recentSalesQ.isLoading} error={recentSalesQ.error as Error | null}
        onRetry={() => recentSalesQ.refetch()}
      />
      <KpiDialog
        open={drill === "due"} onOpenChange={(v) => !v && setDrill(null)}
        title="কাস্টমার বাকি" subtitle={`${(extras?.customersWithDue ?? []).length} জন • মোট ${fmt(snap?.customer_due ?? 0)}`}
        source="customers · current_balance > 0"
        columns={customerDueCols} rows={(extras?.customersWithDue ?? []) as any[]}
        loading={extraQ.isLoading} error={extraQ.error as Error | null}
        onRetry={() => extraQ.refetch()}
      />
      <KpiDialog
        open={drill === "supplierDue"} onOpenChange={(v) => !v && setDrill(null)}
        title="সাপ্লায়ার বাকি" subtitle={`${(extras?.suppliersWithDue ?? []).length} জন • মোট ${fmt(extras?.supplierDue ?? 0)}`}
        source="suppliers · current_balance > 0"
        columns={supplierDueCols} rows={(extras?.suppliersWithDue ?? []) as any[]}
        loading={extraQ.isLoading} error={extraQ.error as Error | null}
        onRetry={() => extraQ.refetch()}
      />
      <KpiDialog
        open={drill === "purchaseMonth"} onOpenChange={(v) => !v && setDrill(null)}
        title="এ মাসের ক্রয়" subtitle={`${(extras?.monthPurchases ?? []).length} টি • ${fmt(snap?.purchase_month ?? 0)}`}
        source={`purchases · purchase_date ${monthStartLabel} → আজ`}
        columns={purchaseCols} rows={(extras?.monthPurchases ?? []) as any[]}
        loading={extraQ.isLoading} error={extraQ.error as Error | null}
        onRetry={() => extraQ.refetch()}
      />
      <KpiDialog
        open={drill === "cashToday"} onOpenChange={(v) => !v && setDrill(null)}
        title="আজকের ক্যাশ লেনদেন" subtitle={`ইন ${fmt(extras?.cashInToday ?? 0)} • আউট ${fmt(extras?.cashOutToday ?? 0)}`}
        source={`customer_payments + supplier_payments · payment_date = ${today}`}
        columns={cashCols} rows={cashRows}
        loading={extraQ.isLoading} error={extraQ.error as Error | null}
        onRetry={() => extraQ.refetch()}
      />
      <KpiDialog
        open={drill === "products"} onOpenChange={(v) => !v && setDrill(null)}
        title="সব পণ্য" subtitle={`${num(extras?.productsCount ?? 0)} টি • ${num(extras?.lowStockCount ?? 0)} টি কম স্টক`}
        source="products · is_active = true"
        columns={productsCols} rows={(extras?.productsAll ?? []) as any[]}
        loading={extraQ.isLoading} error={extraQ.error as Error | null}
        onRetry={() => extraQ.refetch()}
      />
      <KpiDialog
        open={drill === "lowStock"} onOpenChange={(v) => !v && setDrill(null)}
        title="স্টক শেষ প্রায়" subtitle={`${extras?.lowStockCount ?? 0} টি পণ্য`}
        source="products · stock_quantity ≤ low_stock_alert"
        columns={lowStockCols} rows={(extras?.lowStockAll ?? extras?.lowStock ?? []) as any[]}
        loading={extraQ.isLoading} error={extraQ.error as Error | null}
        onRetry={() => extraQ.refetch()}
      />
      <KpiDialog
        open={drill === "topProducts"} onOpenChange={(v) => !v && setDrill(null)}
        title="টপ পণ্য (এ মাস)" subtitle={`রেভিনিউ ${fmt(extras?.monthRevenue ?? 0)} • লাভ ${fmt(extras?.monthProfit ?? 0)}`}
        source="sale_items · চলতি মাস"
        columns={topCols} rows={(extras?.topProducts ?? []) as any[]}
        loading={extraQ.isLoading} error={extraQ.error as Error | null}
        onRetry={() => extraQ.refetch()}
      />

      {/* Trend + Overdue */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight text-slate-700">
              <LineIcon className="h-4 w-4 text-emerald-600" /> বিক্রয় / ক্রয় / কালেকশন
            </h2>
            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold">
              {([7, 30, 90] as const).map((d) => (
                <button key={d} onClick={() => setRange(d)}
                  className={`rounded px-2 py-0.5 transition ${range === d ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  {d}দিন
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            {trendQ.isLoading ? (
              <div className="h-[260px] w-full animate-pulse rounded-lg bg-slate-100" />
            ) : trendData.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-400">কোনো ডেটা নেই</div>
            ) : (
              <TrendChart
                data={trendData}
                compact={compact}
                yFormatter={(v) => fmt(v)}
                series={[
                  { key: "sales", label: "বিক্রয়", color: "#10b981" },
                  { key: "purchases", label: "ক্রয়", color: "#f59e0b" },
                  { key: "collections", label: "কালেকশন", color: "#3b82f6" },
                ]}
              />
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight text-slate-700">
              <CalendarClock className="h-4 w-4 text-rose-500" /> বকেয়া কিস্তি
            </h2>
            <Link to="/app/installments" className="text-[11px] font-semibold text-emerald-600 hover:underline">সব</Link>
          </div>
          <div className="p-4">
            {overdueQ.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}</div>
            ) : overdue.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">সব ক্লিয়ার ✓</p>
            ) : (
              <div className="space-y-2">
                {overdue.slice(0, 5).map((i: any) => (
                  <div key={i.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-sm">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <span className="truncate font-semibold text-slate-800">{i.sale?.customer?.name ?? "-"}</span>
                      <span className="font-bold text-rose-600">{fmt(Number(i.amount) - Number(i.paid_amount || 0))}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{i.due_date} • #{i.sale?.invoice_no}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent sales table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold uppercase tracking-tight text-slate-700">সাম্প্রতিক বিক্রয়</h2>
          <Link to="/app/sales" className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:underline">
            সব দেখুন <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">এখনো বিক্রয় নেই</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50/60 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-5 py-3">ইনভয়েস</th>
                  <th className="px-5 py-3">কাস্টমার</th>
                  <th className="px-5 py-3">তারিখ</th>
                  <th className="px-5 py-3 text-right">পরিমাণ</th>
                  <th className="px-5 py-3 text-right">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link to="/app/sales/$saleId" params={{ saleId: s.id }} className="font-semibold text-slate-800 hover:text-emerald-700">
                        #{s.invoice_no ?? s.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{s.customer?.name ?? "Walk-in"}</td>
                    <td className="px-5 py-3 text-slate-500">{new Date(s.sale_date).toLocaleDateString("bn-BD")}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900">{fmt(s.total)}</td>
                    <td className="px-5 py-3 text-right">
                      {Number(s.due) > 0 ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">বাকি {fmt(s.due)}</span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">পেইড</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top + Low + Payments */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight text-slate-700">
              <Trophy className="h-4 w-4 text-amber-500" /> এ মাসের টপ পণ্য
            </h2>
          </div>
          <div className="p-2">
            {(extras?.topProducts ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">এখনো ডেটা নেই</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {extras!.topProducts.map((p: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-sm">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-[11px] font-bold text-amber-700">{idx + 1}</span>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-800">{p.name}</div>
                      <div className="text-[11px] text-slate-500">{num(p.qty)} একক</div>
                    </div>
                    <div className="text-right text-sm font-bold text-emerald-700">{fmt(p.revenue)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight text-slate-700">
              <PackageX className="h-4 w-4 text-rose-500" /> স্টক শেষ প্রায়
            </h2>
            <Link to="/app/products" className="text-[11px] font-semibold text-emerald-600 hover:underline">সব</Link>
          </div>
          <div className="p-2">
            {(extras?.lowStock ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">সব ঠিক আছে ✓</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {extras!.lowStock.map((p: any) => (
                  <Link key={p.id} to="/app/products/$productId" params={{ productId: p.id }}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50/60">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-800">{p.name}</div>
                      <div className="text-[11px] text-slate-500">Alert: {num(p.low_stock_alert)} {p.unit?.short_name ?? ""}</div>
                    </div>
                    <span className="rounded-md border border-rose-100 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600">
                      {num(p.stock_quantity)} {p.unit?.short_name ?? ""}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight text-slate-700">
              <Smartphone className="h-4 w-4 text-violet-500" /> আজকের পেমেন্ট
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <MiniStat label="নগদ ইন"  value={fmt(extras?.cashInToday ?? 0)}  tone="emerald" />
            <MiniStat label="বিকাশ ইন" value={fmt(extras?.bkashInToday ?? 0)} tone="pink" />
            <MiniStat label="নগদ আউট" value={fmt(extras?.cashOutToday ?? 0)} tone="amber" />
            <MiniStat label="বিকাশ আউট" value={fmt(extras?.bkashOutToday ?? 0)} tone="rose" />
          </div>
        </div>
      </div>

      {/* Quick actions row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink to="/app/sales/new"     label="নতুন বিক্রয়" icon={Receipt}       tone="emerald" />
        <QuickLink to="/app/purchases/new" label="নতুন ক্রয়"    icon={ShoppingCart} tone="blue" />
        <QuickLink to="/app/products"      label="পণ্য"          icon={Package}      tone="violet" />
        <QuickLink to="/app/customers"     label="কাস্টমার"      icon={Users}        tone="orange" />
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const border: Record<Tone, string> = {
    emerald: "border-emerald-100", blue: "border-blue-100", amber: "border-amber-100",
    violet: "border-violet-100", rose: "border-rose-100", orange: "border-orange-100",
    sky: "border-sky-100", teal: "border-teal-100", pink: "border-pink-100",
  };
  return (
    <div className={`rounded-lg border bg-slate-50/40 p-3 ${border[tone]}`}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      <div className={`mt-1 text-base font-bold ${toneValue[tone]}`}>{value}</div>
    </div>
  );
}

function QuickLink({ to, label, icon: Icon, tone }: { to: string; label: string; icon: any; tone: Tone }) {
  return (
    <Link to={to as any}
      className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${toneChip[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-slate-800">{label}</span>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
    </Link>
  );
}
