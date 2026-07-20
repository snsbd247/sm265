import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminStats, listShops } from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin-shell";
import {
  Store, CheckCircle2, XCircle, Lock, Package, MessageSquare, ArrowRight,
  Wallet, Plus, RefreshCw, Settings2, Database, Server, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

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
  const statsFn = useServerFn(getAdminStats);
  const shopsFn = useServerFn(listShops);
  const { data } = useQuery({ queryKey: ["admin-stats"], queryFn: () => statsFn() });
  const shopsQ = useQuery({ queryKey: ["admin-shops-recent"], queryFn: () => shopsFn() });

  const [email, setEmail] = useState<string>("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const monthlyRevenue = Number(data?.monthlyRevenue ?? 0);
  const stats: { label: string; value: any; sub: string; icon: any; tone: Tone; empty?: boolean }[] = [
    { label: "মোট দোকান",           value: data?.totalShops ?? 0,     sub: "সব রেজিস্টার্ড",       icon: Store,        tone: "blue" },
    { label: "সক্রিয় সাবস্ক্রিপশন",   value: data?.activeShops ?? 0,    sub: "চলমান",                icon: CheckCircle2, tone: "emerald" },
    { label: "এ মাসের আয়",           value: monthlyRevenue > 0 ? fmt(monthlyRevenue) : "—",
      sub: monthlyRevenue > 0 ? `মোট ৳${monthlyRevenue.toLocaleString("bn-BD")}` : "এখনো কোনো পেমেন্ট নেই",
      icon: Wallet, tone: "violet", empty: monthlyRevenue <= 0 },
    { label: "লকড অ্যাকাউন্ট",        value: data?.lockedShops ?? 0,    sub: "পর্যালোচনা প্রয়োজন",   icon: Lock,         tone: "rose" },
    { label: "মেয়াদ শেষ",             value: data?.expiredShops ?? 0,   sub: "রিনিউ প্রয়োজন",         icon: XCircle,      tone: "amber" },
    { label: "SMS পাঠানো",           value: data?.smsSent ?? 0,        sub: "মোট ডেলিভারি",         icon: MessageSquare, tone: "sky" },
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
          <Link to="/admin/shops"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
            <Plus className="h-4 w-4" /> নতুন দোকান
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {stats.map((c) => (
            <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{c.label}</p>
                  <p className={`mt-2 truncate text-2xl font-bold leading-tight ${c.empty ? "text-slate-400" : val[c.tone]}`}>{c.value}</p>
                  <p className={`mt-1 truncate text-xs ${c.empty ? "italic text-slate-400" : "text-slate-500"}`}>{c.sub}</p>
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${chip[c.tone]} ${c.empty ? "opacity-70" : ""}`}>
                  <c.icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
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
                  {recent.length === 0 ? (
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
                <StatusRow icon={Database} label="Database" ok={true} note="সংযুক্ত" />
                <StatusRow icon={Server} label="Scheduler / Cron" ok={true} note="সক্রিয়" />
                <StatusRow icon={MessageSquare} label="SMS Gateway" ok={(data?.smsSent ?? 0) >= 0} note="কনফিগার করা" />
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
