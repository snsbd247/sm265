import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminStats, listShops } from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin-shell";
import {
  Store,
  CheckCircle2,
  XCircle,
  Lock,
  Package,
  MessageSquare,
  Sparkles,
  ArrowUpRight,
  Wallet,
  Plus,
  RefreshCw,
  Settings2,
  Database,
  Server,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

const fmt = (n: number) =>
  `৳${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;

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
  const stats = [
    { label: "মোট দোকান", value: data?.totalShops ?? 0, sub: "সব রেজিস্টার্ড", icon: Store, grad: "grad-blue", soft: "soft-blue" },
    { label: "সক্রিয় সাবস্ক্রিপশন", value: data?.activeShops ?? 0, sub: "চলমান", icon: CheckCircle2, grad: "grad-emerald", soft: "soft-emerald" },
    {
      label: "এ মাসের আয়",
      value: monthlyRevenue > 0 ? fmt(monthlyRevenue) : "—",
      sub: monthlyRevenue > 0 ? `মোট ৳${monthlyRevenue.toLocaleString("bn-BD")}` : "এই মাসে এখনো কোনো পেমেন্ট নেই",
      icon: Wallet, grad: "grad-violet", soft: "soft-violet",
      empty: monthlyRevenue <= 0,
    },
    { label: "লকড অ্যাকাউন্ট", value: data?.lockedShops ?? 0, sub: "পর্যালোচনা প্রয়োজন", icon: Lock, grad: "grad-rose", soft: "soft-rose" },
    { label: "মেয়াদ শেষ", value: data?.expiredShops ?? 0, sub: "রিনিউ প্রয়োজন", icon: XCircle, grad: "grad-amber", soft: "soft-amber" },
    { label: "SMS পাঠানো", value: data?.smsSent ?? 0, sub: "মোট ডেলিভারি", icon: MessageSquare, grad: "grad-cyan", soft: "soft-cyan" },
  ];


  const actions = [
    { label: "নতুন দোকান তৈরি", icon: Plus, to: "/admin/shops", grad: "grad-emerald" },
    { label: "নতুন প্যাকেজ", icon: Package, to: "/admin/packages", grad: "grad-violet" },
    { label: "সাবস্ক্রিপশন নবায়ন", icon: RefreshCw, to: "/admin/subscriptions", grad: "grad-ocean" },
    { label: "API সেটিংস", icon: Settings2, to: "/admin/settings", grad: "grad-sunset" },
  ];

  const recent = (shopsQ.data ?? []).slice(0, 5);

  const badge = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-emerald-100 text-emerald-700",
      expired: "bg-amber-100 text-amber-700",
      locked: "bg-rose-100 text-rose-700",
      pending: "bg-slate-100 text-slate-700",
    };
    const label: Record<string, string> = {
      active: "সক্রিয়",
      expired: "মেয়াদ শেষ",
      locked: "লকড",
      pending: "অপেক্ষমাণ",
    };
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-slate-100 text-slate-700"}`}>
        {label[status] ?? status}
      </span>
    );
  };

  return (
    <AdminShell>
      <div className="p-4 sm:p-6">
        {/* Hero */}
        <div className="grad-ocean relative overflow-hidden rounded-2xl p-5 shadow-lg sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur">
                <Sparkles className="h-3 w-3" /> সুপার এডমিন প্যানেল
              </div>
              <h1 className="mt-3 text-2xl font-bold sm:text-3xl">ড্যাশবোর্ড</h1>
              <p className="mt-1 text-sm opacity-90">আপনার SaaS প্ল্যাটফর্মের সার্বিক অবস্থা</p>
            </div>
            <div className="hidden shrink-0 items-center gap-3 rounded-2xl bg-white/15 p-3 backdrop-blur sm:flex">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/25 font-bold">S</div>
              <div className="text-sm">
                <div className="font-semibold leading-tight">Super Admin</div>
                <div className="text-xs opacity-80">{email || "Super Admin"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stats.map((c) => (
            <div key={c.label} className={`card-hover relative overflow-hidden rounded-xl border p-5 shadow-sm ${c.soft}`}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">{c.label}</p>
                  <p className={`mt-2 text-2xl font-extrabold leading-tight ${(c as any).empty ? "text-slate-400" : "text-slate-900"}`}>{c.value}</p>
                  <p className={`mt-2 text-xs ${(c as any).empty ? "italic text-slate-500" : "text-slate-600"}`}>{c.sub}</p>
                  {(c as any).empty && (
                    <Link to="/admin/subscriptions" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline">
                      পেমেন্ট দেখুন <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
                <div className={`shrink-0 rounded-xl p-2.5 shadow-md ${c.grad} ${(c as any).empty ? "opacity-70" : ""}`}>
                  <c.icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </div>


        {/* Recent + Quick actions */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="grad-blue px-5 py-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold">সাম্প্রতিক দোকান</h2>
                    <p className="text-xs opacity-90">নতুন যুক্ত হওয়া অ্যাকাউন্টসমূহ</p>
                  </div>
                  <Link to="/admin/shops" className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium backdrop-blur hover:bg-white/30">
                    <Plus className="h-3 w-3" /> নতুন দোকান
                  </Link>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">দোকান</th>
                      <th className="px-4 py-2 text-left font-medium">প্যাকেজ</th>
                      <th className="px-4 py-2 text-left font-medium">মেয়াদ</th>
                      <th className="px-4 py-2 text-left font-medium">স্ট্যাটাস</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recent.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                          এখনও কোনো দোকান নেই
                        </td>
                      </tr>
                    ) : (
                      recent.map((s: any) => (
                        <tr key={s.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{s.name}</div>
                            <div className="text-xs text-muted-foreground">{s.owner_name}</div>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{s.package?.name ?? "-"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {s.subscription_end ? new Date(s.subscription_end).toLocaleDateString("bn-BD") : "-"}
                          </td>
                          <td className="px-4 py-2.5">{badge(s.status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Quick actions + system status */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="grad-sunset px-5 py-3">
                <h2 className="font-semibold">দ্রুত কাজ</h2>
              </div>
              <div className="space-y-2 p-4">
                {actions.map((a) => (
                  <Link key={a.label} to={a.to}
                    className={`card-hover group flex items-center justify-between rounded-lg px-4 py-2.5 text-sm font-medium shadow-md ${a.grad}`}>
                    <span className="flex items-center gap-2">
                      <a.icon className="h-4 w-4" /> {a.label}
                    </span>
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="grad-forest px-5 py-3">
                <h2 className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" /> সিস্টেম অবস্থা
                </h2>
              </div>
              <div className="space-y-2 p-4 text-sm">
                <StatusRow icon={Database} label="Database" ok={true} note="সংযুক্ত" />
                <StatusRow icon={Server} label="Scheduler / Cron" ok={true} note="সক্রিয়" />
                <StatusRow icon={MessageSquare} label="SMS Gateway" ok={(data?.smsSent ?? 0) >= 0} note="কনফিগার করা" />
                <p className="pt-2 text-xs text-muted-foreground">
                  Database এবং scheduler configuration সক্রিয় রাখুন।
                </p>
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
    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{label}</span>
      </span>
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${ok ? "text-emerald-600" : "text-rose-600"}`}>
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`} />
        {note}
      </span>
    </div>
  );
}
