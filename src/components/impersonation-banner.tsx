import { useEffect, useState } from "react";
import { ShieldAlert, LogOut } from "lucide-react";

export function ImpersonationBanner() {
  const [active, setActive] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setActive(window.sessionStorage.getItem("__lovable_impersonating") === "1");
  }, []);

  const endImpersonation = async () => {
    setEnding(true);
    try {
      // Clear sessionStorage sb-* keys (hijacked auth storage lives here)
      const ss = window.sessionStorage;
      const keys: string[] = [];
      for (let i = 0; i < ss.length; i++) {
        const k = ss.key(i);
        if (k && (k.startsWith("sb-") || k === "__lovable_impersonating")) keys.push(k);
      }
      keys.forEach((k) => ss.removeItem(k));
      // Try to close the tab; if the browser blocks (tab wasn't script-opened
      // from same context), fall back to a friendly close screen.
      window.close();
      setTimeout(() => {
        // If still open, replace with a blank end screen
        document.title = "সেশন শেষ";
        document.body.innerHTML =
          '<div style="display:flex;min-height:100dvh;align-items:center;justify-content:center;font-family:system-ui;background:#0f172a;color:#fff;text-align:center;padding:2rem"><div><h1 style="font-size:1.25rem;margin-bottom:.5rem">ইম্পার্সোনেশন শেষ</h1><p style="opacity:.7;font-size:.9rem">এই ট্যাব বন্ধ করে সুপার এডমিন ট্যাবে ফিরে যান।</p></div></div>';
      }, 150);
    } finally {
      setEnding(false);
    }
  };

  if (!active) return null;
  return (
    <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-2 text-white shadow-md">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span className="truncate font-medium">
          সুপার এডমিন হিসেবে ইম্পার্সোনেট করছেন — এই ট্যাব বন্ধ করলে বা নিচের বাটন চাপলে সেশন শেষ হবে।
        </span>
      </div>
      <button
        onClick={endImpersonation}
        disabled={ending}
        className="flex shrink-0 items-center gap-1 rounded-md bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 disabled:opacity-60"
      >
        <LogOut className="h-3 w-3" /> ইম্পার্সোনেশন বন্ধ করুন
      </button>
    </div>
  );
}
