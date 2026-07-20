import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Lock, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";

export const Route = createFileRoute("/admin/login")({ component: AdminLogin });

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { siteName, logoUrl } = useBranding();

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { session, isSuperAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && session && isSuperAdmin) navigate({ to: "/admin" });
  }, [session, isSuperAdmin, authLoading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const uid = signIn.user?.id;
      if (!uid) throw new Error("লগিন ব্যর্থ");
      // Verify super admin role BEFORE redirecting — avoids the race where
      // the layout guard fires while roles are still loading.
      const { data: role, error: rErr } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", uid)
        .eq("role", "super_admin")
        .maybeSingle();
      if (rErr) throw rErr;
      if (!role) {
        await supabase.auth.signOut();
        toast.error("এই ইউজারের সুপার এডমিন অ্যাক্সেস নেই।");
        return;
      }
      toast.success("সফল লগিন");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "লগিন ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      {/* Colorful backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-fuchsia-600/40 blur-3xl motion-reduce:hidden" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-sky-500/40 blur-3xl motion-reduce:hidden" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-amber-500/30 blur-3xl motion-reduce:hidden" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:32px_32px]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-white">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="h-11 w-11 rounded-xl object-contain bg-white p-1 shadow-lg" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-fuchsia-500 shadow-lg">
              <ShieldCheck className="h-5 w-5" />
            </div>
          )}
          <span className="text-xl font-bold tracking-tight">{siteName}</span>
          <span className="rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-xs uppercase text-white/80">
            Admin
          </span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">সুপার এডমিন লগিন</h1>
            <p className="mt-1 text-sm text-white/60">শুধুমাত্র অনুমোদিত এডমিনদের জন্য।</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/80">ইমেইল</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="border-white/15 bg-white/5 pl-9 text-white placeholder:text-white/40 focus-visible:ring-fuchsia-500"
                  placeholder="admin@example.com"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/80">পাসওয়ার্ড</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="border-white/15 bg-white/5 pl-9 text-white placeholder:text-white/40 focus-visible:ring-fuchsia-500"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-fuchsia-500 to-sky-500 text-white shadow-lg transition hover:from-fuchsia-600 hover:to-sky-600"
              disabled={loading}
            >
              {loading ? "লগিন হচ্ছে..." : (<>লগিন করুন <ArrowRight className="ml-1 h-4 w-4" /></>)}
            </Button>
          </form>
          <div className="mt-6 flex justify-between text-xs text-white/60">
            <Link to="/admin/setup" className="hover:text-white hover:underline">প্রথম সেটাপ</Link>
            <Link to="/" className="hover:text-white hover:underline">হোম</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
