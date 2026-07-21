import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getSale, cancelSale, createSaleReturn } from "@/lib/sales.functions";
import { getMyShop } from "@/lib/shop.functions";
import { getCurrentShift } from "@/lib/shifts.functions";
import { getInvoiceTemplate, DEFAULT_TEMPLATE } from "@/lib/invoice-template.functions";
import { sendInvoiceLinkSms } from "@/lib/public-invoice.functions";
import { sendInvoiceLinkEmail } from "@/lib/invoice-delivery.functions";
import { snapshotSale } from "@/lib/sale-revisions.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  ArrowLeft, XCircle, RotateCcw, Printer, Download, Pencil, Share2,
  Copy, MessageSquare, Mail, MoreVertical, Link2, MessageCircle,
} from "lucide-react";
import { InvoicePreview, InvoicePrintStyles } from "@/components/invoice-preview";
import { SaleDeliveryHistory } from "@/components/invoice-delivery-history";
import { SaleRevisionsList } from "@/components/sale-revisions-list";
import {
  copyToClipboard, downloadInvoicePdf, nativeShare, openWhatsAppShare, printElement,
} from "@/lib/invoice-share";

export const Route = createFileRoute("/app/sales/$saleId")({ component: InvoicePage });

const fmt = (n: number) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const typeLabel: Record<string, string> = { cash: "নগদ", due: "বাকি", installment: "কিস্তি" };

