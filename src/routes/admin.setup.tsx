import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapSuperAdmin } from "@/lib/auth.functions";

export const Route = createFileRoute("/admin/setup")({ component: Setup });

function Setup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const bootstrap = useServerFn(bootstrapSuperAdmin);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // signup
      const { error: suErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (suErr && !suErr.message.includes("registered")) throw suErr;
      // signIn to ensure session
      const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
      if (siErr) throw siErr;
      // claim super admin
      await bootstrap();
      toast.success("সুপার এডমিন তৈরি হয়েছে");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "সেটাপ ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-white">
          <ShieldCheck className="h-6 w-6" />
          <span className="text-lg font-bold">প্রথমবার সেটাপ</span>
        </div>
        <div className="rounded-xl border bg-card p-8 shadow-lg">
          <h1 className="text-xl font-bold">সুপার এডমিন তৈরি করুন</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            এই স্ক্রিন থেকে শুধু একবারই সুপার এডমিন তৈরি করা যাবে।
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>নাম</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>ইমেইল</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)</Label>
              <Input type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "তৈরি হচ্ছে..." : "সুপার এডমিন তৈরি করুন"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link to="/admin/login" className="text-xs text-muted-foreground hover:underline">
              লগিন এ ফিরে যান
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
