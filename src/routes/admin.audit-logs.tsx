import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { listAuditLogs } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/admin/audit-logs")({
  component: AuditLogsPage,
});

const ACTIONS = [
  { v: "", l: "সব অ্যাকশন" },
  { v: "shop.created", l: "শপ তৈরি" },
  { v: "shop.status_changed", l: "শপ স্ট্যাটাস" },
  { v: "shop.deleted", l: "শপ ডিলিট" },
  { v: "invoice.created", l: "ইনভয়েস তৈরি" },
  { v: "invoice.paid", l: "ইনভয়েস পেইড" },
  { v: "invoice.approved", l: "এডমিন অ্যাপ্রুভ" },
  { v: "invoice.rejected", l: "রিজেক্ট" },
  { v: "invoice.cancelled", l: "বাতিল" },
  { v: "invoice.trx_submitted", l: "TrxID সাবমিট" },
  { v: "invoice.reminder_sent", l: "রিমাইন্ডার" },
  { v: "invoice.webhook_processed", l: "ওয়েবহুক" },
  { v: "package.upgrade_requested", l: "আপগ্রেড রিকুয়েস্ট" },
  { v: "package.upgrade_cancelled", l: "আপগ্রেড বাতিল" },
  { v: "package.downgraded", l: "ডাউনগ্রেড" },
  { v: "package.changed", l: "প্যাকেজ পরিবর্তন" },
  { v: "subscription.extended", l: "মেয়াদ বৃদ্ধি" },
];

function badgeColor(action: string) {
  if (action.startsWith("invoice.paid") || action === "invoice.approved" || action === "invoice.webhook_processed") return "bg-emerald-100 text-emerald-800";
  if (action.startsWith("invoice.rejected") || action.startsWith("invoice.cancelled") || action.endsWith("cancelled") || action === "shop.deleted") return "bg-rose-100 text-rose-800";
  if (action.startsWith("package.")) return "bg-indigo-100 text-indigo-800";
  if (action.startsWith("invoice.reminder")) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-800";
}

function AuditLogsPage() {
  const [action, setAction] = useState<string>("");
  const [q, setQ] = useState("");
  const fn = useServerFn(listAuditLogs);
  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", action],
    queryFn: () => fn({ data: { action: action || undefined, limit: 300 } }),
    refetchInterval: 60_000,
  });

  const rows = (data ?? []).filter((r: any) => {
    if (!q) return true;
    const hay = `${r.actor_email ?? ""} ${r.shop?.name ?? ""} ${r.action} ${JSON.stringify(r.details ?? {})}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <AdminShell>
      <div className="p-4 md:p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">অডিট লগ</h1>
          <p className="text-sm text-muted-foreground">কে/কবে কী কাজ করেছে সবকিছুর রেকর্ড</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ফিল্টার</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr_240px]">
            <Input placeholder="সার্চ (এডমিন ইমেইল, শপ, বিবরণ)..." value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={action || "__all__"} onValueChange={(v) => setAction(v === "__all__" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">সব অ্যাকশন</SelectItem>
                {ACTIONS.filter((a) => a.v).map((a) => (
                  <SelectItem key={a.v} value={a.v}>{a.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{rows.length} টি লগ</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">লোড হচ্ছে...</div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">কোনো লগ নেই</div>
            ) : (
              <div className="divide-y">
                {rows.map((r: any) => (
                  <div key={r.id} className="grid gap-2 p-4 md:grid-cols-[180px_160px_1fr_auto] md:items-start">
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("bn-BD")}
                    </div>
                    <div className="text-sm">
                      <div className="font-medium truncate">{r.actor_email ?? r.actor_role ?? "system"}</div>
                      {r.actor_role && <div className="text-[10px] uppercase text-muted-foreground">{r.actor_role}</div>}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={badgeColor(r.action)}>{r.action}</Badge>
                        {r.shop?.name && <span className="text-sm font-medium">{r.shop.name}</span>}
                      </div>
                      {r.details && Object.keys(r.details).length > 0 && (
                        <pre className="max-w-full overflow-x-auto rounded bg-slate-50 p-2 text-[11px] leading-snug text-slate-700">
{JSON.stringify(r.details, null, 2)}
                        </pre>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground md:text-right">
                      {r.target_type && <div>{r.target_type}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}