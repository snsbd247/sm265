import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const demoSchema = z.object({
  name: z.string().trim().min(2, "নাম দিন").max(100),
  phone: z.string().trim().min(6, "ফোন নম্বর দিন").max(20),
  email: z.string().trim().email("সঠিক ইমেইল দিন").max(255).optional().or(z.literal("")),
  shop_name: z.string().trim().max(150).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

function serverClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const submitDemoRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => demoSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { error } = await supabase.from("demo_requests").insert({
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      shop_name: data.shop_name || null,
      message: data.message || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPublicPackages = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = serverClient();
  const { data, error } = await supabase
    .from("packages")
    .select("id, name, description, price_monthly, price_yearly, max_products, max_users, max_sms_per_month, features, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});
