import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyShop, listMyPayments, listMySubscriptions, submitRenewalPayment } from "@/lib/shop.functions";
import { listPackages } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { CreditCard, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/app/subscription")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const shopFn = useServerFn(getMyShop);
  const paysFn = useServerFn(listMyPayments);
  const subsFn = useServerFn(listMySubscriptions);
  const pkgFn = useServerFn(listPackages);
  const submitFn = useServerFn(submitRenewalPayment);

  const shopQ = useQuery({ queryKey: ["my-shop"], queryFn: () => shopFn() });
  const paysQ = useQuery({ queryKey: ["my-payments"], queryFn: () => paysFn() });
  const subsQ = useQuery({ queryKey: ["my-subs"], queryFn: () => subsFn() });
  const pkgQ = useQuery({ queryKey: ["packages"], queryFn: () => pkgFn() });

  const shop = shopQ.data?.shop;

  const [open, setOpen] = useState(false);
  const [pkgId, setPkgId] = useState<string>("");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [trx, setTrx] = useState("");
  const [bkNum, setBkNum] = useState("");

  const submit = useMutation({
    mutationFn: () => submitFn({ data: { package_id: pkgId, billing_cycle: cycle, transaction_id: trx, bkash_number: bkNum } }),
    onSuccess: () => {
      toast.success("পেমেন্ট জমা হয়েছে, এডমিন অনুমোদনের অপেক্ষায়");
      setOpen(false); setTrx(""); setBkNum("");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openDialog = (upgrade = false) => {
    setPkgId(shop?.package_id ?? "");
    setCycle((shop?.billing_cycle as any) ?? "monthly");
    setOpen(true);
    if (upgrade) toast.info("প্যাকেজ আপগ্রেড এর জন্য নতুন প্যাকেজ সিলেক্ট করুন");
  };

  const activePkg = pkgQ.data?.find((p: any) => p.id === pkgId);
  const amount = activePkg ? (cycle === "monthly" ? activePkg.price_monthly : activePkg.price_yearly) : 0;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold sm:text-2xl">সাবস্ক্রিপশন</h1>
        <p className="text-sm text-muted-foreground">আপনার প্যাকেজ, মেয়াদ, রিনিউ, আপগ্রেড</p>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground">বর্তমান প্যাকেজ</div>
            <div className="mt-1 text-2xl font-bold">{shop?.package?.name ?? "-"}</div>
            <div className="mt-2 text-sm">
              বিলিং: {shop?.billing_cycle === "monthly" ? "মাসিক" : "বাৎসরিক"} · ৳
              {shop?.billing_cycle === "monthly" ? shop?.package?.price_monthly : shop?.package?.price_yearly}
            </div>
          </div>
          <div>
            <Badge variant={shop?.status === "active" ? "default" : "destructive"}>
              {shop?.status === "active" ? "একটিভ" : shop?.status}
            </Badge>
            <div className="mt-2 text-xs text-muted-foreground">
              মেয়াদ শেষ: {shop?.subscription_end ? new Date(shop.subscription_end).toLocaleDateString("bn-BD") : "-"}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => openDialog(false)}><CreditCard className="mr-2 h-4 w-4" /> রিনিউ করুন</Button>
          <Button variant="outline" onClick={() => openDialog(true)}><TrendingUp className="mr-2 h-4 w-4" /> প্যাকেজ আপগ্রেড</Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">পেমেন্ট ইতিহাস</h2>
          <div className="space-y-2">
            {paysQ.data?.length === 0 && <div className="text-sm text-muted-foreground">কোন পেমেন্ট নেই</div>}
            {paysQ.data?.map((p: any) => (
              <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b pb-2 text-sm last:border-0">
                <div className="min-w-0">
                  <div className="font-medium">৳{Number(p.amount).toLocaleString("bn-BD")}</div>
                  <div className="text-xs text-muted-foreground">TrxID: {p.transaction_id ?? "-"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("bn-BD")}</div>
                </div>
                <Badge variant={p.status === "success" ? "default" : p.status === "pending" ? "secondary" : "destructive"}>
                  {p.status === "success" ? "অনুমোদিত" : p.status === "pending" ? "অপেক্ষমান" : "বাতিল"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-semibold">সাবস্ক্রিপশন লগ</h2>
          <div className="space-y-2">
            {subsQ.data?.map((s: any) => (
              <div key={s.id} className="flex justify-between border-b pb-2 text-sm last:border-0">
                <div>
                  <div className="font-medium">{s.package?.name} · {s.billing_cycle === "monthly" ? "মাসিক" : "বাৎসরিক"}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.starts_at).toLocaleDateString("bn-BD")} — {new Date(s.ends_at).toLocaleDateString("bn-BD")}
                  </div>
                </div>
                <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>বিকাশ পেমেন্ট জমা দিন</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>প্যাকেজ</Label>
              <Select value={pkgId} onValueChange={setPkgId}>
                <SelectTrigger><SelectValue placeholder="প্যাকেজ" /></SelectTrigger>
                <SelectContent>
                  {pkgQ.data?.filter((p: any) => p.is_active).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — ৳{p.price_monthly}/mo</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>বিলিং সাইকেল</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">মাসিক</SelectItem>
                  <SelectItem value="yearly">বাৎসরিক</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between"><span>মোট:</span><span className="font-bold">৳{amount}</span></div>
              <div className="mt-2 text-xs text-muted-foreground">
                সেন্ড মানি করুন এডমিন এর বিকাশ নম্বরে, তারপর TrxID লিখুন।
              </div>
            </div>

            <div>
              <Label>bKash TrxID *</Label>
              <Input value={trx} onChange={(e) => setTrx(e.target.value)} placeholder="উদাহরণ: 8N7A2B3C4D" />
            </div>
            <div>
              <Label>আপনার bKash নম্বর</Label>
              <Input value={bkNum} onChange={(e) => setBkNum(e.target.value)} placeholder="01XXXXXXXXX" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => submit.mutate()} disabled={!trx || !pkgId || submit.isPending}>
              জমা দিন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
