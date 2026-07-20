import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSmsLogs } from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/sms-logs")({ component: Page });

function Page() {
  const fn = useServerFn(listSmsLogs);
  const q = useQuery({ queryKey: ["sms-logs"], queryFn: () => fn({ data: { limit: 200 } }) });

  return (
    <AdminShell>
      <div className="p-4 sm:p-6">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">SMS লগ</h1>
          <p className="text-sm text-muted-foreground">সাম্প্রতিক ২০০টি SMS প্রেরণের ইতিহাস</p>
        </div>

        <div className="mt-5 overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3">প্রাপক</th>
                <th className="px-4 py-3">দোকান</th>
                <th className="px-4 py-3">টেমপ্লেট</th>
                <th className="px-4 py-3">মেসেজ</th>
                <th className="px-4 py-3">স্ট্যাটাস</th>
                <th className="px-4 py-3">তারিখ</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.map((l: any) => (
                <tr key={l.id} className="border-t align-top">
                  <td className="px-4 py-3 font-mono text-xs">{l.recipient}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{l.shop?.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    {l.template_code ? <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{l.template_code}</span> : <span className="text-xs text-muted-foreground">-</span>}
                  </td>
                  <td className="px-4 py-3 max-w-[320px]">
                    <div className="truncate">{l.message}</div>
                    {l.response && <div className="mt-0.5 truncate text-xs text-muted-foreground">← {l.response}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={l.status === "sent" ? "default" : l.status === "failed" ? "destructive" : "secondary"}>
                      {l.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString("bn-BD")}</td>
                </tr>
              ))}
              {q.data?.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">কোন লগ নেই</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
