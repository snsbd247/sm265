import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyShop,
  getMyPendingInvoice,
  initiateBkashForInvoice,
  submitInvoiceTrx,
  cancelMyPendingUpgrade,
} from "@/lib/shop.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, CreditCard, FileText, Lock, LogOut, XCircle, Zap } from "lucide-react";

export const Route = createFileRoute("/app/pay-invoice")({ ssr: false, component: PayInvoicePage });

function PayInvoicePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const shopFn = useServerFn(getMyShop);
  const invFn = useServerFn(getMyPendingInvoice);
  const bkashFn = useServerFn(initiateBkashForInvoice);
  const trxFn = useServerFn(submitInvoiceTrx);
  const cancelFn = useServerFn(cancelMyPendingUpgrade);

  const shopQ = useQuery({ queryKey: ["my-shop"], queryFn: () => shopFn() });
  const invQ = useQuery({ queryKey: ["my-pending-invoice"], queryFn: () => invFn(), refetchInterval: 15_000 });

  const [trx, setTrx] = useState("");
  const [bkNum, setBkNum] = useState("");

  const shop = shopQ.data?.shop;
  const inv: any = invQ.data;

  useEffect(() => {
    // If shop is active and no pending invoice, go back to app
    if (shop?.status === "active" && !inv) navigate({ to: "/app" });
  }, [shop, inv, navigate]);

  const [cbStatus, setCbStatus] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const bk = sp.get("bkash");
    if (bk) {
      setCbStatus(bk);
      if (bk === "success") setTimeout(() => qc.invalidateQueries(), 500);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [qc]);

  const bkash = useMutation({
    mutationFn: () => bkashFn({ data: { invoice_id: inv.id } }),
    onSuccess: (res: any) => { if (res?.url) window.location.href = res.url; },
    onError: (e: any) => toast.error(e.message ?? "bKash পেমেন্ট শুরু করা যায়নি"),
  });

  const submitTrx = useMutation({
    mutationFn: () => trxFn({ data: { invoice_id: inv.id, transaction_id: trx, bkash_number: bkNum || undefined } }),
    onSuccess: () => { toast.success("TrxID জমা হয়েছে — এডমিন অনুমোদনের অপেক্ষায়"); setTrx(""); setBkNum(""); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelUpg = useMutation({
    mutationFn: () => cancelFn(),
    onSuccess: () => { toast.success("আপগ্রেড বাতিল করা হয়েছে"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); };

  const isInitial = inv?.invoice_type === "initial";
  const isUpgrade = inv?.invoice_type === "upgrade";
  const proration: any = inv?.proration_details ?? null;

  return (
    <div className="mx-auto max-w-xl p-4 sm:p-8">
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          {isInitial ? <Lock className="h-7 w-7 text-amber-700" /> : <FileText className="h-7 w-7 text-amber-700" />}
        </div>
        <h1 className="mt-4 text-center text-xl font-bold sm:text-2xl">
          {isInitial ? "একাউন্ট এক্টিভেশন পেন্ডিং" : "আপগ্রেড ইনভয়েস পেন্ডিং"}
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {shop?.name} — {isInitial ? "প্রথম বিলিং পেমেন্ট বাকি আছে" : "প্যাকেজ পরিবর্তন অনুমোদনের জন্য পেমেন্ট প্রয়োজন"}
        </p>

        {cbStatus === "success" && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-5 w-5" /> পেমেন্ট সফল, একাউন্ট এক্টিভ হচ্ছে…
          </div>
        )}
        {cbStatus && cbStatus !== "success" && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <XCircle className="h-5 w-5" /> পেমেন্ট সম্পন্ন হয়নি ({cbStatus})
          </div>
        )}

        {!inv ? (
          <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
            <Clock className="mx-auto mb-2 h-6 w-6" />কোন পেন্ডিং ইনভয়েস নেই
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-lg border bg-muted/30 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ইনভয়েস</span>
                <span className="font-mono font-semibold">{inv.invoice_no}</span>
              </div>
              {proration && (
                <div className="mt-3 space-y-1 border-t pt-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">নতুন প্যাকেজ</span><span>{proration.new_package_name} ({proration.new_billing_cycle === "monthly" ? "মাসিক" : "বাৎসরিক"})</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">স্টিকার প্রাইস</span><span>৳{Number(proration.new_amount).toLocaleString("bn-BD")}</span></div>
                  <div className="flex justify-between text-emerald-700"><span>পুরনো প্যাকেজের ব্যবহারবিহীন মূল্য</span><span>− ৳{Number(proration.unused_value).toLocaleString("bn-BD")}</span></div>
                  {proration.credit_applied > 0 && (
                    <div className="flex justify-between text-emerald-700"><span>ক্রেডিট প্রয়োগ</span><span>− ৳{Number(proration.credit_applied).toLocaleString("bn-BD")}</span></div>
                  )}
                </div>
              )}
              <div className="mt-3 flex items-baseline justify-between border-t pt-3">
                <span className="text-sm text-muted-foreground">পরিশোধযোগ্য</span>
                <span className="text-2xl font-bold">৳{Number(inv.amount).toLocaleString("bn-BD")}</span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <Button
                className="w-full bg-pink-600 text-white hover:bg-pink-700"
                size="lg"
                onClick={() => bkash.mutate()}
                disabled={bkash.isPending}
              >
                <Zap className="mr-2 h-5 w-5" />
                {bkash.isPending ? "bKash এ রিডাইরেক্ট হচ্ছে…" : `bKash এ ৳${Number(inv.amount).toLocaleString("bn-BD")} পে করুন`}
              </Button>

              <div className="relative py-1 text-center text-xs text-muted-foreground">
                <span className="relative z-10 bg-card px-2">অথবা ম্যানুয়াল সেন্ড মানি</span>
                <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              </div>

              <div>
                <Label>bKash TrxID</Label>
                <Input value={trx} onChange={(e) => setTrx(e.target.value)} placeholder="8N7A2B3C4D" />
              </div>
              <div>
                <Label>আপনার bKash নম্বর</Label>
                <Input value={bkNum} onChange={(e) => setBkNum(e.target.value)} placeholder="01XXXXXXXXX" />
              </div>
              <Button variant="outline" className="w-full" onClick={() => submitTrx.mutate()} disabled={!trx || submitTrx.isPending}>
                <CreditCard className="mr-2 h-5 w-5" /> TrxID জমা দিন
              </Button>

              {isUpgrade && (
                <Button variant="ghost" className="w-full text-red-600 hover:text-red-700" onClick={() => cancelUpg.mutate()} disabled={cancelUpg.isPending}>
                  আপগ্রেড বাতিল করুন
                </Button>
              )}
            </div>
          </>
        )}

        <Button variant="ghost" className="mt-4 w-full" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> লগআউট
        </Button>
      </div>
    </div>
  );
}