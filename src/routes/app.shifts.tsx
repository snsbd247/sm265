import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentShift, openShift, closeShift, listShifts } from "@/lib/shifts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { PlayCircle, StopCircle, Wallet } from "lucide-react";

export const Route = createFileRoute("/app/shifts")({ component: Page });

const money = (n: any) => `৳${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;

function Page() {
  const qc = useQueryClient();
  const curFn = useServerFn(getCurrentShift);
  const listFn = useServerFn(listShifts);
  const openFn = useServerFn(openShift);
  const closeFn = useServerFn(closeShift);

  const cur = useQuery({ queryKey: ["shift-current"], queryFn: () => curFn(), refetchInterval: 30_000 });
  const list = useQuery({ queryKey: ["shifts"], queryFn: () => listFn() });

  const [openDlg, setOpenDlg] = useState(false);
  const [openingCash, setOpeningCash] = useState(0);
  const [openNote, setOpenNote] = useState("");

  const [closeDlg, setCloseDlg] = useState(false);
  const [closingCash, setClosingCash] = useState(0);
  const [closeNote, setCloseNote] = useState("");

  const openM = useMutation({
    mutationFn: () => openFn({ data: { opening_cash: openingCash, note: openNote || null } }),
    onSuccess: () => { toast.success("শিফট শুরু হয়েছে"); qc.invalidateQueries({ queryKey: ["shift-current"] }); qc.invalidateQueries({ queryKey: ["shifts"] }); setOpenDlg(false); setOpeningCash(0); setOpenNote(""); },
    onError: (e: any) => toast.error(e.message),
  });
  const closeM = useMutation({
    mutationFn: () => closeFn({ data: { shift_id: cur.data?.shift?.id, closing_cash_actual: closingCash, note: closeNote || null } }),
    onSuccess: () => { toast.success("শিফট বন্ধ হয়েছে"); qc.invalidateQueries({ queryKey: ["shift-current"] }); qc.invalidateQueries({ queryKey: ["shifts"] }); setCloseDlg(false); setClosingCash(0); setCloseNote(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const shift = cur.data?.shift;
  const totals = cur.data?.totals;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">শিফট / ক্যাশ ড্রয়ার</h1>
          <p className="text-sm text-muted-foreground">POS শিফট ওপেন করুন, দিন শেষে ক্যাশ মিলিয়ে ক্লোজ করুন</p>
        </div>
        {!shift ? (
          <Button onClick={() => setOpenDlg(true)}><PlayCircle className="mr-2 h-4 w-4" /> শিফট শুরু</Button>
        ) : (
          <Button variant="destructive" onClick={() => { setClosingCash(totals?.expected_cash ?? 0); setCloseDlg(true); }}>
            <StopCircle className="mr-2 h-4 w-4" /> শিফট বন্ধ
          </Button>
        )}
      </div>

      {shift && totals && (
        <div className="mt-5 rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4" />
            শুরু: {new Date(shift.opened_at).toLocaleString("bn-BD")}
            <Badge variant="default" className="ml-2 bg-emerald-500">চলছে</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="বিক্রয় সংখ্যা" value={String(totals.count)} />
            <Kpi label="মোট বিক্রয়" value={money(totals.total_sales)} tone="brand" />
            <Kpi label="প্রারম্ভিক ক্যাশ" value={money(shift.opening_cash)} />
            <Kpi label="প্রত্যাশিত ক্যাশ" value={money(totals.expected_cash)} tone="warn" />
          </div>
          <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4">
            <div><span className="text-muted-foreground">নগদ:</span> <b>{money(totals.cash)}</b></div>
            <div><span className="text-muted-foreground">কার্ড:</span> <b>{money(totals.card)}</b></div>
            <div><span className="text-muted-foreground">বিকাশ:</span> <b>{money(totals.bkash)}</b></div>
            <div><span className="text-muted-foreground">ব্যাংক:</span> <b>{money(totals.bank)}</b></div>
          </div>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">শুরু</th>
              <th className="px-4 py-3">শেষ</th>
              <th className="px-4 py-3">স্ট্যাটাস</th>
              <th className="px-4 py-3 text-right">সেল</th>
              <th className="px-4 py-3 text-right">মোট</th>
              <th className="px-4 py-3 text-right">প্রত্যাশিত</th>
              <th className="px-4 py-3 text-right">প্রকৃত</th>
              <th className="px-4 py-3 text-right">ভ্যারিয়েন্স</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((s: any) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-3">{new Date(s.opened_at).toLocaleString("bn-BD")}</td>
                <td className="px-4 py-3">{s.closed_at ? new Date(s.closed_at).toLocaleString("bn-BD") : "—"}</td>
                <td className="px-4 py-3"><Badge variant={s.status === "open" ? "default" : "secondary"}>{s.status === "open" ? "চলছে" : "বন্ধ"}</Badge></td>
                <td className="px-4 py-3 text-right">{s.sales_count}</td>
                <td className="px-4 py-3 text-right">{money(s.total_sales)}</td>
                <td className="px-4 py-3 text-right">{money(s.closing_cash_expected)}</td>
                <td className="px-4 py-3 text-right">{s.closing_cash_actual != null ? money(s.closing_cash_actual) : "—"}</td>
                <td className={`px-4 py-3 text-right font-semibold ${Number(s.variance ?? 0) < 0 ? "text-rose-600" : Number(s.variance ?? 0) > 0 ? "text-emerald-600" : ""}`}>
                  {s.variance != null ? money(s.variance) : "—"}
                </td>
              </tr>
            ))}
            {(list.data ?? []).length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">কোনো শিফট রেকর্ড নেই</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={openDlg} onOpenChange={setOpenDlg}>
        <DialogContent>
          <DialogHeader><DialogTitle>শিফট শুরু</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>প্রারম্ভিক ক্যাশ (৳)</Label>
              <Input type="number" min="0" step="0.01" value={openingCash} onChange={(e) => setOpeningCash(Number(e.target.value))} />
            </div>
            <div><Label>নোট</Label><Textarea rows={2} value={openNote} onChange={(e) => setOpenNote(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDlg(false)}>বাতিল</Button>
            <Button onClick={() => openM.mutate()} disabled={openM.isPending}>শুরু করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDlg} onOpenChange={setCloseDlg}>
        <DialogContent>
          <DialogHeader><DialogTitle>শিফট বন্ধ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border bg-slate-50 p-3 text-sm space-y-1.5">
              <div className="flex justify-between"><span>বিক্রয় সংখ্যা</span><b>{totals?.count ?? 0}</b></div>
              <div className="flex justify-between"><span>মোট বিক্রয়</span><b>{money(totals?.total_sales)}</b></div>
              <div className="my-1 border-t" />
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">পেমেন্ট মেথড ব্রেকডাউন</div>
              <div className="flex justify-between"><span>নগদ</span><b>{money(totals?.cash)}</b></div>
              <div className="flex justify-between"><span>কার্ড</span><b>{money(totals?.card)}</b></div>
              <div className="flex justify-between"><span>বিকাশ</span><b>{money(totals?.bkash)}</b></div>
              <div className="flex justify-between"><span>ব্যাংক</span><b>{money(totals?.bank)}</b></div>
              <div className="my-1 border-t" />
              <div className="flex justify-between"><span>প্রারম্ভিক ক্যাশ</span><b>{money(shift?.opening_cash)}</b></div>
              <div className="flex justify-between text-base"><span>প্রত্যাশিত ক্যাশ</span><b>{money(totals?.expected_cash)}</b></div>
            </div>
            <div>
              <Label>প্রকৃত গণনাকৃত ক্যাশ (৳)</Label>
              <Input type="number" min="0" step="0.01" value={closingCash} onChange={(e) => setClosingCash(Number(e.target.value))} />
            </div>
            <div>
              <Label>নোট</Label>
              <Textarea rows={2} value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="যেমন: শর্ট/এক্সট্রা কারণ" />
            </div>
            {(() => {
              const variance = closingCash - (totals?.expected_cash ?? 0);
              const abs = Math.abs(variance);
              if (abs < 0.01) {
                return (
                  <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    ✅ ক্যাশ ঠিকঠাক মিলেছে। ভ্যারিয়েন্স: <b>{money(0)}</b>
                  </div>
                );
              }
              return (
                <div className={`rounded-md border px-3 py-2 text-sm ${variance < 0 ? "border-rose-300 bg-rose-50 text-rose-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                  ⚠️ ক্যাশ মিল নেই। ভ্যারিয়েন্স: <b>{money(variance)}</b> ({variance < 0 ? "শর্ট" : "এক্সট্রা"})।
                  <div className="mt-1 text-[11px]">কারণ নোটে উল্লেখ করুন — এটি অডিটে সংরক্ষিত হবে।</div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDlg(false)}>বাতিল</Button>
            <Button
              variant="destructive"
              onClick={() => closeM.mutate()}
              disabled={
                closeM.isPending ||
                (Math.abs(closingCash - (totals?.expected_cash ?? 0)) >= 0.01 && closeNote.trim().length < 3)
              }
              title={
                Math.abs(closingCash - (totals?.expected_cash ?? 0)) >= 0.01 && closeNote.trim().length < 3
                  ? "ভ্যারিয়েন্স থাকলে কারণ নোট বাধ্যতামূলক"
                  : undefined
              }
            >
              বন্ধ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "brand" | "warn" }) {
  const toneCls = tone === "brand" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : tone === "warn" ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-white text-slate-900 border-slate-200";
  return (
    <div className={`rounded-xl border p-3 ${toneCls}`}>
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}