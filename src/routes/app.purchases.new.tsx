import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSuppliers, createPurchase } from "@/lib/purchases.functions";
import { listProducts } from "@/lib/inventory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/searchable-select";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/purchases/new")({ component: Page });

type Line = { product_id: string; quantity: number; unit_cost: number };

function Page() {
  const nav = useNavigate();
  const suppFn = useServerFn(listSuppliers);
  const prodFn = useServerFn(listProducts);
  const createFn = useServerFn(createPurchase);

  const supp = useQuery({ queryKey: ["suppliers"], queryFn: () => suppFn() });
  const prod = useQuery({ queryKey: ["products"], queryFn: () => prodFn() });

  const [supplierId, setSupplierId] = useState<string>("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState<"cash" | "bkash" | "bank" | "due">("cash");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + (l.quantity || 0) * (l.unit_cost || 0), 0), [lines]);
  const total = subtotal - discount;
  const due = total - paid;

  const addLine = () => setLines([...lines, { product_id: "", quantity: 1, unit_cost: 0 }]);
  const updateLine = (i: number, patch: Partial<Line>) => {
    const next = [...lines];
    next[i] = { ...next[i], ...patch };
    // Auto-fill unit cost when selecting product
    if (patch.product_id) {
      const p = prod.data?.find((x: any) => x.id === patch.product_id);
      if (p && !next[i].unit_cost) next[i].unit_cost = Number(p.purchase_price ?? 0);
    }
    setLines(next);
  };
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const m = useMutation({
    mutationFn: () => createFn({
      data: {
        supplier_id: supplierId || null,
        invoice_no: invoiceNo || null,
        purchase_date: purchaseDate,
        discount, paid, payment_method: method,
        note: note || null,
        items: lines.filter(l => l.product_id && l.quantity > 0),
      },
    }),
    onSuccess: () => { toast.success("ক্রয় সংরক্ষিত"); nav({ to: "/app/purchases" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.filter(l => l.product_id).length === 0) return toast.error("কমপক্ষে একটি পণ্য যোগ করুন");
    m.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-4 sm:p-6">
      <h1 className="truncate text-xl font-bold sm:text-2xl">নতুন ক্রয়</h1>

      <div className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 md:grid-cols-4">
        <div>
          <Label>সাপ্লায়ার</Label>
          <SearchableSelect
            value={supplierId}
            onChange={setSupplierId}
            placeholder="বাছাই করুন"
            searchPlaceholder="নাম / ফোন সার্চ..."
            options={(supp.data ?? []).map((s: any) => ({
              value: s.id,
              label: s.name,
              hint: s.phone ?? "",
              keywords: `${s.name} ${s.phone ?? ""}`,
            }))}
          />
        </div>
        <div><Label>ইনভয়েস নং</Label><Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} /></div>
        <div><Label>তারিখ</Label><Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div>
        <div>
          <Label>পেমেন্ট মেথড</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">নগদ</SelectItem>
              <SelectItem value="bkash">বিকাশ</SelectItem>
              <SelectItem value="bank">ব্যাংক</SelectItem>
              <SelectItem value="due">বাকি</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b p-4">
          <h2 className="font-semibold">পণ্য</h2>
          <Button type="button" size="sm" onClick={addLine}><Plus className="mr-1 h-4 w-4" /> লাইন যোগ</Button>
        </div>
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">পণ্য</th>
              <th className="px-3 py-2 w-28">পরিমাণ</th>
              <th className="px-3 py-2 w-32">ইউনিট মূল্য</th>
              <th className="px-3 py-2 w-32 text-right">মোট</th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2">
                  <SearchableSelect
                    value={l.product_id}
                    onChange={(v) => updateLine(i, { product_id: v })}
                    placeholder="পণ্য বাছাই"
                    searchPlaceholder="নাম / SKU..."
                    options={(prod.data ?? []).map((p: any) => ({
                      value: p.id,
                      label: p.name,
                      hint: `স্টক ${Number(p.stock_quantity ?? 0)}`,
                      keywords: `${p.name} ${p.sku ?? ""} ${p.barcode ?? ""}`,
                    }))}
                  />
                </td>
                <td className="px-3 py-2"><Input type="number" step="0.001" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} /></td>
                <td className="px-3 py-2"><Input type="number" step="0.01" value={l.unit_cost} onChange={(e) => updateLine(i, { unit_cost: Number(e.target.value) })} /></td>
                <td className="px-3 py-2 text-right">৳{(l.quantity * l.unit_cost).toFixed(2)}</td>
                <td className="px-3 py-2"><Button type="button" size="sm" variant="ghost" onClick={() => removeLine(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">"লাইন যোগ" চাপুন</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <Label>নোট</Label>
          <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><span>সাবটোটাল</span><span>৳{subtotal.toFixed(2)}</span></div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <span>ছাড়</span>
            <Input type="number" step="0.01" className="w-32" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t pt-2 text-lg font-bold"><span>মোট</span><span>৳{total.toFixed(2)}</span></div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <span>পরিশোধ</span>
            <Input type="number" step="0.01" className="w-32" value={paid} onChange={(e) => setPaid(Number(e.target.value))} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 font-semibold text-orange-600"><span>বাকি</span><span>৳{due.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => nav({ to: "/app/purchases" })}>বাতিল</Button>
        <Button type="submit" disabled={m.isPending}>সংরক্ষণ</Button>
      </div>
    </form>
  );
}
