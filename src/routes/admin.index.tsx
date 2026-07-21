import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminStats, listShops, getAdminExtras } from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin-shell";
import {
  Store, CheckCircle2, XCircle, Lock, Package, MessageSquare, ArrowRight,
  Wallet, Plus, RefreshCw, Settings2, Database, Server, ShieldCheck,
  LineChart as LineIcon, Rows3, Grid3x3, CalendarClock, TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { KpiSkeleton } from "@/components/dashboard/kpi-skeleton";
import { KpiDialog, type DrillColumn } from "@/components/dashboard/kpi-dialog";
import { CardMeta } from "@/components/dashboard/card-meta";
import { withTiming, dashboardRetry, dashboardRetryDelay, notifyQueryError } from "@/lib/query-timing";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

const fmt = (n: number) =>
  `৳${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;

type Tone = "emerald" | "blue" | "amber" | "violet" | "rose" | "sky";
const chip: Record<Tone, string> = {
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  blue:    "bg-blue-50 text-blue-600 border-blue-100",
  amber:   "bg-amber-50 text-amber-600 border-amber-100",
  violet:  "bg-violet-50 text-violet-600 border-violet-100",
  rose:    "bg-rose-50 text-rose-600 border-rose-100",
  sky:     "bg-sky-50 text-sky-600 border-sky-100",
};
const val: Record<Tone, string> = {
  emerald: "text-emerald-700", blue: "text-slate-900", amber: "text-slate-900",
  violet: "text-violet-700", rose: "text-rose-600", sky: "text-slate-900",
};

function Dashboard() {
  const statsFnRaw = useServerFn(getAdminStats);
  const shopsFnRaw = useServerFn(listShops);
  const extrasFnRaw = useServerFn(getAdminExtras);
  const statsFn = useMemo(() => withTiming(statsFnRaw, { label: "admin-stats" }), [statsFnRaw]);
  const shopsFn = useMemo(() => withTiming(shopsFnRaw, { label: "admin-shops" }), [shopsFnRaw]);
  const extrasFn = useMemo(() => withTiming(extrasFnRaw, { label: "admin-extras", slowMs: 2500 }), [extrasFnRaw]);
  const commonRetry = { retry: dashboardRetry, retryDelay: dashboardRetryDelay } as const;
  const statsQ = useQuery({ queryKey: ["admin-stats"], queryFn: () => statsFn(), refetchInterval: 60_000, ...commonRetry });
  const shopsQ = useQuery({ queryKey: ["admin-shops-recent"], queryFn: () => shopsFn(), refetchInterval: 60_000, ...commonRetry });
  const data = statsQ.data;

  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [compact, setCompact] = useState(false);
  const extrasQ = useQuery({ queryKey: ["admin-extras", range], queryFn: () => extrasFn({ data: { days: range } }), refetchInterval: 120_000, ...commonRetry });
  useEffect(() => { if (statsQ.error) notifyQueryError("এডমিন স্ট্যাটস", statsQ.error); }, [statsQ.error]);
  useEffect(() => { if (shopsQ.error) notifyQueryError("দোকানের তালিকা", shopsQ.error); }, [shopsQ.error]);
  useEffect(() => { if (extrasQ.error) notifyQueryError("ট্রেন্ড ডেটা", extrasQ.error); }, [extrasQ.error]);
  type Drill = null | "all" | "active" | "expired" | "locked" | "expiring" | "revenue" | "sms";
  const [drill, setDrill] = useState<Drill>(null);

  const [email, setEmail] = useState<string>("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const isLoading = !data;
  const ext = extrasQ.data;

  const monthlyRevenue = Number(data?.monthlyRevenue ?? 0);
  type Stat = { label: string; value: any; sub: string; icon: any; tone: Tone; empty?: boolean; drill?: Drill; source: string; filter: string };
  const stats: Stat[] = [
    { label: "মোট দোকান",           value: data?.totalShops ?? 0,     sub: "সব রেজিস্টার্ড",       icon: Store,        tone: "blue", drill: "all", source: "shops", filter: "সব রো" },
    { label: "সক্রিয় সাবস্ক্রিপশন",   value: data?.activeShops ?? 0,    sub: "চলমান",                icon: CheckCircle2, tone: "emerald", drill: "active", source: "shops", filter: "status = active" },
    { label: "এ মাসের আয়",           value: monthlyRevenue > 0 ? fmt(monthlyRevenue) : "—",
      sub: monthlyRevenue > 0 ? `মোট ৳${monthlyRevenue.toLocaleString("bn-BD")}` : "এখনো কোনো পেমেন্ট নেই",
      icon: Wallet, tone: "violet", empty: monthlyRevenue <= 0, drill: monthlyRevenue > 0 ? "revenue" : undefined,
      source: "subscription_payment_ledger", filter: "চলতি মাস" },
    { label: "লকড অ্যাকাউন্ট",        value: data?.lockedShops ?? 0,    sub: "পর্যালোচনা প্রয়োজন",   icon: Lock,         tone: "rose", drill: "locked", source: "shops", filter: "status = locked" },
    { label: "মেয়াদ শেষ",             value: data?.expiredShops ?? 0,   sub: "রিনিউ প্রয়োজন",         icon: XCircle,      tone: "amber", drill: "expired", source: "shops", filter: "status = expired" },
    { label: "SMS পাঠানো",           value: data?.smsSent ?? 0,        sub: "মোট ডেলিভারি",         icon: MessageSquare, tone: "sky", drill: "sms", source: "sms_logs", filter: `শেষ ${range} দিন` },
  ];

  const allShops = (shopsQ.data ?? []) as any[];
  const shopsBy = (k: Drill): any[] => {
    if (k === "all") return allShops;
    if (k === "active") return allShops.filter((s) => s.status === "active");
    if (k === "expired") return allShops.filter((s) => s.status === "expired");
    if (k === "locked") return allShops.filter((s) => s.status === "locked");
    if (k === "expiring") return (ext?.upcomingExpirations ?? []) as any[];
    return [];
  };
  const shopCols: DrillColumn[] = [
    { key: "name", label: "দোকান", render: (r: any) => (
      <div><div className="font-semibold">{r.name}</div><div className="text-[11px] text-slate-500">{r.owner_name}</div></div>
    ) },
    { key: "package", label: "প্যাকেজ", render: (r: any) => r.package?.name ?? "-" },
    { key: "subscription_end", label: "মেয়াদ", render: (r: any) => r.subscription_end ? new Date(r.subscription_end).toLocaleDateString("bn-BD") : "-" },
    { key: "status", label: "স্ট্যাটাস", align: "right", render: (r: any) => badge(r.status) },
  ];
  const revenueCols: DrillColumn[] = [
    { key: "created_at", label: "তারিখ", render: (r: any) => new Date(r.created_at).toLocaleDateString("bn-BD") },
    { key: "shop", label: "দোকান", render: (r: any) => r.shop?.name ?? "-" },
    { key: "method", label: "মাধ্যম", render: (r: any) => r.method ?? "-" },
    { key: "amount", label: "পরিমাণ", align: "right", render: (r: any) => fmt(r.amount) },
  ];
  const smsCols: DrillColumn[] = [
    { key: "created_at", label: "তারিখ", render: (r: any) => new Date(r.created_at).toLocaleString("bn-BD") },
    { key: "phone", label: "মোবাইল" },
    { key: "message", label: "বার্তা", render: (r: any) => <span className="line-clamp-2 text-xs">{r.message}</span> },
    { key: "status", label: "স্ট্যাটাস", align: "right", render: (r: any) => (
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.status === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{r.status}</span>
    ) },
  ];

  const actions: { label: string; icon: any; to: string; tone: Tone }[] = [
    { label: "নতুন দোকান তৈরি",    icon: Plus,      to: "/admin/shops",         tone: "emerald" },
    { label: "নতুন প্যাকেজ",       icon: Package,   to: "/admin/packages",      tone: "violet" },
    { label: "সাবস্ক্রিপশন নবায়ন", icon: RefreshCw, to: "/admin/subscriptions", tone: "blue" },
    { label: "API সেটিংস",         icon: Settings2, to: "/admin/settings",      tone: "amber" },
  ];

  const recent = (shopsQ.data ?? []).slice(0, 5);

  const badge = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-emerald-50 text-emerald-700",
      expired: "bg-amber-50 text-amber-700",
      locked: "bg-rose-50 text-rose-700",
      pending: "bg-slate-100 text-slate-700",
    };
    const label: Record<string, string> = {
      active: "সক্রিয়",
      expired: "মেয়াদ শেষ",
      locked: "লকড",
      pending: "অপেক্ষমাণ",
    };
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${map[status] ?? "bg-slate-100 text-slate-700"}`}>
        {label[status] ?? status}
      </span>
    );
  };

  return (
    <AdminShell>
      <div className="space-y-6 p-4 sm:p-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">এডমিন ড্যাশবোর্ড</h1>
            <p className="mt-1 truncate text-sm text-slate-500">
              SaaS প্ল্যাটফর্মের সার্বিক অবস্থা • {email || "Super Admin"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setCompact((v) => !v)}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              {compact ? <Grid3x3 className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}
              {compact ? "নরমাল" : "কম্প্যাক্ট"}
            </button>
            <Link to="/admin/shops"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> নতুন দোকান
            </Link>
          </div>
        </div>

        {isLoading ? (
          <KpiSkeleton count={6} compact={compact} />
        ) : (
        <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`}>
          {stats.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => c.drill && setDrill(c.drill)}
              disabled={!c.drill}
              className={`rounded-xl border border-slate-200 bg-white text-left shadow-sm transition ${
                c.drill ? "cursor-pointer hover:border-emerald-200 hover:shadow-md" : "cursor-default"
              } ${compact ? "p-3" : "p-5"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{c.label}</p>
                  <p className={`mt-2 truncate font-bold leading-tight ${compact ? "text-lg" : "text-2xl"} ${c.empty ? "text-slate-400" : val[c.tone]}`}>{c.value}</p>
                  {!compact && <p className={`mt-1 truncate text-xs ${c.empty ? "italic text-slate-400" : "text-slate-500"}`}>{c.sub}</p>}
                </div>
                <div className={`flex shrink-0 items-center justify-center rounded-lg border ${chip[c.tone]} ${c.empty ? "opacity-70" : ""} ${compact ? "h-7 w-7" : "h-9 w-9"}`}>
                  <c.icon className="h-4 w-4" />
                </div>
              </div>
            </button>
          ))}
        </div>
        )}

        <KpiDialog
          open={drill !== null && drill !== "expiring"} onOpenChange={(v) => !v && setDrill(null)}
          title={
            drill === "all" ? "সব দোকান" :
            drill === "active" ? "সক্রিয় দোকান" :
            drill === "expired" ? "মেয়াদ শেষ দোকান" :
            drill === "locked" ? "লকড দোকান" :
            drill === "revenue" ? `এ মাসের আয় — ${fmt(monthlyRevenue)}` :
            drill === "sms" ? "SMS পাঠানোর হিস্টরি" : "দোকান"
          }
          source={
            drill === "revenue" ? `subscription_payment_ledger · শেষ ${range} দিন` :
            drill === "sms" ? `sms_logs · শেষ ${range} দিন` :
            "shops"
          }
          subtitle={
            drill === "revenue" ? `${(ext?.recentPayments ?? []).length} টি পেমেন্ট (শেষ ${range} দিন)` :
            drill === "sms" ? `${(ext?.recentSms ?? []).length} টি বার্তা (শেষ ${range} দিন)` :
            drill ? `${shopsBy(drill as any).length} টি` : ""
          }
          columns={
            drill === "revenue" ? revenueCols :
            drill === "sms" ? smsCols :
            shopCols
          }
          rows={
            drill === "revenue" ? ((ext?.recentPayments ?? []) as any[]) :
            drill === "sms" ? ((ext?.recentSms ?? []) as any[]) :
            drill && drill !== "expiring" ? shopsBy(drill as any).slice(0, 200) : []
          }
          loading={(drill === "revenue" || drill === "sms") ? extrasQ.isLoading : shopsQ.isLoading}
          error={((drill === "revenue" || drill === "sms") ? extrasQ.error : shopsQ.error) as Error | null}
          onRetry={() => (drill === "revenue" || drill === "sms") ? extrasQ.refetch() : shopsQ.refetch()}
        />

        {/* Trend chart */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight text-slate-700">
                <LineIcon className="h-4 w-4 text-emerald-600" /> নতুন শপ + রেভিনিউ ট্রেন্ড
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                শেষ {range} দিনে {ext?.newShopsPeriod ?? 0} টা নতুন শপ • ৳{(ext?.revenuePeriod ?? 0).toLocaleString("bn-BD")}
              </p>
            </div>
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
            {extrasQ.isLoading ? (
              <div className="h-[260px] w-full animate-pulse rounded-lg bg-slate-100" />
            ) : (
              <TrendChart
                data={ext?.trend ?? []}
                compact={compact}
                series={[
                  { key: "revenue", label: "রেভিনিউ (৳)", color: "#10b981" },
                  { key: "shops", label: "নতুন শপ", color: "#3b82f6" },
                ]}
              />
            )}
          </div>
        </div>

        {/* Status + Top packages + Expiring */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-bold uppercase tracking-tight text-slate-700">শপ স্ট্যাটাস</h2>
            </div>
            <div className="space-y-2 p-4">
              {(ext?.statusBreakdown ?? []).map((s) => {
                const total = (ext?.statusBreakdown ?? []).reduce((a, b) => a + b.count, 0) || 1;
                const pct = Math.round((s.count / total) * 100);
                const color: Record<string, string> = { active: "bg-emerald-500", expired: "bg-amber-500", locked: "bg-rose-500", suspended: "bg-slate-500", pending: "bg-sky-400" };
                const label: Record<string, string> = { active: "সক্রিয়", expired: "মেয়াদ শেষ", locked: "লকড", suspended: "স্থগিত", pending: "অপেক্ষমাণ" };
                return (
                  <div key={s.status}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-slate-600">{label[s.status]}</span>
                      <span className="font-bold text-slate-800">{s.count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full ${color[s.status] ?? "bg-slate-400"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {extrasQ.isLoading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-6 animate-pulse rounded bg-slate-100" />)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight text-slate-700">
                <Package className="h-4 w-4 text-violet-600" /> টপ প্যাকেজ
              </h2>
              <Link to="/admin/packages" className="text-[11px] font-semibold text-emerald-600 hover:underline">সব</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {(ext?.topPackages ?? []).map((p, i) => (
                <div key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-50 text-[11px] font-bold text-violet-700">{i + 1}</span>
                  <span className="truncate font-medium text-slate-800">{p.name}</span>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700">{p.count} শপ</span>
                </div>
              ))}
              {(ext?.topPackages ?? []).length === 0 && !extrasQ.isLoading && <p className="py-8 text-center text-sm text-slate-400">ডেটা নেই</p>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight text-slate-700">
                <CalendarClock className="h-4 w-4 text-amber-600" /> মেয়াদ শেষের কাছাকাছি
              </h2>
              <Link to="/admin/shops" className="text-[11px] font-semibold text-emerald-600 hover:underline">সব</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {(ext?.upcomingExpirations ?? []).slice(0, 6).map((s: any) => {
                const daysLeft = s.subscription_end ? Math.ceil((new Date(s.subscription_end).getTime() - Date.now()) / 86400000) : null;
                return (
                  <Link key={s.id} to="/admin/shops/$shopId" params={{ shopId: s.id }} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50/60">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-800">{s.name}</div>
                      <div className="truncate text-[11px] text-slate-500">{s.owner_name}</div>
                    </div>
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${daysLeft != null && daysLeft < 0 ? "bg-rose-50 text-rose-700" : daysLeft != null && daysLeft <= 7 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                      {daysLeft == null ? "-" : daysLeft < 0 ? `${Math.abs(daysLeft)}দিন পার` : `${daysLeft}দিন`}
                    </span>
                  </Link>
                );
              })}
              {(ext?.upcomingExpirations ?? []).length === 0 && !extrasQ.isLoading && <p className="py-8 text-center text-sm text-slate-400">কিছু নেই</p>}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-bold uppercase tracking-tight text-slate-700">সাম্প্রতিক দোকান</h2>
              <Link to="/admin/shops" className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:underline">
                সব দেখুন <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-slate-50/60 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-5 py-3">দোকান</th>
                    <th className="px-5 py-3">প্যাকেজ</th>
                    <th className="px-5 py-3">মেয়াদ</th>
                    <th className="px-5 py-3 text-right">স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shopsQ.isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={4} className="px-5 py-3"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>
                    ))
                  ) : recent.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">এখনও কোনো দোকান নেই</td></tr>
                  ) : recent.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-800">{s.name}</div>
                        <div className="text-[11px] text-slate-500">{s.owner_name}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{s.package?.name ?? "-"}</td>
                      <td className="px-5 py-3 text-slate-500">
                        {s.subscription_end ? new Date(s.subscription_end).toLocaleDateString("bn-BD") : "-"}
                      </td>
                      <td className="px-5 py-3 text-right">{badge(s.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-bold uppercase tracking-tight text-slate-700">দ্রুত কাজ</h2>
              </div>
              <div className="space-y-1 p-2">
                {actions.map((a) => (
                  <Link key={a.label} to={a.to}
                    className="group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-slate-50">
                    <span className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${chip[a.tone]}`}>
                        <a.icon className="h-4 w-4" />
                      </span>
                      <span className="font-medium text-slate-800">{a.label}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-bold uppercase tracking-tight text-slate-700">সিস্টেম অবস্থা</h2>
              </div>
              <div className="space-y-2 p-4">
                <StatusRow icon={Database} label="Database" ok={!!data} note={data ? "সংযুক্ত" : "সংযোগ নেই"} />
                <StatusRow icon={Server} label="ট্রেন্ড ডেটা" ok={!extrasQ.isError} note={extrasQ.isError ? "ত্রুটি" : `${ext?.newShopsPeriod ?? 0} নতুন শপ`} />
                <StatusRow icon={MessageSquare} label={`SMS (${range}দিন)`} ok={(ext?.smsStats.failed ?? 0) === 0} note={`${ext?.smsStats.sent ?? 0} সফল / ${ext?.smsStats.failed ?? 0} ব্যর্থ`} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function StatusRow({ icon: Icon, label, ok, note }: { icon: any; label: string; ok: boolean; note: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/40 px-3 py-2">
      <span className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-slate-400" />
        <span className="font-medium text-slate-700">{label}</span>
      </span>
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${ok ? "text-emerald-600" : "text-rose-600"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`} />
        {note}
      </span>
    </div>
  );
}
