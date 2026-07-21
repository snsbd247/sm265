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
import { toast } from "sonner";
import { useState } from "react";
import { ArrowLeft, HandCoins, Phone, MapPin, Download } from "lucide-react";
import { downloadCSV } from "@/lib/export-utils";
import { CustomerDeliveryHistory } from "@/components/invoice-delivery-history";

export const Route = createFileRoute("/app/customers/$customerId")({ component: Page });

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
  const c = q.data?.customer;
  const entries = q.data?.entries ?? [];
  const installments = q.data?.installments ?? [];
  if (!c) return <div className="p-6">কাস্টমার পাওয়া যায়নি</div>;

  const balance = entries.length ? entries[entries.length - 1].balance : 0;

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

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-bold">লেজার</h2>
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

      <div className="mt-3 overflow-x-auto rounded-xl border bg-card">
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

      {installments.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-bold">কিস্তি সূচি</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border bg-card">
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
        </>
      )}

      {(() => {
        const payments = entries.filter((e: any) => e.type === "payment");
        if (payments.length === 0) return null;
        return (
          <>
            <h2 className="mt-8 text-lg font-bold">পেমেন্ট হিস্টরি</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border bg-card">
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
          </>
        );
      })()}

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

      <h2 className="mt-8 text-lg font-bold">SMS / ইমেইল হিস্ট্রি</h2>
      <div className="mt-3">
        <CustomerDeliveryHistory customerId={customerId} />
      </div>
    </div>
  );
}