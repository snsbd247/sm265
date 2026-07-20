import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listImpersonationAudit } from "@/lib/impersonation.functions";
import { AdminShell } from "@/components/admin-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShieldAlert, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/impersonation-logs")({ component: Page });

function fmt(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });
}

function Page() {
  const fn = useServerFn(listImpersonationAudit);
  const q = useQuery({ queryKey: ["impersonation-audit"], queryFn: () => fn() });
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const all = q.data?.rows ?? [];
    const s = search.trim().toLowerCase();
    if (!s) return all;
    return all.filter(
      (r) =>
        r.shop_name.toLowerCase().includes(s) ||
        r.admin_name.toLowerCase().includes(s) ||
        r.target_name.toLowerCase().includes(s) ||
        r.action.toLowerCase().includes(s),
    );
  }, [q.data, search]);

  return (
    <AdminShell>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 shadow-md">
              <ShieldAlert className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">ইম্পার্সোনেশন অডিট লগ</h1>
              <p className="text-sm text-muted-foreground">সুপার এডমিন কর্তৃক শপে সরাসরি লগইনের রেকর্ড</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`mr-1 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
            রিফ্রেশ
          </Button>
        </div>

        <Card className="p-4">
          <div className="mb-3 relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="দোকান / এডমিন / ইউজার খুঁজুন..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">সময়</th>
                  <th className="p-3">অ্যাকশন</th>
                  <th className="p-3">দোকান</th>
                  <th className="p-3">সুপার এডমিন</th>
                  <th className="p-3">টার্গেট ইউজার</th>
                </tr>
              </thead>
              <tbody>
                {q.isLoading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">লোড হচ্ছে...</td></tr>
                ) : q.isError ? (
                  <tr><td colSpan={5} className="p-8 text-center text-destructive">{(q.error as Error).message}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">কোনো লগ নেই।</td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/20">
                      <td className="p-3 whitespace-nowrap text-muted-foreground">{fmt(r.created_at)}</td>
                      <td className="p-3">
                        <Badge
                          variant={r.action === "issued" ? "secondary" : "default"}
                          className={r.action === "redeemed" ? "bg-emerald-600" : ""}
                        >
                          {r.action === "issued" ? "টোকেন ইস্যু" : r.action === "redeemed" ? "লগইন সম্পন্ন" : r.action}
                        </Badge>
                      </td>
                      <td className="p-3 font-medium">{r.shop_name}</td>
                      <td className="p-3">{r.admin_name}</td>
                      <td className="p-3">{r.target_name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
