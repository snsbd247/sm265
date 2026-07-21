import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getSale, cancelSale, createSaleReturn } from "@/lib/sales.functions";
import { getMyShop } from "@/lib/shop.functions";
import { getCurrentShift } from "@/lib/shifts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, XCircle, RotateCcw, Printer } from "lucide-react";
import { ReceiptShell } from "@/components/receipt-preview";
import { SaleDeliveryHistory } from "@/components/invoice-delivery-history";
import { SaleRevisionsList } from "@/components/sale-revisions-list";
import {
  useReceiptConfig,
  receiptStyleCss,
  separatorChar,
} from "@/lib/receipt-config";

export const Route = createFileRoute("/app/sales/$saleId")({ component: InvoicePage });

const fmt = (n: number) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const typeLabel: Record<string, string> = { cash: "নগদ", due: "বাকি", installment: "কিস্তি" };

function InvoicePage() {
  const { saleId } = useParams({ from: "/app/sales/$saleId" });
  const nav = useNavigate();
  const qc = useQueryClient();
  const saleFn = useServerFn(getSale);
  const shopFn = useServerFn(getMyShop);
  const cancelFn = useServerFn(cancelSale);
  const returnFn = useServerFn(createSaleReturn);
  const shiftFn = useServerFn(getCurrentShift);

  const q = useQuery({ queryKey: ["sale", saleId], queryFn: () => saleFn({ data: { id: saleId } }) });
  const shopQ = useQuery({ queryKey: ["my-shop"], queryFn: () => shopFn() });
  const shiftQ = useQuery({ queryKey: ["shift-current"], queryFn: () => shiftFn() });
  const { cfg, ready } = useReceiptConfig();

  const sale: any = q.data?.sale;
  const items: any[] = q.data?.items ?? [];
  const installments: any[] = q.data?.installments ?? [];
  const shop: any = shopQ.data?.shop;

  const [returnOpen, setReturnOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundMethod, setRefundMethod] = useState<"cash" | "card" | "bkash" | "bank">("cash");
  const [returnReason, setReturnReason] = useState("");

  const cancelM = useMutation({
    mutationFn: (reason: string) => cancelFn({ data: { sale_id: saleId, reason } }),
    onSuccess: () => {
      toast.success("বিক্রয় ক্যান্সেল হয়েছে");
      qc.invalidateQueries({ queryKey: ["sale", saleId] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["shop-notifications"] });
      setCancelOpen(false); setCancelReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const returnM = useMutation({
    mutationFn: () => returnFn({ data: {
      sale_id: saleId,
      items: Object.entries(returnQty).filter(([, q]) => q > 0).map(([sale_item_id, quantity]) => ({ sale_item_id, quantity })),
      refund_amount: refundAmount, refund_method: refundMethod, reason: returnReason || null,
    } }),
    onSuccess: () => {
      toast.success("রিটার্ন সংরক্ষিত");
      qc.invalidateQueries({ queryKey: ["sale", saleId] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["shop-notifications"] });
      setReturnOpen(false); setReturnQty({}); setRefundAmount(0); setReturnReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    if (sale && ready && cfg.autoPrint) {
      const t = setTimeout(() => {
        try { window.print(); } catch { /* ignore */ }
      }, 500);
      return () => clearTimeout(t);
    }
  }, [sale, ready, cfg.autoPrint]);

  if (q.isLoading) return <div className="p-4 text-muted-foreground sm:p-6">লোড হচ্ছে...</div>;
  if (!sale) return <div className="p-4 sm:p-6">ইনভয়েস পাওয়া যায়নি</div>;

  const line = separatorChar(cfg.separator);
  const isCancelled = sale.status === "cancelled";
  const isReturned = sale.status === "returned";
  const shiftOpen = !!shiftQ.data?.shift;

  const estimatedRefund = Object.entries(returnQty).reduce((s, [id, q]) => {
    const it = items.find((x) => x.id === id);
    return s + (it ? Number(it.unit_price) * (q || 0) : 0);
  }, 0);

  return (
    <div className="min-h-screen bg-muted/40 py-4 print:bg-white print:py-0">
      <div className="mx-auto mb-2 flex max-w-md flex-wrap items-center justify-between gap-2 px-2 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/app/sales" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> ফিরে
        </Button>
        <div className="flex flex-wrap items-center gap-1.5">
          {(isCancelled || isReturned) && (
            <Badge variant={isCancelled ? "destructive" : "secondary"}>
              {isCancelled ? "ক্যান্সেল" : sale.status === "partial_return" ? "আংশিক রিটার্ন" : "রিটার্ন"}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1 h-3.5 w-3.5" /> প্রিন্ট
          </Button>
          {!isCancelled && (
            <Button
              size="sm"
              variant="outline"
              disabled={!shiftOpen}
              title={!shiftOpen ? "রিটার্নের জন্য POS শিফট খুলুন" : undefined}
              onClick={() => setReturnOpen(true)}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> রিটার্ন
            </Button>
          )}
          {!isCancelled && (
            <Button
              size="sm"
              variant="destructive"
              disabled={!shiftOpen}
              title={!shiftOpen ? "ক্যান্সেলের জন্য POS শিফট খুলুন" : undefined}
              onClick={() => setCancelOpen(true)}
            >
              <XCircle className="mr-1 h-3.5 w-3.5" /> ক্যান্সেল
            </Button>
          )}
        </div>
      </div>

      {!shiftOpen && !isCancelled && (
        <div className="mx-auto mb-2 max-w-md rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 print:hidden">
          ⚠️ POS শিফট বন্ধ। রিটার্ন / ক্যান্সেল করতে হলে আগে শিফট শুরু করুন।
        </div>
      )}

      <ReceiptShell autoOpen={!cfg.autoPrint}>
        <div
          id="pos-receipt"
          className="mx-auto bg-white p-3 leading-tight text-black shadow-sm print:shadow-none"
        >
          <div className="text-center">
            <div className="r-title r-wrap font-bold uppercase">{shop?.name ?? "Shop"}</div>
            {shop?.address && <div className="r-wrap text-[11px]">{shop.address}</div>}
            {shop?.phone && <div>ফোন: {shop.phone}</div>}
          </div>
          <div className="my-1 text-center">{line}</div>
          <div className="text-center font-bold">SALES INVOICE</div>
          <div className="my-1 text-center">{line}</div>

          <div className="flex justify-between gap-2"><span>Inv#</span><span className="r-wrap text-right">{sale.invoice_no ?? sale.id.slice(0, 8)}</span></div>
          <div className="flex justify-between gap-2"><span>Date</span><span className="r-wrap text-right">{new Date(sale.sale_date).toLocaleString("en-GB")}</span></div>
          <div className="flex justify-between gap-2"><span>Type</span><span>{typeLabel[sale.sale_type] ?? sale.sale_type}</span></div>
          {sale.payment_method && <div className="flex justify-between gap-2"><span>Method</span><span>{sale.payment_method}</span></div>}
          <div className="flex justify-between gap-2"><span>Customer</span><span className="r-wrap text-right">{sale.customer?.name ?? "Walk-in"}</span></div>
          {sale.customer?.phone && <div className="flex justify-between gap-2"><span>Phone</span><span>{sale.customer.phone}</span></div>}

          <div className="my-1 text-center">{line}</div>

          <div className="grid grid-cols-[1fr_auto] gap-x-2 font-bold">
            <div>Item</div><div className="text-right">Total</div>
          </div>
          <div className="text-center">{line}</div>

          {items.map((it: any, i: number) => (
            <div key={it.id} className="grid grid-cols-[1fr_auto] gap-x-2">
              <div className="r-wrap">{i + 1}. {it.product?.name ?? "-"}</div>
              <div className="text-right">{fmt(it.line_total)}</div>
              <div className="r-wrap col-span-2 text-[11px] text-neutral-700">
                {it.quantity} {it.product?.unit?.short_name ?? ""} × {fmt(it.unit_price)}
                {Number(it.discount_amount || 0) > 0 && ` − ছাড় ${fmt(it.discount_amount)}`}
                {Number(it.tax_rate || 0) > 0 && ` + VAT ${it.tax_rate}%`}
              </div>
            </div>
          ))}

          <div className="my-1 text-center">{line}</div>

          <div className="flex justify-between"><span>Subtotal</span><span>{fmt(sale.subtotal)}</span></div>
          {Number(sale.discount || 0) > 0 && (
            <div className="flex justify-between"><span>Discount</span><span>-{fmt(sale.discount)}</span></div>
          )}
          {Number(sale.tax_amount || 0) > 0 && (
            <div className="flex justify-between"><span>VAT / ট্যাক্স</span><span>+{fmt(sale.tax_amount)}</span></div>
          )}
          <div className="r-total flex justify-between font-bold">
            <span>TOTAL</span><span>BDT {fmt(sale.total)}</span>
          </div>
          <div className="flex justify-between"><span>Paid</span><span>{fmt(sale.paid)}</span></div>
          {Number(sale.due || 0) > 0 && (
            <div className="flex justify-between font-bold"><span>Due</span><span>{fmt(sale.due)}</span></div>
          )}

          {installments.length > 0 && (
            <>
              <div className="my-1 text-center">{line}</div>
              <div className="font-bold">Installments</div>
              {installments.map((ins: any) => (
                <div key={ins.id} className="grid grid-cols-[auto_1fr_auto] gap-x-2">
                  <div>#{ins.installment_no}</div>
                  <div className="r-wrap">{ins.due_date}</div>
                  <div className="text-right">{fmt(ins.amount)} <span className="text-[10px]">({ins.status})</span></div>
                </div>
              ))}
            </>
          )}

          <div className="my-1 text-center">{line}</div>
          <div className="r-wrap text-center text-[11px]">ধন্যবাদ, আবার আসবেন।</div>
          <div className="text-center text-[10px]">Printed: {new Date().toLocaleString("en-GB")}</div>
        </div>
      </ReceiptShell>

      <style>{receiptStyleCss(cfg)}</style>

      <div className="mx-auto mt-4 grid max-w-md gap-4 px-2 print:hidden">
        <section className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SMS / ইমেইল হিস্ট্রি</div>
          </div>
          <SaleDeliveryHistory saleId={saleId} />
        </section>
        <section className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">সম্পাদনার হিস্ট্রি</div>
          </div>
          <SaleRevisionsList saleId={saleId} />
        </section>
      </div>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>রিটার্ন — {sale.invoice_no ?? sale.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-slate-50 p-2 text-xs text-slate-700">
              মূল ইনভয়েস: <b>{sale.invoice_no ?? sale.id.slice(0, 8)}</b> · তারিখ: {new Date(sale.sale_date).toLocaleDateString("bn-BD")} · মোট: <b>৳{fmt(sale.total)}</b>
              <div className="mt-0.5 text-[11px] text-muted-foreground">রিটার্ন নিশ্চিত করলে পরিমাণ অনুযায়ী স্টক স্বয়ংক্রিয়ভাবে ফেরত যোগ হবে।</div>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
              {items.map((it: any) => (
                <div key={it.id} className="flex items-center gap-2 rounded-md border p-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{it.product?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">বিক্রয়: {it.quantity} × ৳{Number(it.unit_price).toFixed(2)}</div>
                  </div>
                  <Input
                    type="number" min="0" max={it.quantity} step="0.001"
                    value={returnQty[it.id] ?? 0}
                    onChange={(e) => setReturnQty({ ...returnQty, [it.id]: Math.min(Number(it.quantity), Math.max(0, Number(e.target.value) || 0)) })}
                    className="h-9 w-24 text-right"
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>রিফান্ড পরিমাণ (৳)</Label>
                <Input type="number" min="0" step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(Number(e.target.value))} placeholder={estimatedRefund.toFixed(2)} />
              </div>
              <div>
                <Label>রিফান্ড মেথড</Label>
                <Select value={refundMethod} onValueChange={(v) => setRefundMethod(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">নগদ</SelectItem>
                    <SelectItem value="card">কার্ড</SelectItem>
                    <SelectItem value="bkash">বিকাশ</SelectItem>
                    <SelectItem value="bank">ব্যাংক</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>কারণ <span className="text-rose-600">*</span></Label>
              <Textarea rows={2} value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
              <div className="mt-1 text-[11px] text-muted-foreground">কারণ বাধ্যতামূলক (কমপক্ষে ৩ অক্ষর)।</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 text-sm">
              আনুমানিক আইটেম মূল্য: <b>৳{estimatedRefund.toFixed(2)}</b>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>বাতিল</Button>
            <Button
              onClick={() => returnM.mutate()}
              disabled={returnM.isPending || returnReason.trim().length < 3 || Object.values(returnQty).every((v) => (v || 0) <= 0)}
            >
              রিটার্ন নিশ্চিত করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>বিক্রয় ক্যান্সেল — {sale.invoice_no ?? sale.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
              সতর্কতা: এই বিক্রয়ের সব আইটেম স্টকে ফেরত যোগ হবে এবং কাস্টমার ব্যালেন্স রোলব্যাক হবে। এটি ফেরানো যায় না।
            </div>
            <div className="rounded-md border bg-slate-50 p-2 text-xs">
              মূল রেফারেন্স: <b>{sale.invoice_no ?? sale.id.slice(0, 8)}</b> · মোট: <b>৳{fmt(sale.total)}</b> · পরিশোধিত: <b>৳{fmt(sale.paid)}</b>
            </div>
            <div>
              <Label>ক্যান্সেলের কারণ <span className="text-rose-600">*</span></Label>
              <Textarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="যেমন: ভুল আইটেম, কাস্টমার ফিরিয়ে দিয়েছে..." />
              <div className="mt-1 text-[11px] text-muted-foreground">বাধ্যতামূলক (কমপক্ষে ৩ অক্ষর)।</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>ফিরুন</Button>
            <Button
              variant="destructive"
              disabled={cancelM.isPending || cancelReason.trim().length < 3}
              onClick={() => cancelM.mutate(cancelReason.trim())}
            >
              ক্যান্সেল নিশ্চিত করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
