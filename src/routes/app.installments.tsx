import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listInstallments, receiveCustomerPayment } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useState } from "react";
import { HandCoins, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/app/installments")({ component: Page });

type FilterStatus = "all" | "pending" | "overdue" | "paid" | "due_soon";

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listInstallments);
  const [status, setStatus] = useState<FilterStatus>("pending");
  const [payFor, setPayFor] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["installments", status],
    queryFn: () => listFn({ data: { status } }),
  });

  const rows = data?.rows ?? [];
  const summary = data?.summary;

  const fmt = (n: number) => `৳${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold sm:text-2xl">কিস্তি ট্র্যাকার</h1>
        <p className="text-sm text-muted-foreground">সকল কিস্তির অবস্থা ও দ্রুত পরিশোধ</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={<Clock className="h-5 w-5" />} label="মোট কিস্তি" value={String(summary?.total ?? 0)} tone="default" />
        <SummaryCard icon={<AlertTriangle className="h-5 w-5" />} label="ওভারডিউ" value={fmt(summary?.overdue_amount ?? 0)} tone="destructive" />
        <SummaryCard icon={<Clock className="h-5 w-5" />} label="অপেক্ষমাণ" value={fmt(summary?.pending_amount ?? 0)} tone="warning" />
        <SummaryCard icon={<CheckCircle2 className="h-5 w-5" />} label="পরিশোধিত" value={fmt(summary?.paid_amount ?? 0)} tone="success" />
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as FilterStatus)}>
        <TabsList className="h-auto max-w-full justify-start overflow-x-auto p-1">
          <TabsTrigger value="pending">অপেক্ষমাণ</TabsTrigger>
          <TabsTrigger value="overdue">ওভারডিউ</TabsTrigger>
          <TabsTrigger value="due_soon">৭ দিনের মধ্যে</TabsTrigger>
          <TabsTrigger value="paid">পরিশোধিত</TabsTrigger>
          <TabsTrigger value="all">সব</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">তারিখ</th>
              <th className="p-3">কাস্টমার</th>
              <th className="p-3">ইনভয়েস</th>
              <th className="p-3">কিস্তি নং</th>
              <th className="p-3 text-right">পরিমাণ</th>
              <th className="p-3 text-right">পরিশোধ</th>
              <th className="p-3 text-right">বাকি</th>
              <th className="p-3">অবস্থা</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">লোড হচ্ছে...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">কোনো কিস্তি নেই</td></tr>
            ) : rows.map((r: any) => {
              const remaining = Number(r.amount) - Number(r.paid_amount);
              const isOverdue = r.status === "overdue" || (r.status !== "paid" && r.due_date < today);
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-3 whitespace-nowrap">{r.due_date}</td>
                  <td className="p-3">
                    <div className="font-medium">{r.customer?.name ?? "-"}</div>
                    {r.customer?.phone && <div className="text-xs text-muted-foreground">{r.customer.phone}</div>}
                  </td>
                  <td className="p-3">{r.sale?.invoice_no ?? "-"}</td>
                  <td className="p-3">{r.installment_no}</td>
                  <td className="p-3 text-right">{fmt(r.amount)}</td>
                  <td className="p-3 text-right">{fmt(r.paid_amount)}</td>
                  <td className="p-3 text-right font-semibold">{fmt(remaining)}</td>
                  <td className="p-3">
                    <StatusBadge status={r.status} isOverdue={isOverdue} />
                  </td>
                  <td className="p-3">
                    {r.status !== "paid" && (
                      <Button size="sm" variant="outline" onClick={() => setPayFor(r)}>
                        <HandCoins className="mr-1 h-3 w-3" /> পরিশোধ
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {payFor && <PayDialog row={payFor} onClose={() => setPayFor(null)} onDone={() => qc.invalidateQueries({ queryKey: ["installments"] })} />}
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "default" | "destructive" | "warning" | "success" }) {
  const toneCls = {
    default: "text-foreground",
    destructive: "text-destructive",
    warning: "text-amber-600",
    success: "text-emerald-600",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
        <div className={`mt-2 text-xl font-bold ${toneCls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, isOverdue }: { status: string; isOverdue: boolean }) {
  if (status === "paid") return <Badge className="bg-emerald-500">পরিশোধিত</Badge>;
  if (isOverdue) return <Badge variant="destructive">ওভারডিউ</Badge>;
  if (status === "partial") return <Badge className="bg-amber-500">আংশিক</Badge>;
  return <Badge variant="secondary">অপেক্ষমাণ</Badge>;
}

function PayDialog({ row, onClose, onDone }: { row: any; onClose: () => void; onDone: () => void }) {
  const remaining = Number(row.amount) - Number(row.paid_amount);
  const recvFn = useServerFn(receiveCustomerPayment);
  const [amount, setAmount] = useState(remaining.toString());
  const [method, setMethod] = useState("cash");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState(`কিস্তি #${row.installment_no} — ${row.sale?.invoice_no ?? ""}`);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const m = useMutation({
    mutationFn: (d: any) => recvFn({ data: d }),
    onSuccess: () => { toast.success("পেমেন্ট গৃহীত"); onDone(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>কিস্তি পরিশোধ</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-muted p-3 text-sm">
            <div><b>{row.customer?.name}</b> — কিস্তি #{row.installment_no}</div>
            <div className="text-muted-foreground">বকেয়া: ৳{remaining.toFixed(2)} | নির্ধারিত তারিখ: {row.due_date}</div>
          </div>
          <div><Label>পরিমাণ</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><Label>পেমেন্ট পদ্ধতি</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">নগদ</SelectItem>
                <SelectItem value="bkash">bKash</SelectItem>
                <SelectItem value="nagad">Nagad</SelectItem>
                <SelectItem value="bank">ব্যাংক</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>তারিখ</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>রেফারেন্স (TrxID)</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} /></div>
          <div><Label>নোট</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button onClick={() => m.mutate({
            customer_id: row.customer_id,
            amount: Number(amount),
            payment_method: method,
            payment_date: date,
            reference: ref || undefined,
            note: note || undefined,
            sale_id: row.sale_id,
          })} disabled={m.isPending}>{m.isPending ? "..." : "সেভ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
