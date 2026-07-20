import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSales } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/app/sales/")({ component: Page });

function Page() {
  const nav = useNavigate();
  const fn = useServerFn(listSales);
  const q = useQuery({ queryKey: ["sales"], queryFn: () => fn({ data: {} }) });

  const typeLabel: Record<string, string> = { cash: "নগদ", due: "বাকি", installment: "কিস্তি" };
  const typeVariant: Record<string, any> = { cash: "default", due: "secondary", installment: "outline" };

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">বিক্রয়</h1>
          <p className="text-sm text-muted-foreground">সাম্প্রতিক ইনভয়েস</p>
        </div>
        <Button className="shrink-0" onClick={() => nav({ to: "/app/sales/new" })}><Plus className="mr-2 h-4 w-4" /> নতুন বিক্রয়</Button>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">তারিখ</th>
              <th className="px-4 py-3">ইনভয়েস</th>
              <th className="px-4 py-3">কাস্টমার</th>
              <th className="px-4 py-3">ধরন</th>
              <th className="px-4 py-3 text-right">মোট</th>
              <th className="px-4 py-3 text-right">পরিশোধ</th>
              <th className="px-4 py-3 text-right">বাকি</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.map((s: any) => (
              <tr key={s.id} className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => nav({ to: "/app/sales/$saleId", params: { saleId: s.id } })}>
                <td className="px-4 py-3">{new Date(s.sale_date).toLocaleDateString("bn-BD")}</td>
                <td className="px-4 py-3 font-medium text-primary underline-offset-2 hover:underline">{s.invoice_no ?? s.id.slice(0, 8)}</td>
                <td className="px-4 py-3">{s.customer?.name ?? <span className="text-muted-foreground">Walk-in</span>}</td>
                <td className="px-4 py-3"><Badge variant={typeVariant[s.sale_type]}>{typeLabel[s.sale_type]}</Badge></td>
                <td className="px-4 py-3 text-right">৳{Number(s.total).toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-green-600">৳{Number(s.paid).toFixed(2)}</td>
                <td className={`px-4 py-3 text-right ${Number(s.due) > 0 ? "text-orange-600 font-semibold" : ""}`}>৳{Number(s.due).toFixed(2)}</td>
              </tr>
            ))}
            {q.data?.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">এখনো কোনো বিক্রয় নেই। <Link to="/app/sales/new" className="text-primary underline">নতুন বিক্রয় শুরু করুন</Link></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
