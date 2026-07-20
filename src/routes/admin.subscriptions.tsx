import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listSubscriptionPayments,
  approveSubscriptionPayment,
  rejectSubscriptionPayment,
  syncExpiredShops,
  getPaymentReceipt,
} from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useState } from "react";
import { Check, X, RefreshCw, Printer } from "lucide-react";

export const Route = createFileRoute("/admin/subscriptions")({ component: Page });

function Page() {
  const [tab, setTab] = useState<"pending" | "success" | "failed" | "all">("pending");
  const qc = useQueryClient();
  const listFn = useServerFn(listSubscriptionPayments);
  const approveFn = useServerFn(approveSubscriptionPayment);
  const rejectFn = useServerFn(rejectSubscriptionPayment);
  const syncFn = useServerFn(syncExpiredShops);

  const openReceipt = (paymentId: string) => {
    window.open(`/admin/receipts/en/${paymentId}`, "_blank", "noopener");
  };

  const q = useQuery({
    queryKey: ["admin-payments", tab],
    queryFn: () => listFn({ data: { status: tab } }),
  });


  const approve = useMutation({
    mutationFn: (id: string) => approveFn({ data: { payment_id: id } }),
    onSuccess: () => { toast.success("অনুমোদন হয়েছে, একাউন্ট এক্টিভ"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: (id: string) => rejectFn({ data: { payment_id: id } }),
    onSuccess: () => { toast.success("বাতিল হয়েছে"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });
  const sync = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (r: any) => { toast.success(`${r.updated}টি দোকান expired মার্ক হয়েছে`); qc.invalidateQueries(); },
  });

  return (
    <AdminShell>
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">সাবস্ক্রিপশন পেমেন্ট</h1>
            <p className="text-sm text-muted-foreground">দোকানদারের বিকাশ পেমেন্ট রিভিউ ও অনুমোদন</p>
          </div>
          <Button className="shrink-0" variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
            <RefreshCw className="mr-2 h-4 w-4" /> মেয়াদ শেষ চেক
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-4">
          <TabsList className="h-auto max-w-full justify-start overflow-x-auto p-1">
            <TabsTrigger value="pending">অপেক্ষমান</TabsTrigger>
            <TabsTrigger value="success">অনুমোদিত</TabsTrigger>
            <TabsTrigger value="failed">বাতিল</TabsTrigger>
            <TabsTrigger value="all">সব</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-5 overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3">দোকান</th>
                <th className="px-4 py-3">ট্রানজেকশন</th>
                <th className="px-4 py-3">এমাউন্ট</th>
                <th className="px-4 py-3">স্ট্যাটাস</th>
                <th className="px-4 py-3">তারিখ</th>
                <th className="px-4 py-3 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.map((p: any) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.shop?.name}</div>
                    <div className="text-xs text-muted-foreground">{p.shop?.owner_name} • {p.shop?.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs">{p.transaction_id ?? "-"}</div>
                    {p.bkash_payment_id && <div className="text-xs text-muted-foreground">bKash: {p.bkash_payment_id}</div>}
                  </td>
                  <td className="px-4 py-3 font-semibold">৳{Number(p.amount).toLocaleString("bn-BD")}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.status === "pending" ? "secondary" : p.status === "success" ? "default" : "destructive"}>
                      {p.status === "pending" ? "অপেক্ষমান" : p.status === "success" ? "অনুমোদিত" : "বাতিল"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("bn-BD")}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {p.status === "pending" && (
                        <>
                          <Button size="sm" variant="ghost" title="অনুমোদন" onClick={() => approve.mutate(p.id)} disabled={approve.isPending}>
                            <Check className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button size="sm" variant="ghost" title="বাতিল" onClick={() => reject.mutate(p.id)} disabled={reject.isPending}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {p.status === "success" && (
                        <Button size="sm" variant="ghost" title="POS রিসিপ্ট প্রিন্ট" onClick={() => openReceipt(p.id)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {q.data?.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">কোন পেমেন্ট নেই</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
