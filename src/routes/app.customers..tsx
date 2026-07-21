import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCustomerLedger, receiveCustomerPayment } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useState } from "react";
import { ArrowLeft, HandCoins, Phone, MapPin, Download, Receipt, Wallet, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { downloadCSV } from "@/lib/export-utils";
import { CustomerDeliveryHistory } from "@/components/invoice-delivery-history";

export const Route = createFileRoute("/app/customers/")({ component: Page });

const money = (n: any) => `৳${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;

function Page() {
  const qc = useQueryClient();
  const { customerId } = useParams({ from: "/app/customers/$customerId" });
  const fn = useServerFn(getCustomerLedger);
  const payFn = useServerFn(receiveCustomerPayment);
  const q = useQuery({ queryKey: ["ledger", customerId], queryFn: () => fn({ data: { customer_id: customerId } }) });

  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<"cash" | "bkash" | "bank">("cash");
  const [note, setNote] = useState("");

  const pay = useMutation({
    mutationFn: () => payFn({ data: { customer_id: customerId, amount, payment_method: method, note: note || null } }),
    onSuccess: () => {
      toast.success("পেমেন্ট গৃহীত");
      qc.invalidateQueries({ queryKey: ["ledger", customerId] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["shop-notifications"] });
      setPayOpen(false); setAmount(0); setNote("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (q.isLoading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;
  if (q.error) return <div className="p-6 text-destructive">ত্রুটি: {(q.error as any).message}</div>;
  const c = q.data?.customer;
  const entries = q.data?.entries ?? [];
  const installments = q.data?.installments ?? [];
  const sales: any[] = q.data?.sales ?? [];
  const summary: any = q.data?.summary ?? { cash:{count:0,total:0}, due:{count:0,total:0,outstanding:0}, installment:{count:0,total:0,outstanding:0}, cancelled:{count:0,total:0}, total_purchased:0, total_paid:0, total_outstanding:0 };
  if (!c) return <div className="p-6">কাস্টমার পাওয়া যায়নি</div>;

  const balance = entries.length ? entries[entries.length - 1].balance : 0;
  const activeCount = sales.filter((s) => s.status !== "cancelled").length;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/customers"><ArrowLeft className="mr-1 h-4 w-4" /> ফিরে</Link>
        </Button>
      </div>

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
          <Button onClick={() => { setAmount(Math.max(0, Number(balance))); setPayOpen(true); }}>
            <HandCoins className="mr-2 h-4 w-4" /> পেমেন্ট গ্রহণ
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Receipt} label="মোট ক্রয়" value={money(summary.total_purchased)} sub={`${activeCount} টি ইনভয়েস`} tone="default" />
        <SummaryCard icon={Wallet} label="মোট পরিশোধ" value={money(summary.total_paid)} sub="সব ধরনের" tone="emerald" />
        <SummaryCard icon={HandCoins} label="মোট বাকি" value={money(summary.total_outstanding)} sub="বকেয়া" tone={summary.total_outstanding > 0 ? "orange" : "emerald"} />
        <SummaryCard icon={Clock} label="কিস্তি সূচি" value={String(installments.length)} sub={`${installments.filter((i: any) => i.status === "paid").length} পরিশোধিত`} tone="default" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <BreakdownCard label="নগদ ক্রয়" count={summary.cash.count} total={summary.cash.total} tone="emerald" />
        <BreakdownCard label="বাকি ক্রয়" count={summary.due.count} total={summary.due.total} outstanding={summary.due.outstanding} tone="orange" />
        <BreakdownCard label="কিস্তি ক্রয়" count={summary.installment.count} total={summary.installment.total} outstanding={summary.installment.outstanding} tone="sky" />
      </div>

      <Tabs defaultValue="purchases" className="mt-6">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="purchases">ক্রয় হিস্টরি ({activeCount})</TabsTrigger>
          <TabsTrigger value="ledger">লেজার ({entries.length})</TabsTrigger>
          <TabsTrigger value="installments">কিস্তি ({installments.length})</TabsTrigger>
          <TabsTrigger value="payments">পেমেন্ট ({entries.filter((e: any) => e.type === "payment").length})</TabsTrigger>
          <TabsTrigger value="messages">SMS/ইমেইল</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases" className="mt-3">
          <PurchasesList sales={sales} />
        </TabsContent>

        <TabsContent value="ledger" className="mt-3">
          <div className="mb-2 flex justify-end">
            <Button variant="outline" size="sm" disabled={entries.length === 0} onClick={() => downloadCSV(
              `ledger-${c.name}-${new Date().toISOString().slice(0, 10)}`,
              ["তারিখ", "ধরন", "বিবরণ", "ডেবিট", "ক্রেডিট", "ব্যালেন্স"],
              entries.map((e: any) => [
                (e.date ?? "").slice(0, 10), e.type, e.description,
                Number(e.debit || 0), Number(e.credit || 0), Number(e.balance || 0),
              ]),
            )}>
              <Download className="mr-1 h-3.5 w-3.5" /> CSV
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">তারিখ</th>
                  <th className="px-4 py-3">বিবরণ</th>
                  <th className="px-4 py-3 text-right">ডেবিট</th>
                  <th className="px-4 py-3 text-right">ক্রেডিট</th>
                  <th className="px-4 py-3 text-right">ব্যালেন্স</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-3 whitespace-nowrap">{(e.date ?? "").slice(0, 10)}</td>
                    <td className="px-4 py-3">{e.description}</td>
                    <td className="px-4 py-3 text-right">{Number(e.debit) ? money(e.debit) : "—"}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{Number(e.credit) ? money(e.credit) : "—"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${Number(e.balance) > 0 ? "text-orange-600" : ""}`}>{money(e.balance)}</td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">কোনো লেনদেন নেই</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="installments" className="mt-3">
          {installments.length === 0 ? (
            <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground">কোনো কিস্তি নেই</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">ইনভয়েস</th>
                    <th className="px-4 py-3">তারিখ</th>
                    <th className="px-4 py-3 text-right">পরিমাণ</th>
                    <th className="px-4 py-3 text-right">পরিশোধ</th>
                    <th className="px-4 py-3">স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((i: any) => (
                    <tr key={i.id} className="border-t">
                      <td className="px-4 py-3">#{i.installment_no}</td>
                      <td className="px-4 py-3">
                        <Link to="/app/sales/$saleId" params={{ saleId: i.sale_id }} className="text-primary hover:underline">
                          {i.sale_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{i.due_date}</td>
                      <td className="px-4 py-3 text-right">{money(i.amount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{money(i.paid_amount)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={
                          i.status === "paid" ? "default"
                          : i.status === "overdue" ? "destructive"
                          : "secondary"
                        }>{i.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-3">
          {(() => {
            const payments = entries.filter((e: any) => e.type === "payment");
            if (payments.length === 0) return <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground">কোনো পেমেন্ট নেই</div>;
            return (
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-4 py-3">তারিখ</th>
                      <th className="px-4 py-3">বিবরণ</th>
                      <th className="px-4 py-3 text-right">পরিমাণ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...payments].reverse().map((p: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="px-4 py-3 whitespace-nowrap">{(p.date ?? "").slice(0, 10)}</td>
                        <td className="px-4 py-3">{p.description}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">{money(p.credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent value="messages" className="mt-3">
          <CustomerDeliveryHistory customerId={customerId} />
        </TabsContent>
      </Tabs>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>পেমেন্ট গ্রহণ — {c.name}</DialogTitle>
          </DialogHeader>
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
            <div><Label>নোট</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>বাতিল</Button>
            <Button onClick={() => pay.mutate()} disabled={pay.isPending || amount <= 0}>নিশ্চিত করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, tone }: any) {
  const toneCls: Record<string, string> = { emerald: "text-emerald-600", orange: "text-orange-600", sky: "text-sky-600", default: "text-foreground" };
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-2 text-2xl font-black ${toneCls[tone] ?? toneCls.default}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function BreakdownCard({ label, count, total, outstanding, tone }: { label: string; count: number; total: number; outstanding?: number; tone: string }) {
  const border: Record<string, string> = { emerald: "border-emerald-200", orange: "border-orange-200", sky: "border-sky-200" };
  const dot: Record<string, string> = { emerald: "bg-emerald-500", orange: "bg-orange-500", sky: "bg-sky-500" };
  return (
    <div className={`rounded-2xl border-2 ${border[tone]} bg-card p-4`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot[tone]}`} />{label}
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-xl font-black">৳{Number(total).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}</div>
        <div className="text-xs text-muted-foreground">{count} টি</div>
      </div>
      {typeof outstanding === "number" && (
        <div className="mt-1 text-xs">বাকি: <span className={outstanding > 0 ? "font-semibold text-orange-600" : "text-emerald-600"}>৳{Number(outstanding).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}</span></div>
      )}
    </div>
  );
}

function PurchasesList({ sales }: { sales: any[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const typeLabel: Record<string, string> = { cash: "নগদ", due: "বাকি", installment: "কিস্তি" };
  const typeVar: Record<string, any> = { cash: "default", due: "secondary", installment: "outline" };
  const rows = sales
    .filter((s) => (filter === "cancelled" ? s.status === "cancelled" : s.status !== "cancelled"))
    .filter((s) => (filter === "all" || filter === "cancelled" ? true : s.sale_type === filter))
    .sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        {(["all", "cash", "due", "installment", "cancelled"] as const).map((k) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
            {k === "all" ? "সব" : k === "cancelled" ? "ক্যান্সেল" : typeLabel[k]}
          </Button>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground">এই ফিল্টারে কোনো ক্রয় নেই</div>
      ) : (
        <div className="space-y-2">
          {rows.map((s) => {
            const isOpen = openId === s.id;
            const items: any[] = s.items ?? [];
            return (
              <div key={s.id} className="rounded-xl border bg-card">
                <button
                  type="button"
                  className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                  onClick={() => setOpenId(isOpen ? null : s.id)}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-primary">{s.invoice_no ?? s.id.slice(0, 8)}</span>
                      {s.status === "cancelled"
                        ? <Badge variant="destructive">ক্যান্সেল</Badge>
                        : <Badge variant={typeVar[s.sale_type]}>{typeLabel[s.sale_type]}</Badge>}
                      <span className="text-xs text-muted-foreground">{(s.sale_date ?? "").slice(0, 10)} • {items.length} আইটেম</span>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-bold">৳{Number(s.total).toFixed(2)}</div>
                    <div className="text-xs">
                      <span className="text-emerald-600">পরি: ৳{Number(s.paid).toFixed(2)}</span>
                      {Number(s.due) > 0 && <span className="ml-2 text-orange-600">বাকি: ৳{Number(s.due).toFixed(2)}</span>}
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t bg-muted/20 px-4 py-3">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="py-1">পণ্য</th>
                          <th className="py-1 text-right">পরিমাণ</th>
                          <th className="py-1 text-right">দর</th>
                          <th className="py-1 text-right">মোট</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it: any) => (
                          <tr key={it.id} className="border-t border-border/40">
                            <td className="py-1.5">{it.product?.name ?? "—"}</td>
                            <td className="py-1.5 text-right">{Number(it.quantity)} {it.product?.unit?.short_name ?? ""}</td>
                            <td className="py-1.5 text-right">৳{Number(it.unit_price).toFixed(2)}</td>
                            <td className="py-1.5 text-right font-medium">৳{Number(it.line_total).toFixed(2)}</td>
                          </tr>
                        ))}
                        {items.length === 0 && (
                          <tr><td colSpan={4} className="py-3 text-center text-xs text-muted-foreground">আইটেম পাওয়া যায়নি</td></tr>
                        )}
                      </tbody>
                    </table>
                    <div className="mt-2 flex justify-end">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/app/sales/$saleId" params={{ saleId: s.id }}>ইনভয়েস দেখুন →</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
