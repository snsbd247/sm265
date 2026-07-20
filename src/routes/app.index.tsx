import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyShop } from "@/lib/shop.functions";
import { getReportSnapshot, getDashboardExtras } from "@/lib/reports.functions";
import { listSales, listInstallments } from "@/lib/sales.functions";
import {
  Package, Wallet, TrendingUp, TrendingDown, Users, Receipt, CalendarClock,
  ShoppingCart, ArrowRight, AlertTriangle, PackageX,
  Coins, Smartphone, Trophy, Truck, LineChart as LineIcon, Plus,
} from "lucide-react";

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
  const shopFn = useServerFn(getMyShop);
  const snapFn = useServerFn(getReportSnapshot);
  const extraFn = useServerFn(getDashboardExtras);
  const salesFn = useServerFn(listSales);
  const instFn = useServerFn(listInstallments);

  const { data } = useQuery({ queryKey: ["my-shop"], queryFn: () => shopFn() });
  const snapQ = useQuery({ queryKey: ["report-snap"], queryFn: () => snapFn() });
  const extraQ = useQuery({ queryKey: ["dash-extras"], queryFn: () => extraFn() });
  const recentSalesQ = useQuery({ queryKey: ["recent-sales"], queryFn: () => salesFn({ data: {} }) });
  const overdueQ = useQuery({ queryKey: ["overdue-inst"], queryFn: () => instFn({ data: { status: "overdue" } }) });

  const shop = data?.shop;
  const end = shop?.subscription_end ? new Date(shop.subscription_end) : null;
  const daysLeft = end ? Math.ceil((end.getTime() - Date.now()) / (24 * 3600 * 1000)) : 0;
  const snap = snapQ.data;
  const extras = extraQ.data;

  const recent = (recentSalesQ.data ?? []).slice(0, 6);
  const overdue = (overdueQ.data as any)?.rows ?? [];

  const stats: { label: string; value: string; sub: string; icon: any; tone: Tone }[] = [
    { label: "আজকের বিক্রয়",  value: fmt(snap?.sales_today ?? 0),      sub: "আজকের মোট আয়",         icon: TrendingUp,   tone: "emerald" },
    { label: "এ মাসের বিক্রয়", value: fmt(snap?.sales_month ?? 0),      sub: "চলতি মাস",              icon: Receipt,      tone: "blue" },
    { label: "এ মাসের ক্রয়",   value: fmt(snap?.purchase_month ?? 0),   sub: "সাপ্লায়ার থেকে",         icon: TrendingDown, tone: "amber" },
    { label: "এ মাসের লাভ",    value: fmt(extras?.monthProfit ?? 0),    sub: `রেভিনিউ ${fmt(extras?.monthRevenue ?? 0)}`, icon: LineIcon, tone: "violet" },
    { label: "কাস্টমার বাকি",   value: fmt(snap?.customer_due ?? 0),     sub: "মোট বকেয়া",             icon: Wallet,       tone: "rose" },
    { label: "সাপ্লায়ার বাকি",  value: fmt(extras?.supplierDue ?? 0),   sub: "দিতে হবে",              icon: Truck,        tone: "orange" },
    { label: "পণ্য সংখ্যা",     value: num(extras?.productsCount ?? 0),  sub: `${num(extras?.lowStockCount ?? 0)} টি কম স্টক`, icon: Package, tone: "sky" },
    { label: "নগদ (আজ)",       value: `${fmt(extras?.cashInToday ?? 0)} / ${fmt(extras?.cashOutToday ?? 0)}`, sub: "ইন / আউট", icon: Coins, tone: "teal" },
  ];

  const trend = extras?.trend ?? [];
  const maxTrend = Math.max(1, ...trend.map((t: any) => Number(t.total || 0)));

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
                <p className={`mt-2 truncate text-2xl font-bold leading-tight ${toneValue[s.tone]}`}>{s.value}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{s.sub}</p>
              </div>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${toneChip[s.tone]}`}>
                <s.icon className="h-4.5 w-4.5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Trend + Overdue */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight text-slate-700">
              <LineIcon className="h-4 w-4 text-emerald-600" /> শেষ ৭ দিনের বিক্রয়
            </h2>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">লাইভ</span>
          </div>
          <div className="p-6">
            <div className="flex h-48 items-end gap-2">
              {trend.map((t: any) => {
                const h = Math.max(4, (Number(t.total) / maxTrend) * 100);
                const d = new Date(t.date);
                return (
                  <div key={t.date} className="group flex flex-1 flex-col items-center gap-1.5">
                    <div className="text-[10px] font-semibold text-slate-500 opacity-0 group-hover:opacity-100 transition">
                      {fmt(t.total)}
                    </div>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-emerald-500/80 transition-all hover:bg-emerald-600"
                        style={{ height: `${h}%` }}
                      />
                    </div>
                    <div className="text-[10px] font-medium text-slate-400">{d.getDate()}/{d.getMonth() + 1}</div>
                  </div>
                );
              })}
              {trend.length === 0 && <div className="w-full text-center text-sm text-slate-400">কোনো ডেটা নেই</div>}
            </div>
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
            {overdue.length === 0 ? (
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
