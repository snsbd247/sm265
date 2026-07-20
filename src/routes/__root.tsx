import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandingEffect } from "@/hooks/use-branding";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">পেজ পাওয়া যায়নি</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          আপনি যে পেজটি খুঁজছেন সেটি নেই বা সরিয়ে ফেলা হয়েছে।
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            হোমে ফিরে যান
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          পেজ লোড হয়নি
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            আবার চেষ্টা
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground"
          >
            হোম
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Supershop — বাংলাদেশের #১ মুদি দোকান POS ও ম্যানেজমেন্ট সফটওয়্যার" },
      {
        name: "description",
        content:
          "মুদি দোকানের জন্য সম্পূর্ণ POS, স্টক, বকেয়া, কিস্তি, কাস্টমার ও সাপ্লায়ার ম্যানেজমেন্ট। মোবাইল-ফ্রেন্ডলি, বাংলা ইন্টারফেস, বিকাশ ইন্টিগ্রেশন, ফ্রি ট্রায়াল।",
      },
      { property: "og:title", content: "Supershop — বাংলাদেশের #১ মুদি দোকান POS ও ম্যানেজমেন্ট সফটওয়্যার" },
      { property: "og:description", content: "মুদি দোকানের জন্য সম্পূর্ণ POS, স্টক, বকেয়া, কিস্তি, কাস্টমার ও সাপ্লায়ার ম্যানেজমেন্ট। মোবাইল-ফ্রেন্ডলি, বাংলা ইন্টারফেস, বিকাশ ইন্টিগ্রেশন, ফ্রি ট্রায়াল।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Supershop — বাংলাদেশের #১ মুদি দোকান POS ও ম্যানেজমেন্ট সফটওয়্যার" },
      { name: "twitter:description", content: "মুদি দোকানের জন্য সম্পূর্ণ POS, স্টক, বকেয়া, কিস্তি, কাস্টমার ও সাপ্লায়ার ম্যানেজমেন্ট। মোবাইল-ফ্রেন্ডলি, বাংলা ইন্টারফেস, বিকাশ ইন্টিগ্রেশন, ফ্রি ট্রায়াল।" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/7809589a-d452-4e03-bffc-dd37cb787845" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/7809589a-d452-4e03-bffc-dd37cb787845" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrandingEffect />
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );

}
