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

// Isolate the impersonation tab from the super-admin tab on the same origin.
// Two Supabase cross-tab sync channels have to be neutered BEFORE the
// GoTrueClient is instantiated (which happens the first time __root's
// useEffect touches `supabase.auth.*`):
//   1) localStorage — the client persists the session here. We redirect
//      sb-* keys to sessionStorage so this tab has its own session and
//      never overwrites the admin's localStorage entry. (Storage-event
//      based sync is a side effect of that.)
//   2) BroadcastChannel — GoTrue also mirrors SIGNED_IN/SIGNED_OUT events
//      across same-origin tabs over a BroadcastChannel. Without disabling
//      it, `verifyOtp` in this tab pushes the shop's session into the
//      super-admin tab's in-memory client, its onAuthStateChange fires,
//      useAuth sees a non-super-admin user, and the admin layout kicks
//      them out to the landing page.
//
// We run this at MODULE SCOPE (guarded by pathname) because the route
// module is loaded during router match, BEFORE __root's mount effect
// creates the Supabase client. Doing it inside the component's useEffect
// is too late.
function isolateImpersonationTab() {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/impersonate") return;
  const w = window as unknown as { __lovableImpersonationIsolated?: boolean };
  if (w.__lovableImpersonationIsolated) return;
  w.__lovableImpersonationIsolated = true;

  // (1) Redirect sb-* localStorage reads/writes to sessionStorage.
  const shouldRedirect = (k: string) => k.startsWith("sb-");
  const ls = window.localStorage;
  const ss = window.sessionStorage;
  const origGet = ls.getItem.bind(ls);
  const origSet = ls.setItem.bind(ls);
  const origRemove = ls.removeItem.bind(ls);
  ls.getItem = (k: string) => (shouldRedirect(k) ? ss.getItem(k) : origGet(k));
  ls.setItem = (k: string, v: string) =>
    shouldRedirect(k) ? ss.setItem(k, v) : origSet(k, v);
  ls.removeItem = (k: string) =>
    shouldRedirect(k) ? ss.removeItem(k) : origRemove(k);
  ss.setItem("__lovable_impersonating", "1");

  // (2) Disable BroadcastChannel so GoTrue can't push our shop session
  //     into the super-admin tab (or receive the admin's events here).
  //     Replace with a no-op class scoped to this tab only.
  class NoopBroadcastChannel {
    name: string;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onmessageerror: ((ev: MessageEvent) => void) | null = null;
    constructor(name: string) {
      this.name = name;
    }
    postMessage(_msg: unknown) {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
      return true;
    }
  }
  (window as unknown as { BroadcastChannel: unknown }).BroadcastChannel =
    NoopBroadcastChannel;
}

isolateImpersonationTab();

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
        // Isolation already applied at module scope. Re-run as a safety net
        // in case this route was reached without a full-page load.
        isolateImpersonationTab();
        setStatus("টোকেন যাচাই হচ্ছে...");
        const res = await redeem({ data: { token } });
        // Import supabase AFTER isolation so its lazy proxy captures patched storage.
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
