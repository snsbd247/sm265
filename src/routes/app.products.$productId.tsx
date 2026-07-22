import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProductDetail } from "@/lib/inventory.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowLeft, Package, TrendingDown, Settings2, PlusCircle, RefreshCw, AlertCircle, Filter } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/app/products/$productId")({
  parseParams: (p) => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(p.productId)) throw new Error("Invalid product id");
    return { productId: p.productId };
  },
  component: Page,
});

const MOVE_LABEL: Record<string, { label: string; cls: string; icon: any }> = {
  purchase: { label: "ক্রয়", cls: "bg-emerald-100 text-emerald-700", icon: PlusCircle },
  sale: { label: "বিক্রয়", cls: "bg-rose-100 text-rose-700", icon: TrendingDown },
  return_in: { label: "ফেরত (ইন)", cls: "bg-blue-100 text-blue-700", icon: PlusCircle },
  return_out: { label: "ফেরত (আউট)", cls: "bg-amber-100 text-amber-700", icon: TrendingDown },
  adjustment: { label: "সমন্বয়", cls: "bg-violet-100 text-violet-700", icon: Settings2 },
  opening: { label: "প্রারম্ভিক", cls: "bg-slate-100 text-slate-700", icon: Package },
};

function Page() {
  const { productId } = Route.useParams();
  const fn = useServerFn(getProductDetail);
  const q = useQuery({ queryKey: ["product-detail", productId], queryFn: () => fn({ data: { product_id: productId } }) });

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  if (q.isLoading) return <DetailSkeleton />;
  if (q.error) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Crumbs name={null} />
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-10 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">পণ্য বিবরণ লোড করা যায়নি</p>
            <p className="mt-1 text-sm text-muted-foreground">{(q.error as any).message}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => q.refetch()}><RefreshCw className="mr-2 h-4 w-4" /> আবার চেষ্টা</Button>
            <Link to="/app/products"><Button><ArrowLeft className="mr-2 h-4 w-4" /> পণ্য তালিকা</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  const p = q.data?.product;
  const totals = q.data?.totals;
  const moves = q.data?.movements ?? [];
  const filteredMoves = useMemo(() => {
    return moves.filter((m: any) => {
      if (typeFilter !== "all" && m.movement_type !== typeFilter) return false;
      const d = (m.created_at ?? "").slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [moves, typeFilter, dateFrom, dateTo]);
  const low = Number(p?.stock_quantity ?? 0) <= Number(p?.low_stock_alert ?? 0);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Crumbs name={p?.name ?? null} />

      <div className="grad-violet relative overflow-hidden rounded-2xl p-5 shadow-lg">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur">
              <Package className="h-3 w-3" /> পণ্য বিবরণ
            </div>
            <h1 className="mt-2 truncate text-2xl font-bold">{p?.name}</h1>
            <p className="mt-1 text-sm opacity-90">
              {p?.category?.name ?? "সাধারণ"} • SKU: {p?.sku ?? "-"} {p?.barcode ? `• ${p.barcode}` : ""}
            </p>
          </div>
          <Badge variant={low ? "destructive" : "secondary"} className="shrink-0 text-base">
            {Number(p?.stock_quantity ?? 0)} {p?.unit?.short_name ?? ""}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "মোট ক্রয়", value: totals?.purchased ?? 0, cls: "soft-emerald", grad: "grad-emerald", icon: PlusCircle },
          { label: "মোট বিক্রয়", value: totals?.sold ?? 0, cls: "soft-rose", grad: "grad-rose", icon: TrendingDown },
          { label: "সমন্বয়", value: totals?.adjustments ?? 0, cls: "soft-violet", grad: "grad-violet", icon: Settings2 },
          { label: "বর্তমান স্টক", value: p?.stock_quantity ?? 0, cls: low ? "soft-rose" : "soft-blue", grad: low ? "grad-rose" : "grad-blue", icon: Package },
        ].map((s) => (
          <div key={s.label} className={`card-hover relative overflow-hidden rounded-xl border p-4 shadow-sm ${s.cls}`}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-700">{s.label}</p>
                <p className="mt-1 text-xl font-extrabold text-slate-900">{Number(s.value)} {p?.unit?.short_name ?? ""}</p>
              </div>
              <div className={`shrink-0 rounded-lg p-2 shadow-md ${s.grad}`}><s.icon className="h-4 w-4" /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="space-y-2 p-5 text-sm">
            <h3 className="mb-3 font-semibold">মূল্য তথ্য</h3>
            <div className="flex justify-between"><span className="text-muted-foreground">ক্রয় মূল্য</span><span className="font-medium">৳{Number(p?.purchase_price ?? 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">বিক্রয় মূল্য</span><span className="font-medium">৳{Number(p?.sale_price ?? 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">লাভ / একক</span><span className="font-semibold text-emerald-600">৳{(Number(p?.sale_price ?? 0) - Number(p?.purchase_price ?? 0)).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Low stock alert</span><span>{Number(p?.low_stock_alert ?? 0)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">একক</span><span>{p?.unit?.name ?? "-"}</span></div>
            {p?.description && <div className="border-t pt-2 text-xs text-muted-foreground">{p.description}</div>}
          </CardContent>
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <div className="grad-blue px-5 py-3">
            <h2 className="font-semibold">স্টক মুভমেন্ট ({filteredMoves.length}/{moves.length})</h2>
          </div>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-end gap-2 border-b bg-muted/30 p-3">
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Filter className="h-3.5 w-3.5" /> ফিল্টার:</div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব ধরন</SelectItem>
                  {Object.entries(MOVE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" className="h-8 w-36 text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From" />
              <Input type="date" className="h-8 w-36 text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To" />
              {(typeFilter !== "all" || dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="h-8" onClick={() => { setTypeFilter("all"); setDateFrom(""); setDateTo(""); }}>রিসেট</Button>
              )}
            </div>
            {filteredMoves.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">কোনো স্টক মুভমেন্ট নেই</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">তারিখ</th>
                      <th className="px-4 py-2 text-left font-medium">ধরন</th>
                      <th className="px-4 py-2 text-right font-medium">পরিমাণ</th>
                      <th className="px-4 py-2 text-right font-medium">দাম</th>
                      <th className="px-4 py-2 text-left font-medium">নোট</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredMoves.map((m: any) => {
                      const meta = MOVE_LABEL[m.movement_type] ?? { label: m.movement_type, cls: "bg-slate-100 text-slate-700", icon: Package };
                      const sign = ["sale", "return_out"].includes(m.movement_type) ? "-" : "+";
                      return (
                        <tr key={m.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("bn-BD")}</td>
                          <td className="px-4 py-2.5"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}><meta.icon className="h-3 w-3" /> {meta.label}</span></td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${sign === "-" ? "text-rose-600" : "text-emerald-600"}`}>{sign}{Number(m.quantity)}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{m.unit_cost != null ? `৳${Number(m.unit_cost).toFixed(2)}` : "-"}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.note ?? "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Crumbs({ name }: { name: string | null }) {
  return (
    <Breadcrumb>
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
          <BreadcrumbPage className="max-w-[220px] truncate">{name ?? "বিবরণ"}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-1" />
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}