function InvoicePage() {
  const { saleId } = useParams({ from: "/app/sales/$saleId" });
  const nav = useNavigate();
  const qc = useQueryClient();
  const saleFn = useServerFn(getSale);
  const shopFn = useServerFn(getMyShop);
  const shiftFn = useServerFn(getCurrentShift);
  const cancelFn = useServerFn(cancelSale);
  const returnFn = useServerFn(createSaleReturn);
  const tplFn = useServerFn(getInvoiceTemplate);
  const smsFn = useServerFn(sendInvoiceLinkSms);
  const emailFn = useServerFn(sendInvoiceLinkEmail);
  const snapshotFn = useServerFn(snapshotSale);

  const q = useQuery({ queryKey: ["sale", saleId], queryFn: () => saleFn({ data: { id: saleId } }) });
  const shopQ = useQuery({ queryKey: ["my-shop"], queryFn: () => shopFn() });
  const shiftQ = useQuery({ queryKey: ["shift-current"], queryFn: () => shiftFn() });
  const tplQ = useQuery({ queryKey: ["invoice-template"], queryFn: () => tplFn(), staleTime: 5 * 60_000 });

  const sale: any = q.data?.sale;
  const items: any[] = q.data?.items ?? [];
  const installments: any[] = q.data?.installments ?? [];
  const shop: any = shopQ.data?.shop ?? q.data?.shop;
  const tpl = { ...DEFAULT_TEMPLATE, ...(tplQ.data ?? {}) } as any;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = sale?.share_token ? `${origin}/i/${sale.share_token}` : "";
  const previewSale = useMemo(() => (sale ? { ...sale, items } : null), [sale, items]);

  const [returnOpen, setReturnOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundMethod, setRefundMethod] = useState<"cash" | "card" | "bkash" | "bank">("cash");
  const [returnReason, setReturnReason] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (sale?.customer?.phone && !smsPhone) setSmsPhone(sale.customer.phone);
    if (sale?.customer?.email && !emailTo) setEmailTo(sale.customer.email);
  }, [sale?.customer?.phone, sale?.customer?.email]);

  const cancelM = useMutation({
    mutationFn: (reason: string) => cancelFn({ data: { sale_id: saleId, reason } }),
    onSuccess: () => {
      toast.success("বিক্রয় ক্যান্সেল হয়েছে");
      qc.invalidateQueries({ queryKey: ["sale", saleId] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setCancelOpen(false); setCancelReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const returnM = useMutation({
    mutationFn: () => returnFn({ data: {
      sale_id: saleId,
      items: Object.entries(returnQty).filter(([, qq]) => qq > 0).map(([sale_item_id, quantity]) => ({ sale_item_id, quantity })),
      refund_amount: refundAmount, refund_method: refundMethod, reason: returnReason || null,
    } }),
    onSuccess: () => {
      toast.success("রিটার্ন সংরক্ষিত");
      qc.invalidateQueries({ queryKey: ["sale", saleId] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setReturnOpen(false); setReturnQty({}); setRefundAmount(0); setReturnReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const smsM = useMutation({
    mutationFn: () => smsFn({ data: { sale_id: saleId, phone: smsPhone || null, origin } }),
    onSuccess: () => {
      toast.success("SMS পাঠানো হয়েছে");
      qc.invalidateQueries({ queryKey: ["sale-deliveries", saleId] });
    },
    onError: (e: any) => toast.error(e.message ?? "SMS পাঠানো যায়নি"),
  });
  const emailM = useMutation({
    mutationFn: () => emailFn({ data: { sale_id: saleId, email: emailTo || null, origin } }),
    onSuccess: () => {
      toast.success("ইমেইল পাঠানো হয়েছে");
      qc.invalidateQueries({ queryKey: ["sale-deliveries", saleId] });
    },
    onError: (e: any) => toast.error(e.message ?? "ইমেইল পাঠানো যায়নি"),
  });

  const handlePrint = () => printElement("pos-invoice-preview");
  const handlePdf = async () => {
    setPdfBusy(true);
    try {
      await downloadInvoicePdf(
        "pos-invoice-preview",
        `invoice-${sale?.invoice_no ?? saleId}.pdf`,
      );
    } finally { setPdfBusy(false); }
  };
  const handleEdit = async () => {
    if (!sale) return;
    if (isCancelled || isReturned) return;
    if (!confirm("বর্তমান বিক্রয়টি বাতিল করে সম্পাদনার জন্য কার্টে ফেরত আনা হবে। চালিয়ে যাবেন?")) return;
    try {
      try { await snapshotFn({ data: { sale_id: saleId, reason: "Edit from detail page" } }); } catch { /* non-fatal */ }
      // Stash restore payload for the POS page to consume
      try {
        sessionStorage.setItem("pos:restore-sale", JSON.stringify({
          items,
          customer_id: sale.customer_id ?? null,
          discount: Number(sale.discount ?? 0),
          sale_type: sale.sale_type ?? "cash",
          note: sale.note ?? "",
        }));
      } catch { /* ignore quota */ }
      await cancelFn({ data: { sale_id: saleId, reason: "Edit from detail page" } });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      toast.success("বিক্রয় বাতিল হয়েছে — কার্টে সম্পাদনা করুন");
      nav({ to: "/app/sales/new" });
    } catch (e: any) {
      toast.error(e?.message ?? "সম্পাদনা ব্যর্থ");
    }
  };

  if (q.isLoading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;
  if (!sale) return <div className="p-6">ইনভয়েস পাওয়া যায়নি</div>;

  const isCancelled = sale.status === "cancelled";
  const isReturned = sale.status === "returned" || sale.status === "partial_return";
  const shiftOpen = !!shiftQ.data?.shift;
  const statusBadge = isCancelled
    ? { text: "ক্যান্সেল", variant: "destructive" as const }
    : sale.status === "partial_return"
    ? { text: "আংশিক রিটার্ন", variant: "secondary" as const }
    : sale.status === "returned"
    ? { text: "রিটার্ন", variant: "secondary" as const }
    : { text: "সক্রিয়", variant: "default" as const };

  const estimatedRefund = Object.entries(returnQty).reduce((s, [id, qq]) => {
    const it = items.find((x) => x.id === id);
    return s + (it ? Number(it.unit_price) * (qq || 0) : 0);
  }, 0);

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      {/* Header bar */}
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur invoice-hide-on-print">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => nav({ to: "/app/sales" })}>
            <ArrowLeft className="mr-1 h-4 w-4" /> ফিরে
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xs text-muted-foreground">Invoice</span>
            <span className="truncate font-mono text-sm font-semibold">
              #{sale.invoice_no ?? String(sale.id).slice(0, 8)}
            </span>
            <Badge variant={statusBadge.variant}>{statusBadge.text}</Badge>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="mr-1 h-3.5 w-3.5" /> প্রিন্ট
            </Button>
            <Button size="sm" variant="outline" disabled={pdfBusy} onClick={handlePdf}>
              <Download className="mr-1 h-3.5 w-3.5" /> {pdfBusy ? "..." : "PDF"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
              <Share2 className="mr-1 h-3.5 w-3.5" /> শেয়ার
            </Button>
            {!isCancelled && !isReturned && (
              <Button size="sm" variant="outline" onClick={handleEdit}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> সম্পাদনা
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="px-2"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>অ্যাকশন</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => copyToClipboard(sale.invoice_no ?? sale.id, "ইনভয়েস নম্বর কপি হয়েছে")}>
                  <Copy className="mr-2 h-4 w-4" /> ইনভয়েস নম্বর কপি
                </DropdownMenuItem>
                {publicUrl && (
                  <DropdownMenuItem onClick={() => copyToClipboard(publicUrl, "লিংক কপি হয়েছে")}>
                    <Link2 className="mr-2 h-4 w-4" /> পাবলিক লিংক কপি
                  </DropdownMenuItem>
                )}
                {publicUrl && (
                  <DropdownMenuItem
                    onClick={() => openWhatsAppShare(publicUrl, sale.invoice_no, sale.customer?.phone)}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp-এ পাঠান
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {!isCancelled && (
                  <DropdownMenuItem
                    disabled={!shiftOpen}
                    onClick={() => setReturnOpen(true)}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" /> রিটার্ন
                  </DropdownMenuItem>
                )}
                {!isCancelled && (
                  <DropdownMenuItem
                    disabled={!shiftOpen}
                    className="text-destructive focus:text-destructive"
                    onClick={() => setCancelOpen(true)}
                  >
                    <XCircle className="mr-2 h-4 w-4" /> ক্যান্সেল
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {!shiftOpen && !isCancelled && (
          <div className="mx-auto max-w-6xl border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
            ⚠️ POS শিফট বন্ধ — রিটার্ন / ক্যান্সেল করতে হলে আগে শিফট শুরু করুন।
          </div>
        )}
      </div>

      {/* Main body */}
      <div className="mx-auto grid max-w-6xl gap-4 px-3 py-5 lg:grid-cols-[minmax(0,1fr)_360px] print:block print:max-w-none print:px-0 print:py-0">
        {/* Left: preview */}
        <div className="invoice-print-root">
          <InvoicePreview
            sale={previewSale}
            shop={shop}
            tpl={tpl}
            publicUrl={publicUrl}
            installments={installments}
          />
        </div>

        {/* Right sidebar */}
        <div className="space-y-4 invoice-hide-on-print">
          <section className="rounded-lg border bg-card p-4 text-sm">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">সংক্ষেপ</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <div className="text-muted-foreground">কাস্টমার</div>
              <div className="text-right font-medium">{sale.customer?.name ?? "Walk-in"}</div>
              {sale.customer?.phone && (<>
                <div className="text-muted-foreground">ফোন</div>
                <div className="text-right">{sale.customer.phone}</div>
              </>)}
              <div className="text-muted-foreground">ধরন</div>
              <div className="text-right">{typeLabel[sale.sale_type] ?? sale.sale_type}</div>
              <div className="text-muted-foreground">মোট</div>
              <div className="text-right font-semibold">৳{fmt(sale.total)}</div>
              <div className="text-muted-foreground">পরিশোধ</div>
              <div className="text-right text-emerald-600">৳{fmt(sale.paid)}</div>
              {Number(sale.due) > 0 && (<>
                <div className="text-muted-foreground">বাকি</div>
                <div className="text-right font-bold text-rose-600">৳{fmt(sale.due)}</div>
              </>)}
              <div className="text-muted-foreground">আইটেম</div>
              <div className="text-right">{items.length} টি</div>
            </div>
          </section>

          {/* Quick send */}
          <section className="rounded-lg border bg-card p-4">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              কাস্টমারকে পাঠান
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">SMS</Label>
                <div className="mt-1 flex gap-1">
                  <Input value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} placeholder="01XXXXXXXXX" className="h-9 text-sm" />
                  <Button size="sm" className="h-9 shrink-0" disabled={smsM.isPending || !smsPhone.trim()} onClick={() => smsM.mutate()}>
                    <MessageSquare className="mr-1 h-4 w-4" /> {smsM.isPending ? "..." : "পাঠান"}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">ইমেইল</Label>
                <div className="mt-1 flex gap-1">
                  <Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="customer@example.com" className="h-9 text-sm" />
                  <Button size="sm" variant="outline" className="h-9 shrink-0" disabled={emailM.isPending || !emailTo.trim()} onClick={() => emailM.mutate()}>
                    <Mail className="mr-1 h-4 w-4" /> {emailM.isPending ? "..." : "পাঠান"}
                  </Button>
                </div>
              </div>
              {publicUrl && (
                <div>
                  <Label className="text-xs">পাবলিক লিংক</Label>
                  <div className="mt-1 flex gap-1">
                    <Input readOnly value={publicUrl} className="h-9 text-xs" onFocus={(e) => e.currentTarget.select()} />
                    <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => copyToClipboard(publicUrl, "লিংক কপি হয়েছে")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => nativeShare(publicUrl, `Invoice #${sale.invoice_no ?? ""}`)}>
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Tabs: delivery / revisions */}
          <section className="rounded-lg border bg-card p-1">
            <Tabs defaultValue="delivery" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="delivery" className="flex-1">ডেলিভারি</TabsTrigger>
                <TabsTrigger value="revisions" className="flex-1">সম্পাদনা</TabsTrigger>
              </TabsList>
              <TabsContent value="delivery" className="p-3">
                <SaleDeliveryHistory saleId={saleId} />
              </TabsContent>
              <TabsContent value="revisions" className="p-3">
                <SaleRevisionsList saleId={saleId} />
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </div>

      <InvoicePrintStyles />

      {/* Share dialog (mobile-friendly big buttons) */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ইনভয়েস শেয়ার করুন</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => { copyToClipboard(publicUrl, "লিংক কপি হয়েছে"); setShareOpen(false); }}>
              <Link2 className="h-5 w-5" /> <span className="text-xs">লিংক কপি</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col gap-1"
              onClick={() => { openWhatsAppShare(publicUrl, sale.invoice_no, sale.customer?.phone); setShareOpen(false); }}>
              <MessageCircle className="h-5 w-5" /> <span className="text-xs">WhatsApp</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col gap-1"
              disabled={!smsPhone.trim() || smsM.isPending}
              onClick={() => { smsM.mutate(); setShareOpen(false); }}>
              <MessageSquare className="h-5 w-5" /> <span className="text-xs">SMS</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col gap-1"
              disabled={!emailTo.trim() || emailM.isPending}
              onClick={() => { emailM.mutate(); setShareOpen(false); }}>
              <Mail className="h-5 w-5" /> <span className="text-xs">ইমেইল</span>
            </Button>
          </div>
          {publicUrl && (
            <div className="mt-2 rounded-md border bg-muted/40 p-2 text-xs">
              <div className="text-muted-foreground">পাবলিক লিংক</div>
              <div className="truncate font-mono">{publicUrl}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Return */}
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

      {/* Cancel */}
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