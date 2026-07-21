// Central catalog of feature modules. A package's `allowed_modules` array
// controls which of these the shop can access. `null` = all allowed.
export type ModuleKey =
  | "dashboard"
  | "products"
  | "categories"
  | "units"
  | "stock"
  | "suppliers"
  | "purchases"
  | "customers"
  | "sales"
  | "installments"
  | "shifts"
  | "reports"
  | "subscription"
  | "usage"
  | "invoice_template"
  | "change_password";

export interface ModuleDef {
  key: ModuleKey;
  label: string;   // Bengali
  group: string;   // Bengali group label
}

export const MODULES: ModuleDef[] = [
  { key: "dashboard",        label: "ড্যাশবোর্ড",           group: "ওভারভিউ" },
  { key: "products",         label: "পণ্য",                  group: "ইনভেন্টরি" },
  { key: "categories",       label: "ক্যাটাগরি",            group: "ইনভেন্টরি" },
  { key: "units",            label: "একক",                   group: "ইনভেন্টরি" },
  { key: "stock",            label: "স্টক",                  group: "ইনভেন্টরি" },
  { key: "suppliers",        label: "সাপ্লায়ার",           group: "ক্রয়" },
  { key: "purchases",        label: "ক্রয় অর্ডার",         group: "ক্রয়" },
  { key: "customers",        label: "কাস্টমার",             group: "বিক্রয়" },
  { key: "sales",            label: "বিক্রয় (POS)",         group: "বিক্রয়" },
  { key: "installments",     label: "কিস্তি",                group: "বিক্রয়" },
  { key: "shifts",           label: "শিফট",                  group: "বিক্রয়" },
  { key: "reports",          label: "রিপোর্ট",              group: "ইনসাইটস" },
  { key: "subscription",     label: "সাবস্ক্রিপশন",         group: "একাউন্ট" },
  { key: "usage",            label: "ব্যবহার রিপোর্ট",     group: "একাউন্ট" },
  { key: "invoice_template", label: "ইনভয়েস টেমপ্লেট",   group: "একাউন্ট" },
  { key: "change_password",  label: "পাসওয়ার্ড পরিবর্তন", group: "একাউন্ট" },
];

export const ALL_MODULE_KEYS: ModuleKey[] = MODULES.map((m) => m.key);

// Always-on modules: users can't be locked out of these regardless of package.
export const ALWAYS_ON: ModuleKey[] = ["dashboard", "subscription", "change_password"];

export function isModuleAllowed(
  allowed: string[] | null | undefined,
  key: ModuleKey,
): boolean {
  if (ALWAYS_ON.includes(key)) return true;
  if (!allowed) return true; // null = all
  return allowed.includes(key);
}