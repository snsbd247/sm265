import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { Boxes, Filter, RefreshCw, AlertCircle } from "lucide-react";

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
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [productFilter, setProductFilter] = useState<string>("all");

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

  const moves = moveQ.data ?? [];
  const filteredMoves = useMemo(() => {
    return moves.filter((m: any) => {
      if (typeFilter !== "all" && m.movement_type !== typeFilter) return false;
      if (productFilter !== "all" && m.product_id !== productFilter) return false;
      const d = (m.created_at ?? "").slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [moves, typeFilter, productFilter, dateFrom, dateTo]);

  return (
    <div className="p-4 sm:p-6">
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/app">ড্যাশবোর্ড</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/app/products">পণ্য সমূহ</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>স্টক লেজার</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
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
        <div className="flex items-center justify-between gap-2 border-b p-3">
          <div className="font-semibold">স্টক মুভমেন্ট ({filteredMoves.length}/{moves.length})</div>
          <Button variant="ghost" size="sm" onClick={() => moveQ.refetch()} disabled={moveQ.isFetching}>
            <RefreshCw className={`h-4 w-4 ${moveQ.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2 border-b bg-muted/30 p-3">
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Filter className="h-3.5 w-3.5" /> ফিল্টার:</div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="ধরন" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব ধরন</SelectItem>
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="h-8 w-48 text-xs"><SelectValue placeholder="পণ্য" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব পণ্য</SelectItem>
              {(prodQ.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" className="h-8 w-36 text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From" />
          <Input type="date" className="h-8 w-36 text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To" />
          {(typeFilter !== "all" || productFilter !== "all" || dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" className="h-8" onClick={() => { setTypeFilter("all"); setProductFilter("all"); setDateFrom(""); setDateTo(""); }}>রিসেট</Button>
          )}
        </div>
        {moveQ.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : moveQ.error ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{(moveQ.error as any).message}</p>
            <Button variant="outline" size="sm" onClick={() => moveQ.refetch()}><RefreshCw className="mr-2 h-4 w-4" /> আবার চেষ্টা</Button>
          </div>
        ) : (
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
            {filteredMoves.map((m: any) => (
              <tr key={m.id} className="border-b">
                <td className="p-3 text-xs">{new Date(m.created_at).toLocaleString("bn-BD")}</td>
                <td className="p-3">
                  {m.product_id ? (
                    <Link to="/app/products/$productId" params={{ productId: m.product_id }} className="text-primary hover:underline">
                      {m.product?.name ?? "-"}
                    </Link>
                  ) : (m.product?.name ?? "-")}
                </td>
                <td className="p-3"><Badge variant="outline">{TYPE_LABEL[m.movement_type] ?? m.movement_type}</Badge></td>
                <td className="p-3 text-right font-medium">{m.quantity}</td>
                <td className="p-3 text-muted-foreground">{m.note ?? "-"}</td>
              </tr>
            ))}
            {filteredMoves.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">কোনো মুভমেন্ট নেই</td></tr>}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
