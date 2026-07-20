import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { redeemImpersonationToken } from "@/lib/impersonation.functions";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/impersonate")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ token: String(s.token ?? "") }),
  component: ImpersonatePage,
});

// Hijack localStorage for Supabase auth keys → sessionStorage.
// This isolates the impersonation tab's session from the super admin's tab.
// Must run BEFORE any `import { supabase } from "@/integrations/supabase/client"` access.
let hijacked = false;
function hijackAuthStorage() {
  if (hijacked || typeof window === "undefined") return;
  hijacked = true;
  const shouldRedirect = (k: string) => k.startsWith("sb-");
  const ls = window.localStorage;
  const ss = window.sessionStorage;
  const origGet = ls.getItem.bind(ls);
  const origSet = ls.setItem.bind(ls);
  const origRemove = ls.removeItem.bind(ls);
  ls.getItem = (k: string) => (shouldRedirect(k) ? ss.getItem(k) : origGet(k));
  ls.setItem = (k: string, v: string) => (shouldRedirect(k) ? ss.setItem(k, v) : origSet(k, v));
  ls.removeItem = (k: string) => (shouldRedirect(k) ? ss.removeItem(k) : origRemove(k));
  // NOTE: do NOT clear existing sb-* keys from localStorage — localStorage is
  // shared across tabs on the same origin, so clearing here would sign the
  // super admin out in their original tab.
  ss.setItem("__lovable_impersonating", "1");
}

function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("মেয়াদ") || m.includes("expire")) return "টোকেনের মেয়াদ শেষ (৬০ সেকেন্ড পার হয়েছে)। সুপার এডমিন ট্যাব থেকে আবার চেষ্টা করুন।";
  if (m.includes("আগেই") || m.includes("consumed") || m.includes("already")) return "এই টোকেন আগে ব্যবহার হয়েছে। প্রতিটি টোকেন এক বার ব্যবহারযোগ্য — নতুন করে ইস্যু করুন।";
  if (m.includes("অবৈধ") || m.includes("invalid")) return "অবৈধ বা ভুল টোকেন। লিঙ্কটি সম্পূর্ণ কপি হয়নি — নতুন করে চেষ্টা করুন।";
  if (m.includes("টোকেন নেই")) return "URL-এ টোকেন পাওয়া যায়নি। সুপার এডমিন ট্যাব থেকে 'শপ হিসেবে লগইন' বাটন চাপুন।";
  return msg;
}

function ImpersonatePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const redeem = useServerFn(redeemImpersonationToken);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("সেশন প্রস্তুত হচ্ছে...");

  useEffect(() => {
    (async () => {
      try {
        if (!token) throw new Error("টোকেন নেই।");
        hijackAuthStorage();
        setStatus("টোকেন যাচাই হচ্ছে...");
        const res = await redeem({ data: { token } });
        // Import supabase AFTER hijack so its lazy proxy captures patched storage methods
        const { supabase } = await import("@/integrations/supabase/client");
        setStatus("লগইন হচ্ছে...");
        const { error: vErr } = await supabase.auth.verifyOtp({
          token_hash: res.token_hash,
          type: "magiclink",
        });
        if (vErr) throw new Error(vErr.message);
        setStatus("শপ প্যানেলে নিয়ে যাওয়া হচ্ছে...");
        navigate({ to: "/app" });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "অজানা ত্রুটি";
        setError(friendlyError(msg));
        toast.error(friendlyError(msg));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-rose-50 via-white to-amber-50 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-lg">
        {error ? (
          <>
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <div className="text-lg font-semibold text-destructive">ইম্পার্সোনেশন ব্যর্থ</div>
            <div className="mt-2 text-sm text-muted-foreground">{error}</div>
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={() => window.close()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                এই ট্যাব বন্ধ করুন
              </button>
              <button
                onClick={() => { window.location.href = "/admin/shops"; }}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                সুপার এডমিন প্যানেলে ফিরুন
              </button>
              <button
                onClick={() => { window.location.href = "/admin/impersonation-logs"; }}
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                অডিট লগ দেখুন
              </button>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-primary" />
            <div className="text-lg font-semibold">সুপার এডমিন → শপ লগইন</div>
            <div className="mt-2 text-sm text-muted-foreground">{status}</div>
          </>
        )}
      </div>
    </div>
  );
}
