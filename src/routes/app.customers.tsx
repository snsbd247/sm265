import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCustomers, saveCustomer, deleteCustomer, getCustomerLedger, receiveCustomerPayment } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Pencil, Trash2, BookOpen, HandCoins } from "lucide-react";

export const Route = createFileRoute("/app/customers")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCustomers);
  const saveFn = useServerFn(saveCustomer);
  const delFn = useServerFn(deleteCustomer);
  const q = useQuery({ queryKey: ["customers"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (d: any) => saveFn({ data: d }),
    onSuccess: () => { toast.success("সংরক্ষিত"); qc.invalidateQueries({ queryKey: ["customers"] }); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("মুছে ফেলা হয়েছে"); qc.invalidateQueries({ queryKey: ["customers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing({ name: "", phone: "", address: "", opening_balance: 0, note: "", is_active: true }); setOpen(true); };
  const openEdit = (c: any) => { setEditing({ ...c }); setOpen(true); };

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">কাস্টমার</h1>
          <p className="text-sm text-muted-foreground">খুচরা / বাকি / কিস্তির ক্রেতা</p>
        </div>
        <Button className="shrink-0" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> নতুন কাস্টমার</Button>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">নাম</th>
              <th className="px-4 py-3">ফোন</th>
              <th className="px-4 py-3">স্ট্যাটাস</th>
              <th className="px-4 py-3 text-right">বকেয়া</th>
              <th className="px-4 py-3 text-right">অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-3 font-medium">{c.name}<br /><span className="text-xs text-muted-foreground">{c.address}</span></td>
                <td className="px-4 py-3">{c.phone ?? "-"}</td>
                <td className="px-4 py-3"><Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "সক্রিয়" : "বন্ধ"}</Badge></td>
                <td className={`px-4 py-3 text-right font-semibold ${Number(c.current_balance) > 0 ? "text-orange-600" : ""}`}>৳{Number(c.current_balance).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setPayingId(c.id)}><HandCoins className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setLedgerId(c.id)}><BookOpen className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => confirm("মুছবেন?") && del.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {q.data?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">কোনো কাস্টমার নেই</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "সম্পাদনা" : "নতুন কাস্টমার"}</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }} className="space-y-3">
              <div><Label>নাম</Label><Input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>ফোন</Label><Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
                <div><Label>প্রারম্ভিক বকেয়া</Label>
                  <Input type="number" step="0.01" disabled={!!editing.id}
                    value={editing.opening_balance ?? 0}
                    onChange={(e) => setEditing({ ...editing, opening_balance: Number(e.target.value) })} />
                </div>
              </div>
              <div><Label>ঠিকানা</Label><Input value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
              <div><Label>নোট</Label><Textarea rows={2} value={editing.note ?? ""} onChange={(e) => setEditing({ ...editing, note: e.target.value })} /></div>
              <DialogFooter><Button type="submit" disabled={save.isPending}>সংরক্ষণ</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <LedgerDialog customerId={ledgerId} onClose={() => setLedgerId(null)} />
      <PayDialog customerId={payingId} onClose={() => { setPayingId(null); qc.invalidateQueries({ queryKey: ["customers"] }); }} />
    </div>
  );
}

function LedgerDialog({ customerId, onClose }: { customerId: string | null; onClose: () => void }) {
  const fn = useServerFn(getCustomerLedger);
  const q = useQuery({
    queryKey: ["customer-ledger", customerId],
    queryFn: () => fn({ data: { customer_id: customerId! } }),
    enabled: !!customerId,
  });

  return (
    <Dialog open={!!customerId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader><DialogTitle>{q.data?.customer?.name} — লেজার</DialogTitle></DialogHeader>
        <div className="max-h-[50vh] overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-left sticky top-0">
              <tr>
                <th className="px-3 py-2">তারিখ</th>
                <th className="px-3 py-2">বিবরণ</th>
                <th className="px-3 py-2 text-right">ডেবিট (বিক্রি)</th>
                <th className="px-3 py-2 text-right">ক্রেডিট (পরিশোধ)</th>
                <th className="px-3 py-2 text-right">ব্যালেন্স</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.entries?.map((e: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">{new Date(e.date).toLocaleDateString("bn-BD")}</td>
                  <td className="px-3 py-2">{e.description}</td>
                  <td className="px-3 py-2 text-right">{e.debit ? `৳${e.debit.toFixed(2)}` : "-"}</td>
                  <td className="px-3 py-2 text-right">{e.credit ? `৳${e.credit.toFixed(2)}` : "-"}</td>
                  <td className="px-3 py-2 text-right font-semibold">৳{e.balance.toFixed(2)}</td>
                </tr>
              ))}
              {q.data?.entries?.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">কোনো লেনদেন নেই</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {q.data?.installments && q.data.installments.length > 0 && (
          <div className="mt-2 rounded-lg border">
            <div className="border-b bg-muted/50 px-3 py-2 text-sm font-semibold">কিস্তি সূচি</div>
            <div className="max-h-[25vh] overflow-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">নির্ধারিত তারিখ</th>
                    <th className="px-3 py-2 text-right">পরিমাণ</th>
                    <th className="px-3 py-2 text-right">পরিশোধিত</th>
                    <th className="px-3 py-2">স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.installments.map((s: any) => (
                    <tr key={s.id} className="border-t">
                      <td className="px-3 py-2">{s.installment_no}</td>
                      <td className="px-3 py-2">{new Date(s.due_date).toLocaleDateString("bn-BD")}</td>
                      <td className="px-3 py-2 text-right">৳{Number(s.amount).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">৳{Number(s.paid_amount).toFixed(2)}</td>
                      <td className="px-3 py-2"><Badge variant={s.status === "paid" ? "default" : "secondary"}>{s.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="flex justify-between border-t pt-3">
          <div className="text-sm text-muted-foreground">মোট বকেয়া</div>
          <div className="text-lg font-bold text-orange-600">৳{Number(q.data?.customer?.current_balance ?? 0).toFixed(2)}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PayDialog({ customerId, onClose }: { customerId: string | null; onClose: () => void }) {
  const fn = useServerFn(receiveCustomerPayment);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<"cash" | "bkash" | "bank">("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const m = useMutation({
    mutationFn: () => fn({ data: { customer_id: customerId!, amount, payment_method: method, reference, note } }),
    onSuccess: () => { toast.success("পেমেন্ট রেকর্ড হয়েছে"); onClose(); setAmount(0); setReference(""); setNote(""); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!customerId} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>কাস্টমার থেকে পেমেন্ট</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>পরিমাণ</Label><Input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
            <div><Label>মেথড</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">নগদ</SelectItem>
                  <SelectItem value="bkash">বিকাশ</SelectItem>
                  <SelectItem value="bank">ব্যাংক</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>রেফারেন্স (TrxID/চেক)</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
          <div><Label>নোট</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <DialogFooter><Button type="submit" disabled={m.isPending}>পেমেন্ট রেকর্ড</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
