import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCustomerLedger, receiveCustomerPayment } from "@/lib/sales.functions";
import { listCustomerNotes, addCustomerNote, deleteCustomerNote } from "@/lib/customer-notes.functions";
import { listCustomerDeliveries } from "@/lib/invoice-delivery.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import {
  ArrowLeft, HandCoins, Phone, MapPin, Download, Search, Mail, MessageSquare,
  StickyNote, Trash2, AlertTriangle, CalendarClock,
} from "lucide-react";
import { downloadCSV } from "@/lib/export-utils";

export const Route = createFileRoute("/app/customers/$customerId")({ component: Page });

const money = (n: any) => `৳${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;
const dateOnly = (s: any) => (s ? String(s).slice(0, 10) : "");
const inRange = (d: string, from: string, to: string) => (!from || d >= from) && (!to || d <= to);

function Page() {
  const qc = useQueryClient();
  const { customerId } = useParams({ from: "/app/customers/$customerId" });
  const fn = useServerFn(getCustomerLedger);
  const payFn = useServerFn(receiveCustomerPayment);
  const notesFn = useServerFn(listCustomerNotes);
  const addNoteFn = useServerFn(addCustomerNote);
  const delNoteFn = useServerFn(deleteCustomerNote);
  const deliveriesFn = useServerFn(listCustomerDeliveries);

  const q = useQuery({ queryKey: ["ledger", customerId], queryFn: () => fn({ data: { customer_id: customerId } }) });
  const notesQ = useQuery<any[]>({ queryKey: ["customer-notes", customerId], queryFn: () => notesFn({ data: { customer_id: customerId } }) as any });
  const delivQ = useQuery<any[]>({ queryKey: ["customer-deliveries", customerId], queryFn: () => deliveriesFn({ data: { customer_id: customerId, limit: 200 } }) as any });

  // Payment dialog
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<"cash" | "bkash" | "bank">("cash");
  const [payNote, setPayNote] = useState("");

  // Note dialog
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteKind, setNoteKind] = useState<"installment" | "payment" | "general">("general");
  const [noteBody, setNoteBody] = useState("");

  // Filters
  const [purQ, setPurQ] = useState("");
  const [purFrom, setPurFrom] = useState("");
  const [purTo, setPurTo] = useState("");
  const [purType, setPurType] = useState<string>("all");
  const [payQ, setPayQ] = useState("");
  const [payFrom, setPayFrom] = useState("");
  const [payTo, setPayTo] = useState("");
  const [ledFrom, setLedFrom] = useState("");
  const [ledTo, setLedTo] = useState("");
  const [ledKind, setLedKind] = useState<string>("all");

  const pay = useMutation({
    mutationFn: () => payFn({ data: { customer_id: customerId, amount, payment_method: method, note: payNote || null } }),
    onSuccess: () => {
      toast.success("পেমেন্ট গৃহীত");
      qc.invalidateQueries({ queryKey: ["ledger", customerId] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["shop-notifications"] });
      setPayOpen(false); setAmount(0); setPayNote("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addNote = useMutation({
    mutationFn: () => addNoteFn({ data: { customer_id: customerId, kind: noteKind, body: noteBody } }),
    onSuccess: () => {
      toast.success("নোট যোগ হয়েছে");
      qc.invalidateQueries({ queryKey: ["customer-notes", customerId] });
      setNoteOpen(false); setNoteBody(""); setNoteKind("general");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delNote = useMutation({
    mutationFn: (id: string) => delNoteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-notes", customerId] }),
  });

  const c = q.data?.customer;
  const entries: any[] = q.data?.entries ?? [];
  const installments: any[] = q.data?.installments ?? [];
  const sales: any[] = q.data?.sales ?? [];
  const payments: any[] = q.data?.payments ?? [];
  const summary = q.data?.summary as any;
  const balance = entries.length ? entries[entries.length - 1].balance : 0;

  // Filtered lists
  const purchases = useMemo(() => {
    return sales.filter((s: any) => {
      if (purType !== "all" && s.sale_type !== purType) return false;
      if (!inRange(dateOnly(s.sale_date), purFrom, purTo)) return false;
      if (purQ) {
        const needle = purQ.toLowerCase();
        const hay = `${s.invoice_no ?? ""} ${s.total} ${s.sale_type} ${s.status}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [sales, purQ, purFrom, purTo, purType]);

  const paymentRows = useMemo(() => {
    return payments.filter((p: any) => {
      if (!inRange(dateOnly(p.payment_date), payFrom, payTo)) return false;
      if (payQ) {
        const needle = payQ.toLowerCase();
        const linkedInv = sales.find((s) => s.id === p.sale_id)?.invoice_no ?? "";
        const hay = `${linkedInv} ${p.amount} ${p.payment_method} ${p.reference ?? ""} ${p.note ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [payments, sales, payQ, payFrom, payTo]);

  const ledgerRows = useMemo(() => {
    return entries.filter((e: any) => {
      if (ledKind !== "all" && e.type !== ledKind) return false;
      if (!inRange(dateOnly(e.date), ledFrom, ledTo)) return false;
      return true;
    });
  }, [entries, ledKind, ledFrom, ledTo]);

  // Communication feed (deliveries + notes merged)
  const commFeed = useMemo(() => {
    const deliv = (delivQ.data ?? []).map((r: any) => ({
      kind: "delivery" as const, id: r.id, date: r.created_at,
      channel: r.channel, recipient: r.recipient, status: r.status,
      response: r.response, invoice_no: r.sale?.invoice_no,
    }));
    const notes = (notesQ.data ?? []).map((n: any) => ({
      kind: "note" as const, id: n.id, date: n.created_at, noteKind: n.kind, body: n.body,
    }));
    return [...deliv, ...notes].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [delivQ.data, notesQ.data]);

  if (q.isLoading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;
  if (!c) return <div className="p-6">কাস্টমার পাওয়া যায়নি</div>;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/customers"><ArrowLeft className="mr-1 h-4 w-4" /> ফিরে</Link>
        </Button>
      </div>

      {/* Header */}
      <div className="mt-3 grid gap-3 rounded-2xl border bg-card p-5 sm:grid-cols-[1fr_auto]">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{c.name}</h1>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
            {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{c.phone}</span>}
            {c.address && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.address}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">বর্তমান বকেয়া</div>
            <div className={`text-2xl font-black ${Number(balance) > 0 ? "text-orange-600" : "text-emerald-600"}`}>{money(balance)}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setNoteOpen(true)}>
              <StickyNote className="mr-1 h-4 w-4" /> নোট
            </Button>
            <Button size="sm" onClick={() => { setAmount(Math.max(0, Number(balance))); setPayOpen(true); }}>
              <HandCoins className="mr-1 h-4 w-4" /> পেমেন্ট গ্রহণ
            </Button>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      {summary && (
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <KPI label="মোট ক্রয়" value={money(summary.total_purchased)} />
          <KPI label="মোট পরিশোধ" value={money(summary.total_paid)} tone="ok" />
          <KPI label="মোট বকেয়া" value={money(summary.total_outstanding)} tone="warn" />
          <KPI label="ইনভয়েস সংখ্যা" value={String(sales.length)} />
        </div>
      )}

      <Tabs defaultValue="purchases" className="mt-6">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="purchases">ক্রয় হিস্টরি ({sales.length})</TabsTrigger>
          <TabsTrigger value="ledger">লেজার ({entries.length})</TabsTrigger>
          <TabsTrigger value="installments">কিস্তি ({installments.length})</TabsTrigger>
          <TabsTrigger value="payments">পেমেন্ট ({payments.length})</TabsTrigger>
          <TabsTrigger value="communication">যোগাযোগ</TabsTrigger>
        </TabsList>

        {/* Purchases */}
        <TabsContent value="purchases" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-7" placeholder="ইনভয়েস/পরিমাণ" value={purQ} onChange={(e) => setPurQ(e.target.value)} />
            </div>
            <div><Label className="text-[10px]">থেকে</Label><Input type="date" value={purFrom} onChange={(e) => setPurFrom(e.target.value)} /></div>
            <div><Label className="text-[10px]">পর্যন্ত</Label><Input type="date" value={purTo} onChange={(e) => setPurTo(e.target.value)} /></div>
            <div className="w-[140px]">
              <Label className="text-[10px]">টাইপ</Label>
              <Select value={purType} onValueChange={setPurType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব</SelectItem>
                  <SelectItem value="cash">নগদ</SelectItem>
                  <SelectItem value="due">বাকি</SelectItem>
                  <SelectItem value="installment">কিস্তি</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">তারিখ</th>
                  <th className="px-4 py-3">ইনভয়েস</th>
                  <th className="px-4 py-3">টাইপ</th>
                  <th className="px-4 py-3">স্ট্যাটাস</th>
                  <th className="px-4 py-3 text-right">মোট</th>
                  <th className="px-4 py-3 text-right">পরিশোধ</th>
                  <th className="px-4 py-3 text-right">বকেয়া</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((s: any) => (
                  <tr key={s.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap">{dateOnly(s.sale_date)}</td>
                    <td className="px-4 py-3">
                      <Link to="/app/sales/$saleId" params={{ saleId: s.id }} className="font-mono text-primary hover:underline">
                        {s.invoice_no ?? s.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><Badge variant="secondary">{s.sale_type}</Badge></td>
                    <td className="px-4 py-3">
                      <Badge variant={s.status === "cancelled" ? "destructive" : "outline"}>{s.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{money(s.total)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{money(s.paid)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${Number(s.due) > 0 ? "text-orange-600" : ""}`}>{money(s.due)}</td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">কোনো ক্রয় নেই</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Ledger */}
        <TabsContent value="ledger" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div><Label className="text-[10px]">থেকে</Label><Input type="date" value={ledFrom} onChange={(e) => setLedFrom(e.target.value)} /></div>
            <div><Label className="text-[10px]">পর্যন্ত</Label><Input type="date" value={ledTo} onChange={(e) => setLedTo(e.target.value)} /></div>
            <div className="w-[140px]">
              <Label className="text-[10px]">ধরন</Label>
              <Select value={ledKind} onValueChange={setLedKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব</SelectItem>
                  <SelectItem value="sale">বিক্রয়</SelectItem>
                  <SelectItem value="payment">পেমেন্ট</SelectItem>
                  <SelectItem value="opening">প্রারম্ভিক</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={ledgerRows.length === 0}
              onClick={() => downloadCSV(
                `ledger-${c.name}-${new Date().toISOString().slice(0, 10)}`,
                ["তারিখ", "ধরন", "ইনভয়েস", "ইনভয়েস টাইপ", "স্ট্যাটাস", "বিবরণ", "ডেবিট", "ক্রেডিট", "ব্যালেন্স"],
                ledgerRows.map((e: any) => [
                  dateOnly(e.date), e.type, e.invoice_no ?? "", e.sale_type ?? "", e.status ?? "",
                  e.description, Number(e.debit || 0), Number(e.credit || 0), Number(e.balance || 0),
                ]),
              )}
            >
              <Download className="mr-1 h-3.5 w-3.5" /> CSV
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">তারিখ</th>
                  <th className="px-4 py-3">বিবরণ</th>
                  <th className="px-4 py-3">ইনভয়েস</th>
                  <th className="px-4 py-3 text-right">ডেবিট</th>
                  <th className="px-4 py-3 text-right">ক্রেডিট</th>
                  <th className="px-4 py-3 text-right">ব্যালেন্স</th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((e: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-3 whitespace-nowrap">{dateOnly(e.date)}</td>
                    <td className="px-4 py-3">{e.description}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {e.invoice_no && e.type === "sale" ? (
                        <Link to="/app/sales/$saleId" params={{ saleId: e.ref_id }} className="text-primary hover:underline">{e.invoice_no}</Link>
                      ) : (e.invoice_no ?? "—")}
                    </td>
                    <td className="px-4 py-3 text-right">{Number(e.debit) ? money(e.debit) : "—"}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{Number(e.credit) ? money(e.credit) : "—"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${Number(e.balance) > 0 ? "text-orange-600" : ""}`}>{money(e.balance)}</td>
                  </tr>
                ))}
                {ledgerRows.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">কোনো লেনদেন নেই</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Installments */}
        <TabsContent value="installments" className="mt-4 space-y-4">
          <InstallmentOverview installments={installments} />
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">ইনভয়েস</th>
                  <th className="px-4 py-3">নির্ধারিত তারিখ</th>
                  <th className="px-4 py-3 text-right">পরিমাণ</th>
                  <th className="px-4 py-3 text-right">পরিশোধ</th>
                  <th className="px-4 py-3">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((i: any) => {
                  const isOverdue = i.status !== "paid" && i.status !== "cancelled" && i.due_date < new Date().toISOString().slice(0, 10);
                  return (
                    <tr key={i.id} className={`border-t ${isOverdue ? "bg-rose-50" : ""}`}>
                      <td className="px-4 py-3">#{i.installment_no}</td>
                      <td className="px-4 py-3">
                        <Link to="/app/sales/$saleId" params={{ saleId: i.sale_id }} className="text-primary hover:underline">
                          {i.sale_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={isOverdue ? "font-semibold text-rose-700" : ""}>{i.due_date}</span>
                        {isOverdue && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-rose-600" />}
                      </td>
                      <td className="px-4 py-3 text-right">{money(i.amount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{money(i.paid_amount)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={
                          i.status === "paid" ? "default"
                          : isOverdue || i.status === "overdue" ? "destructive"
                          : "secondary"
                        }>{isOverdue && i.status !== "overdue" ? "overdue" : i.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
                {installments.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">কোনো কিস্তি নেই</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-7" placeholder="ইনভয়েস/পরিমাণ/মেথড" value={payQ} onChange={(e) => setPayQ(e.target.value)} />
            </div>
            <div><Label className="text-[10px]">থেকে</Label><Input type="date" value={payFrom} onChange={(e) => setPayFrom(e.target.value)} /></div>
            <div><Label className="text-[10px]">পর্যন্ত</Label><Input type="date" value={payTo} onChange={(e) => setPayTo(e.target.value)} /></div>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">তারিখ</th>
                  <th className="px-4 py-3">ইনভয়েস</th>
                  <th className="px-4 py-3">মেথড</th>
                  <th className="px-4 py-3">নোট</th>
                  <th className="px-4 py-3 text-right">পরিমাণ</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((p: any) => {
                  const linked = sales.find((s) => s.id === p.sale_id);
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-3 whitespace-nowrap">{dateOnly(p.payment_date)}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {linked ? (
                          <Link to="/app/sales/$saleId" params={{ saleId: linked.id }} className="text-primary hover:underline">{linked.invoice_no ?? linked.id.slice(0, 8)}</Link>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 uppercase">{p.payment_method}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.note ?? p.reference ?? "—"}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${Number(p.amount) < 0 ? "text-rose-600" : "text-emerald-600"}`}>{money(p.amount)}</td>
                    </tr>
                  );
                })}
                {paymentRows.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">কোনো পেমেন্ট নেই</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Communication */}
        <TabsContent value="communication" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}>
              <StickyNote className="mr-1 h-4 w-4" /> নতুন নোট
            </Button>
          </div>
          {commFeed.length === 0 ? (
            <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">কোনো যোগাযোগ হিস্টরি নেই</div>
          ) : (
            <div className="divide-y rounded-xl border bg-card">
              {commFeed.map((r: any) => (
                <div key={`${r.kind}-${r.id}`} className="flex items-start gap-3 p-3 text-sm">
                  <div className="mt-0.5">
                    {r.kind === "note" ? (
                      <StickyNote className="h-4 w-4 text-amber-600" />
                    ) : r.channel === "email" ? (
                      <Mail className="h-4 w-4 text-sky-600" />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-emerald-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {r.kind === "note" ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">{r.noteKind}</Badge>
                          <span className="text-[11px] text-muted-foreground">নোট</span>
                        </div>
                        <div className="mt-1 whitespace-pre-wrap">{r.body}</div>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs">{r.recipient}</span>
                          <Badge variant={r.status === "sent" ? "default" : r.status === "failed" ? "destructive" : "secondary"} className="capitalize">{r.status}</Badge>
                          {r.invoice_no && <span className="text-[10px] text-muted-foreground">#{r.invoice_no}</span>}
                        </div>
                        {r.response && <div className="mt-0.5 text-xs text-muted-foreground">{r.response}</div>}
                      </>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(r.date).toLocaleString("bn-BD")}
                    </div>
                    {r.kind === "note" && (
                      <Button variant="ghost" size="sm" className="h-6 px-1 text-rose-600" onClick={() => delNote.mutate(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>পেমেন্ট গ্রহণ — {c.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-slate-50 p-2 text-xs">
              বর্তমান বকেয়া: <b className={Number(balance) > 0 ? "text-orange-600" : "text-emerald-600"}>{money(balance)}</b>
            </div>
            <div><Label>পরিমাণ (৳)</Label><Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
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
            <div><Label>নোট</Label><Textarea rows={2} value={payNote} onChange={(e) => setPayNote(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>বাতিল</Button>
            <Button onClick={() => pay.mutate()} disabled={pay.isPending || amount <= 0}>নিশ্চিত করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>নতুন নোট — {c.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ধরন</Label>
              <Select value={noteKind} onValueChange={(v) => setNoteKind(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">সাধারণ</SelectItem>
                  <SelectItem value="installment">কিস্তি সংক্রান্ত</SelectItem>
                  <SelectItem value="payment">পেমেন্ট সংক্রান্ত</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>নোট</Label><Textarea rows={4} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="যেমনঃ কাস্টমার আগামী শনিবার কিস্তি দিবে বলেছে..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>বাতিল</Button>
            <Button onClick={() => addNote.mutate()} disabled={addNote.isPending || noteBody.trim().length === 0}>সংরক্ষণ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-orange-600" : "";
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-black ${color}`}>{value}</div>
    </div>
  );
}

function InstallmentOverview({ installments }: { installments: any[] }) {
  if (installments.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const paid = installments.filter((i) => i.status === "paid").length;
  const overdue = installments.filter((i) => i.status !== "paid" && i.status !== "cancelled" && i.due_date < today).length;
  const next = installments.find((i) => i.status !== "paid" && i.status !== "cancelled" && i.due_date >= today);
  const totalDue = installments.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalPaid = installments.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
  const pct = totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 0;
  return (
    <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto]">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">অগ্রগতি</span>
          <span className="text-muted-foreground">{paid}/{installments.length} কিস্তি ({pct}%)</span>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="text-xs text-muted-foreground">
          পরিশোধিত: <b className="text-emerald-600">{money(totalPaid)}</b> / মোট: <b>{money(totalDue)}</b>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:items-end">
        {next && (
          <div className="rounded-md border bg-sky-50 px-3 py-2 text-xs">
            <CalendarClock className="mr-1 inline h-3.5 w-3.5 text-sky-700" />
            পরবর্তী কিস্তি: <b>{next.due_date}</b> — {money(next.amount)}
          </div>
        )}
        {overdue > 0 && (
          <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
            ওভারডিউ: <b>{overdue}</b> কিস্তি
          </div>
        )}
      </div>
    </div>
  );
}