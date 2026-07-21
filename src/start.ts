import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
// Project-specific bearer attacher. Replaces the generated
// `attachSupabaseAuth` because that one relies solely on
// `supabase.auth.getSession()` which races with hydration on cold mount
// and returns null in the impersonation tab before verifyOtp resolves —
// causing serverFn calls to 401 with "No authorization header provided".
import { attachSupabaseBearer } from "@/lib/attach-supabase-bearer";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth, attachSupabaseBearer],
  requestMiddleware: [errorMiddleware],
}));
