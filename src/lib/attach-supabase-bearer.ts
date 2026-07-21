// Project-specific replacement for the generated `attachSupabaseAuth`.
// The generated attacher calls `supabase.auth.getSession()` once per RPC.
// That fails silently (no Authorization header) on two real races:
//   1. Cold mount: the function fires before GoTrue finishes hydrating
//      the persisted session from storage → getSession() resolves with
//      { session: null } and we send no bearer → serverFn returns
//      401 "No authorization header provided".
//   2. Impersonation tab: sb-* localStorage is redirected to
//      sessionStorage, and if any RPC fires before verifyOtp completes,
//      getSession() again returns null.
//
// Fix: keep a live cached token from onAuthStateChange, and if that is
// empty, fall back to reading the persisted session JSON directly from
// storage (localStorage — the impersonate route's monkey patch redirects
// sb-* reads to sessionStorage automatically). Only then give up.
import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

let cachedToken: string | null = null;
let subscribed = false;

function ensureSubscribed() {
  if (subscribed || typeof window === "undefined") return;
  subscribed = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedToken = session?.access_token ?? null;
  });
  // Prime cache from persisted session.
  supabase.auth.getSession().then(({ data }) => {
    if (data.session?.access_token) cachedToken = data.session.access_token;
  });
}

function readTokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
      if (typeof token === "string" && token.length > 0) return token;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export const attachSupabaseBearer = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    ensureSubscribed();
    let token = cachedToken;
    if (!token) {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token ?? null;
      if (token) cachedToken = token;
    }
    if (!token) token = readTokenFromStorage();
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);