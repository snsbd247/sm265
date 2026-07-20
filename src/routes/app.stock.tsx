import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProducts, listStockMovements, adjustStock } from "@/lib/inventory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { Boxes } from "lucide-react";

export const Route = createFileRoute("/app/stock")({ component: Page });

const TYPE_LABEL: Record<string, string> = {
  purchase: "ক্রয়", sale: "বিক্রয়", adjustment: "সমন্বয়",
  return_in: "ফেরত (ইন)", return_out: "ফেরত (আউট)", opening: "প্রারম্ভিক",
};

function Page() {
  const qc = useQueryClient();
  const prodFn = useServerFn(listProducts);
  const moveFn = useServerFn(listStockMovements);
  const adjFn = useServerFn(adjustStock);

  const prodQ = useQuery({ queryKey: ["products"], queryFn: () => prodFn() });
  const moveQ = useQuery({ queryKey: ["stock-movements"], queryFn: () => moveFn({ data: {} }) });

  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");

  const adjust = useMutation({
    mutationFn: (d: any) => adjFn({ data: d }),
    onSuccess: () => {
      toast.success("স্টক সমন্বয় হয়েছে");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const lowStock = (prodQ.data ?? []).filter((p: any) => Number(p.stock_quantity) <= Number(p.low_stock_alert));

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">স্টক ম্যানেজমেন্ট</h1>
          <p className="text-sm text-muted-foreground">লো স্টক অ্যালার্ট: {lowStock.length}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="shrink-0"><Boxes className="mr-2 h-4 w-4" /> স্টক সমন্বয়</Button></DialogTrigger>
          <DialogContent className="max-h-[92dvh] overflow-y-auto">
            <DialogHeader><DialogTitle>স্টক সমন্বয়</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const qty = Number(fd.get("quantity") ?? 0);
              if (!productId || qty === 0) { toast.error("পণ্য ও পরিমাণ দিন"); return; }
              adjust.mutate({ product_id: productId, quantity: qty, note: String(fd.get("note") ?? "") || null });
            }} className="space-y-3">
              <div>
                <Label>পণ্য</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>{(prodQ.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} (স্টক: {p.stock_quantity})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>পরিমাণ (+ যোগ, − কম)</Label>
                <Input name="quantity" type="number" step="0.01" required placeholder="যেমন: 10 বা -5" />
              </div>
              <div><Label>নোট</Label><Textarea name="note" /></div>
              <DialogFooter><Button type="submit" disabled={adjust.isPending}>সংরক্ষণ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {lowStock.length > 0 && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <div className="font-semibold text-destructive">⚠️ লো স্টক</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {lowStock.map((p: any) => (
              <Badge key={p.id} variant="destructive">{p.name} — {p.stock_quantity} {p.unit?.short_name ?? ""}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl border bg-card">
        <div className="border-b p-3 font-semibold">স্টক মুভমেন্ট (সর্বশেষ ২০০টি)</div>
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-3">তারিখ</th>
              <th className="p-3">পণ্য</th>
              <th className="p-3">ধরণ</th>
              <th className="p-3 text-right">পরিমাণ</th>
              <th className="p-3">নোট</th>
            </tr>
          </thead>
          <tbody>
            {(moveQ.data ?? []).map((m: any) => (
              <tr key={m.id} className="border-b">
                <td className="p-3 text-xs">{new Date(m.created_at).toLocaleString("bn-BD")}</td>
                <td className="p-3">{m.product?.name ?? "-"}</td>
                <td className="p-3"><Badge variant="outline">{TYPE_LABEL[m.movement_type] ?? m.movement_type}</Badge></td>
                <td className="p-3 text-right font-medium">{m.quantity}</td>
                <td className="p-3 text-muted-foreground">{m.note ?? "-"}</td>
              </tr>
            ))}
            {(moveQ.data ?? []).length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">কোনো মুভমেন্ট নেই</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
