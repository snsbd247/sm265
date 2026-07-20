import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyShop, submitRenewalPayment, initiateBkashPayment } from "@/lib/shop.functions";
import { listPackages } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, LogOut, CreditCard, Clock, Zap, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/renew")({ ssr: false, component: RenewPage });

function RenewPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { loading, session } = useAuth();
  const fn = useServerFn(getMyShop);
  const pkgFn = useServerFn(listPackages);
  const submitFn = useServerFn(submitRenewalPayment);
  const bkashFn = useServerFn(initiateBkashPayment);

  const { data } = useQuery({ queryKey: ["my-shop"], queryFn: () => fn(), enabled: !!session });
  const pkgQ = useQuery({ queryKey: ["packages"], queryFn: () => pkgFn(), enabled: !!session });

  const [pkgId, setPkgId] = useState<string>("");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [trx, setTrx] = useState("");
  const [bkNum, setBkNum] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (data?.shop && !pkgId) {
      setPkgId(data.shop.package_id ?? "");
      setCycle((data.shop.billing_cycle as any) ?? "monthly");
    }
  }, [data, pkgId]);

  const shop = data?.shop;

  const submit = useMutation({
    mutationFn: () => submitFn({ data: { package_id: pkgId, billing_cycle: cycle, transaction_id: trx, bkash_number: bkNum } }),
    onSuccess: () => {
      toast.success("পেমেন্ট জমা হয়েছে! এডমিন অনুমোদনের অপেক্ষায়");
      setPending(true); setTrx(""); setBkNum("");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bkashPay = useMutation({
    mutationFn: () => bkashFn({ data: { package_id: pkgId, billing_cycle: cycle } }),
    onSuccess: (res: any) => { if (res?.url) window.location.href = res.url; },
    onError: (e: any) => toast.error(e.message ?? "bKash পেমেন্ট শুরু করা যায়নি"),
  });

  // Handle bKash callback status from query string
  const [cbStatus, setCbStatus] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const bk = sp.get("bkash");
    if (bk) {
      setCbStatus(bk);
      if (bk === "success") {
        toast.success("পেমেন্ট সফল! একাউন্ট এক্টিভ হচ্ছে…");
        setTimeout(() => qc.invalidateQueries(), 500);
      } else if (bk === "failed" || bk === "failure" || bk === "error") {
        toast.error("পেমেন্ট ব্যর্থ হয়েছে");
      } else if (bk === "cancel") {
        toast("পেমেন্ট বাতিল করা হয়েছে");
      }
      // Clean the URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [qc]);

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); };

  if (shop && shop.status === "active") {
    navigate({ to: "/app" });
    return null;
  }

  const activePkg = pkgQ.data?.find((p: any) => p.id === pkgId);
  const amount = activePkg ? (cycle === "monthly" ? activePkg.price_monthly : activePkg.price_yearly) : 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <Lock className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="mt-4 text-center text-2xl font-bold">একাউন্ট লকড</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          <span className="font-medium">{shop?.name}</span> — সাবস্ক্রিপশনের মেয়াদ শেষ। বিকাশ পেমেন্ট করে রিনিউ করুন।
        </p>

        {cbStatus === "success" && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border-2 border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <CheckCircle2 className="h-5 w-5" /> পেমেন্ট সফল। একাউন্ট এক্টিভ হচ্ছে…
          </div>
        )}
        {cbStatus && cbStatus !== "success" && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <XCircle className="h-5 w-5" /> পেমেন্ট সম্পন্ন হয়নি ({cbStatus})। আবার চেষ্টা করুন।
          </div>
        )}

        {pending ? (
          <div className="mt-6 rounded-lg border-2 border-yellow-200 bg-yellow-50 p-4 text-center">
            <Clock className="mx-auto h-8 w-8 text-yellow-600" />
            <div className="mt-2 font-semibold">পেমেন্ট রিভিউ চলছে</div>
            <div className="mt-1 text-xs text-muted-foreground">
              এডমিন অনুমোদন করার সাথে সাথে আপনার একাউন্ট এক্টিভ হয়ে যাবে।
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <div>
              <Label>প্যাকেজ</Label>
              <Select value={pkgId} onValueChange={setPkgId}>
                <SelectTrigger><SelectValue placeholder="প্যাকেজ" /></SelectTrigger>
                <SelectContent>
                  {pkgQ.data?.filter((p: any) => p.is_active).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>বিলিং</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">মাসিক</SelectItem>
                  <SelectItem value="yearly">বাৎসরিক</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between"><span>মোট:</span><span className="text-lg font-bold">৳{amount}</span></div>
            </div>

            <Button
              className="w-full bg-pink-600 hover:bg-pink-700 text-white"
              size="lg"
              onClick={() => bkashPay.mutate()}
              disabled={!pkgId || bkashPay.isPending || amount <= 0}
            >
              <Zap className="mr-2 h-5 w-5" />
              {bkashPay.isPending ? "bKash এ রিডাইরেক্ট হচ্ছে…" : `bKash এ ৳${amount} পে করুন`}
            </Button>

            <div className="relative py-2 text-center text-xs text-muted-foreground">
              <span className="bg-card px-2 relative z-10">অথবা ম্যানুয়াল সেন্ড মানি</span>
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
            <Button variant="outline" className="w-full" onClick={() => submit.mutate()} disabled={!trx || !pkgId || submit.isPending}>
              <CreditCard className="mr-2 h-5 w-5" /> ম্যানুয়াল পেমেন্ট জমা দিন
            </Button>
          </div>
        )}

        <Button variant="ghost" className="mt-4 w-full" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> লগআউট
        </Button>
      </div>
    </div>
  );
}
