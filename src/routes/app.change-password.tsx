import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { changeMyPassword } from "@/lib/admin.functions";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/app/change-password")({
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const fn = useServerFn(changeMyPassword);

  const m = useMutation({
    mutationFn: () => fn({ data: { new_password: pw } }),
    onSuccess: () => {
      toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে");
      setPw(""); setPw2("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) return toast.error("কমপক্ষে ৬ ডিজিটের পাসওয়ার্ড দিন");
    if (pw !== pw2) return toast.error("পাসওয়ার্ড মিলছে না");
    m.mutate();
  };

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">পাসওয়ার্ড পরিবর্তন</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          কমপক্ষে ৬ ডিজিট। আপনি চাইলে ডিফল্ট পাসওয়ার্ড (123456789) রেখে দিতে পারেন।
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>নতুন পাসওয়ার্ড</Label>
            <Input type="password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div>
            <Label>নতুন পাসওয়ার্ড আবার দিন</Label>
            <Input type="password" minLength={6} required value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          <Button type="submit" disabled={m.isPending} className="w-full">
            {m.isPending ? "সংরক্ষণ হচ্ছে..." : "পরিবর্তন করুন"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
