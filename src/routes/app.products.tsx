import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProducts, saveProduct, deleteProduct, listCategories, listUnits } from "@/lib/inventory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Search, MoreVertical, Eye } from "lucide-react";

export const Route = createFileRoute("/app/products")({ component: Page });

function Page() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listProducts);
  const saveFn = useServerFn(saveProduct);
  const delFn = useServerFn(deleteProduct);
  const catFn = useServerFn(listCategories);
  const unitFn = useServerFn(listUnits);

  const prodQ = useQuery({ queryKey: ["products"], queryFn: () => listFn() });
  const catQ = useQuery({ queryKey: ["categories"], queryFn: () => catFn() });
  const unitQ = useQuery({ queryKey: ["units"], queryFn: () => unitFn() });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");

  const save = useMutation({
    mutationFn: (d: any) => saveFn({ data: d }),
    onSuccess: () => { toast.success("সংরক্ষিত"); qc.invalidateQueries({ queryKey: ["products"] }); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("মুছে ফেলা হয়েছে"); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list = prodQ.data ?? [];
    return list.filter((p: any) => {
      const s = search.toLowerCase();
      const match = !s || p.name.toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s) || (p.barcode ?? "").toLowerCase().includes(s);
      const catOk = catFilter === "all" || p.category_id === catFilter;
      return match && catOk;
    });
  }, [prodQ.data, search, catFilter]);

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">পণ্য সমূহ</h1>
          <p className="text-sm text-muted-foreground">মোট {prodQ.data?.length ?? 0} টি পণ্য</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild><Button className="shrink-0"><Plus className="mr-2 h-4 w-4" /> নতুন পণ্য</Button></DialogTrigger>
          <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "এডিট" : "নতুন"} পণ্য</DialogTitle></DialogHeader>
            <ProductForm
              editing={editing}
              categories={catQ.data ?? []}
              units={unitQ.data ?? []}
              onSubmit={(d: any) => save.mutate(d)}
              submitting={save.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="নাম / SKU / বারকোড..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব ক্যাটাগরি</SelectItem>
            {(catQ.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-3">নাম</th>
              <th className="p-3">ক্যাটাগরি</th>
              <th className="p-3">SKU</th>
              <th className="p-3 text-right">ক্রয় মূল্য</th>
              <th className="p-3 text-right">বিক্রয় মূল্য</th>
              <th className="p-3 text-right">স্টক</th>
              <th className="p-3 text-right">অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p: any) => {
              const low = Number(p.stock_quantity) <= Number(p.low_stock_alert);
              return (
                <tr
                  key={p.id}
                  onClick={() => navigate({ to: "/app/products/$productId", params: { productId: p.id } })}
                  className="cursor-pointer border-b hover:bg-muted/40"
                >
                  <td className="p-3">
                    <div className="font-medium">{p.name}</div>
                    {p.barcode && <div className="text-xs text-muted-foreground">{p.barcode}</div>}
                  </td>
                  <td className="p-3">{p.category?.name ?? "-"}</td>
                  <td className="p-3">{p.sku ?? "-"}</td>
                  <td className="p-3 text-right">৳{Number(p.purchase_price).toFixed(2)}</td>
                  <td className="p-3 text-right">৳{Number(p.sale_price).toFixed(2)}</td>
                  <td className="p-3 text-right">
                    <Badge variant={low ? "destructive" : "secondary"}>
                      {Number(p.stock_quantity)} {p.unit?.short_name ?? ""}
                    </Badge>
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate({ to: "/app/products/$productId", params: { productId: p.id } })}>
                          <Eye className="mr-2 h-4 w-4" /> বিস্তারিত / স্টক লেজার
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditing(p); setOpen(true); }}>
                          <Pencil className="mr-2 h-4 w-4" /> এডিট
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("মুছবেন?")) del.mutate(p.id); }}>
                          <Trash2 className="mr-2 h-4 w-4" /> মুছে ফেলুন
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">কোনো পণ্য নেই</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductForm({ editing, categories, units, onSubmit, submitting }: any) {
  const [categoryId, setCategoryId] = useState<string>(editing?.category_id ?? "");
  const [unitId, setUnitId] = useState<string>(editing?.unit_id ?? "");

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      onSubmit({
        id: editing?.id,
        name: String(fd.get("name") ?? ""),
        sku: String(fd.get("sku") ?? "") || null,
        barcode: String(fd.get("barcode") ?? "") || null,
        category_id: categoryId || null,
        unit_id: unitId || null,
        purchase_price: Number(fd.get("purchase_price") ?? 0),
        sale_price: Number(fd.get("sale_price") ?? 0),
        low_stock_alert: Number(fd.get("low_stock_alert") ?? 0),
        opening_stock: editing ? undefined : Number(fd.get("opening_stock") ?? 0),
        description: String(fd.get("description") ?? "") || null,
        is_active: true,
      });
    }} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Label>নাম *</Label><Input name="name" required defaultValue={editing?.name ?? ""} /></div>
      <div><Label>SKU</Label><Input name="sku" defaultValue={editing?.sku ?? ""} /></div>
      <div><Label>বারকোড</Label><Input name="barcode" defaultValue={editing?.barcode ?? ""} /></div>
      <div>
        <Label>ক্যাটাগরি</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
          <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>একক</Label>
        <Select value={unitId} onValueChange={setUnitId}>
          <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
          <SelectContent>{units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.short_name})</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>ক্রয় মূল্য *</Label><Input name="purchase_price" type="number" step="0.01" required defaultValue={editing?.purchase_price ?? 0} /></div>
      <div><Label>বিক্রয় মূল্য *</Label><Input name="sale_price" type="number" step="0.01" required defaultValue={editing?.sale_price ?? 0} /></div>
      <div><Label>Low stock alert</Label><Input name="low_stock_alert" type="number" step="0.01" defaultValue={editing?.low_stock_alert ?? 0} /></div>
      {!editing && <div><Label>প্রারম্ভিক স্টক</Label><Input name="opening_stock" type="number" step="0.01" defaultValue={0} /></div>}
      <div className="sm:col-span-2"><Label>বিবরণ</Label><Textarea name="description" defaultValue={editing?.description ?? ""} /></div>
      <DialogFooter className="sm:col-span-2"><Button type="submit" disabled={submitting}>সংরক্ষণ</Button></DialogFooter>
    </form>
  );
}
