import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCustomers, createSale } from "@/lib/sales.functions";
import { listProducts } from "@/lib/inventory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/searchable-select";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { Plus, Trash2, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/app/sales/new")({ component: Page });

type Line = { product_id: string; quantity: number; unit_price: number; unit_cost: number; stock: number; name: string; unit?: string };
type SaleType = "cash" | "due" | "installment";

function Page() {
  const nav = useNavigate();
  const custFn = useServerFn(listCustomers);
  const prodFn = useServerFn(listProducts);
  const createFn = useServerFn(createSale);

  const cust = useQuery({ queryKey: ["customers"], queryFn: () => custFn() });
  const prod = useQuery({ queryKey: ["products"], queryFn: () => prodFn() });

  const [customerId, setCustomerId] = useState<string>("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState<"cash" | "bkash" | "bank" | "due">("cash");
  const [saleType, setSaleType] = useState<SaleType>("cash");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const [installments, setInstallments] = useState(3);
  const [instFreq, setInstFreq] = useState<"weekly" | "monthly">("monthly");
  const [instStart, setInstStart] = useState(new Date().toISOString().slice(0, 10));

  const subtotal = useMemo(() => lines.reduce((s, l) => s + (l.quantity || 0) * (l.unit_price || 0), 0), [lines]);
  const total = Math.max(0, subtotal - discount);
  const effectivePaid = saleType === "cash" ? total : paid;
  const due = Math.max(0, total - effectivePaid);

  const addProduct = (pid: string) => {
    if (!pid) return;
    const p = prod.data?.find((x: any) => x.id === pid);
    if (!p) return;
    const existing = lines.findIndex((l) => l.product_id === pid);
    if (existing >= 0) {
      const next = [...lines];
      next[existing] = { ...next[existing], quantity: next[existing].quantity + 1 };
      setLines(next);
    } else {
      setLines([...lines, {
        product_id: p.id, quantity: 1,
        unit_price: Number(p.sale_price ?? 0),
        unit_cost: Number(p.purchase_price ?? 0),
        stock: Number(p.stock_quantity ?? 0),
        name: p.name, unit: p.unit?.short_name,
      }]);
    }
  };

  const updateLine = (i: number, patch: Partial<Line>) => {
    const next = [...lines]; next[i] = { ...next[i], ...patch }; setLines(next);
  };
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const m = useMutation({
    mutationFn: () => createFn({
      data: {
        customer_id: customerId || null,
        invoice_no: invoiceNo || null,
        sale_date: saleDate,
        discount, paid: effectivePaid,
        payment_method: saleType === "cash" ? method : (saleType === "due" ? "due" : method),
        sale_type: saleType,
        note: note || null,
        items: lines.map(l => ({
          product_id: l.product_id, quantity: l.quantity,
          unit_price: l.unit_price, unit_cost: l.unit_cost,
        })),
        installments: saleType === "installment" ? installments : null,
        installment_frequency: instFreq,
        installment_start: instStart,
      },
    }),
    onSuccess: () => { toast.success("বিক্রয় সংরক্ষিত"); nav({ to: "/app/sales" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) return toast.error("কমপক্ষে একটি পণ্য যোগ করুন");
    if (saleType !== "cash" && !customerId) return toast.error("বাকি/কিস্তি বিক্রির জন্য কাস্টমার বাছাই করুন");
    for (const l of lines) {
      if (l.quantity > l.stock) return toast.error(`"${l.name}" এর স্টক অপর্যাপ্ত (${l.stock})`);
    }
    m.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-4 sm:p-6">
      <div className="flex min-w-0 items-center gap-2">
        <ShoppingCart className="h-6 w-6 shrink-0 text-primary" />
        <h1 className="truncate text-xl font-bold sm:text-2xl">নতুন বিক্রয় (POS)</h1>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 md:grid-cols-4">
        <div>
          <Label>বিক্রয়ের ধরন</Label>
          <Select value={saleType} onValueChange={(v) => { setSaleType(v as SaleType); if (v === "cash") setPaid(0); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">নগদ বিক্রি</SelectItem>
              <SelectItem value="due">বাকিতে বিক্রি</SelectItem>
              <SelectItem value="installment">কিস্তিতে বিক্রি</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>কাস্টমার {saleType !== "cash" && <span className="text-destructive">*</span>}</Label>
          <SearchableSelect
            value={customerId}
            onChange={setCustomerId}
            placeholder={saleType === "cash" ? "Walk-in (ঐচ্ছিক)" : "বাছাই করুন"}
            searchPlaceholder="নাম / ফোন সার্চ..."
            options={(cust.data ?? []).map((c: any) => ({
              value: c.id,
              label: c.name,
              hint: c.phone ?? "",
              keywords: `${c.name} ${c.phone ?? ""}`,
            }))}
          />
        </div>
        <div><Label>ইনভয়েস নং</Label><Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="স্বয়ংক্রিয় হলে ফাঁকা রাখুন" /></div>
        <div><Label>তারিখ</Label><Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} /></div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="border-b p-4">
          <Label className="mb-1 block">পণ্য যোগ করুন</Label>
          <SearchableSelect
            value=""
            onChange={(v) => addProduct(v)}
            placeholder="পণ্য বাছাই করে যোগ করুন"
            searchPlaceholder="নাম / SKU / বারকোড..."
            clearOnSelect
            options={(prod.data ?? []).map((p: any) => ({
              value: p.id,
              label: p.name,
              hint: `স্টক ${Number(p.stock_quantity).toFixed(2)} • ৳${Number(p.sale_price).toFixed(2)}`,
              keywords: `${p.name} ${p.sku ?? ""} ${p.barcode ?? ""}`,
            }))}
          />
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
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-muted-foreground">স্টক: {l.stock.toFixed(2)} {l.unit ?? ""}</div>
                </td>
                <td className="px-3 py-2"><Input type="number" step="0.001" min="0" value={l.quantity}
                  onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} /></td>
                <td className="px-3 py-2"><Input type="number" step="0.01" value={l.unit_price}
                  onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })} /></td>
                <td className="px-3 py-2 text-right font-medium">৳{(l.quantity * l.unit_price).toFixed(2)}</td>
                <td className="px-3 py-2"><Button type="button" size="sm" variant="ghost" onClick={() => removeLine(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">উপরের সার্চ থেকে পণ্য যোগ করুন</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div><Label>নোট</Label><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>

          {saleType === "installment" && (
            <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-3">
              <div><Label>কিস্তি সংখ্যা</Label><Input type="number" min="1" max="60" value={installments}
                onChange={(e) => setInstallments(Math.max(1, Number(e.target.value)))} /></div>
              <div><Label>ফ্রিকোয়েন্সি</Label>
                <Select value={instFreq} onValueChange={(v) => setInstFreq(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">সাপ্তাহিক</SelectItem>
                    <SelectItem value="monthly">মাসিক</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>শুরুর তারিখ</Label><Input type="date" value={instStart} onChange={(e) => setInstStart(e.target.value)} /></div>
              {due > 0 && (
                <div className="text-xs text-muted-foreground sm:col-span-3">
                  প্রতি কিস্তি ≈ ৳{(due / installments).toFixed(2)} × {installments} = ৳{due.toFixed(2)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><span>সাবটোটাল</span><span>৳{subtotal.toFixed(2)}</span></div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <span>ছাড়</span>
            <Input type="number" step="0.01" className="w-32" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t pt-2 text-lg font-bold"><span>মোট</span><span>৳{total.toFixed(2)}</span></div>

          {saleType !== "cash" && (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <span>এখন পরিশোধ</span>
                <Input type="number" step="0.01" min="0" max={total} className="w-32" value={paid}
                  onChange={(e) => setPaid(Number(e.target.value))} />
              </div>
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
            </>
          )}

          {saleType === "cash" && (
            <div>
              <Label>পেমেন্ট মেথড</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">নগদ</SelectItem>
                  <SelectItem value="bkash">বিকাশ</SelectItem>
                  <SelectItem value="bank">ব্যাংক</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t pt-2">
            <span>পরিশোধিত</span><span className="text-green-600 font-semibold">৳{effectivePaid.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><span>বাকি</span><span className="font-semibold text-orange-600">৳{due.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => nav({ to: "/app/sales" })}>বাতিল</Button>
        <Button type="submit" disabled={m.isPending}><Plus className="mr-1 h-4 w-4" /> বিক্রয় সংরক্ষণ</Button>
      </div>
    </form>
  );
}
