import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPurchases } from "@/lib/purchases.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/app/purchases/")({ component: Page });

function Page() {
  const fn = useServerFn(listPurchases);
  const q = useQuery({ queryKey: ["purchases"], queryFn: () => fn({ data: {} }) });

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">ক্রয়</h1>
          <p className="text-sm text-muted-foreground">সাপ্লায়ার থেকে ক্রয়ের ইতিহাস</p>
        </div>
        <Link to="/app/purchases/new">
          <Button className="shrink-0"><Plus className="mr-2 h-4 w-4" /> নতুন ক্রয়</Button>
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">তারিখ</th>
              <th className="px-4 py-3">ইনভয়েস</th>
              <th className="px-4 py-3">সাপ্লায়ার</th>
              <th className="px-4 py-3 text-right">মোট</th>
              <th className="px-4 py-3 text-right">পরিশোধ</th>
              <th className="px-4 py-3 text-right">বাকি</th>
              <th className="px-4 py-3">মেথড</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-3">{new Date(p.purchase_date).toLocaleDateString("bn-BD")}</td>
                <td className="px-4 py-3 font-medium">{p.invoice_no ?? "-"}</td>
                <td className="px-4 py-3">{p.supplier?.name ?? "-"}</td>
                <td className="px-4 py-3 text-right">৳{Number(p.total).toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-green-600">৳{Number(p.paid).toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-orange-600">৳{Number(p.due).toFixed(2)}</td>
                <td className="px-4 py-3"><Badge variant="outline">{p.payment_method}</Badge></td>
              </tr>
            ))}
            {q.data?.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">এখনো ক্রয় নেই</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
