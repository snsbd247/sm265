
## Overview

`https://github.com/snsbd247/tallybd` একটি complete Lovable project backup — TanStack Start + React 19 + Supabase + shadcn/ui stack (এই project-এর সাথে exact match)। এটি একটি **Tally-style inventory / sales / POS app** for Bangladesh, features সহ: products, categories, units, stock, customers, suppliers, purchases, sales, installments, reports, admin panel, shop management, subscriptions, bKash payment integration, SMS notifications, user impersonation।

Total ~130 files, 8 Supabase migrations।

## Import plan

### 1. Lovable Cloud enable
Repo-তে `src/integrations/supabase/*` এবং `supabase/migrations/` আছে। তাই Lovable Cloud enable করে backend provision করতে হবে (database + auth + storage + edge)।

### 2. File import (GitHub raw fetch → project files)
নিচের সব directory-এর file গুলো GitHub থেকে fetch করে current project-এ লেখা হবে (existing template file overwrite হবে):

- **Root config**: `package.json`, `bun.lock`, `bunfig.toml`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `components.json`, `.prettierrc`, `.prettierignore`, `.gitignore`, `AGENTS.md`
- **Public assets**: `public/favicon.ico`
- **App shell**: `src/router.tsx`, `src/server.ts`, `src/start.ts`, `src/styles.css`
- **Routes** (30+): landing (`index.tsx`, `login.tsx`, `renew.tsx`, `impersonate.tsx`), `app.*` (dashboard, products, categories, units, stock, customers, suppliers, purchases, sales, installments, reports, subscription), `admin.*` (dashboard, shops, admins, packages, subscriptions, settings, sms-logs, impersonation-logs, receipts, invoices, setup, login), `__root.tsx`
- **API public routes**: `api/public/bkash/callback.ts`, `api/public/cron/expiry-check.ts`
- **Components**: full `src/components/ui/*` (shadcn), `admin-shell`, `impersonation-banner`, `receipt-preview`, `searchable-select`, `landing/pricing-section`
- **Hooks**: `use-auth`, `use-branding`, `use-mobile`
- **Server / lib functions**: `admin`, `auth`, `impersonation`, `inventory`, `landing`, `notifications`, `purchases`, `reports`, `sales`, `shop` (`.functions.ts`); `bkash`, `sms`, `subscription` (`.server.ts`); utilities (`export-utils`, `receipt-config`, `impersonation-window`, `error-*`)
- **Supabase integration**: `client.ts`, `client.server.ts`, `auth-attacher.ts`, `auth-middleware.ts`, `types.ts`
- **Supabase migrations**: all 8 `.sql` files under `supabase/migrations/` + `supabase/config.toml`

`src/routeTree.gen.ts` skip — Vite plugin এটি auto-regenerate করবে।
`.env` skip — secrets manually add হবে।
`.lovable/plan.md`, `.lovable/project.json` skip — এই project-এর নিজস্ব থাকবে।

### 3. Dependency install
Import করা `package.json` অনুযায়ী missing packages install করতে হবে: `@supabase/supabase-js`, `jspdf`, `jspdf-autotable`, `xlsx`, plus আরো কিছু Radix UI packages যা এই template-এ নেই।

### 4. Migrations apply
Lovable Cloud enable হওয়ার পর 8টি migration ঠিক timestamp order-এ apply হবে — schema + RLS policies + grants + seed data সব সেট হবে।

### 5. External secrets (আপনাকে দিতে হবে)
Repo bKash payment এবং SMS gateway ব্যবহার করে। এগুলো live করতে চাইলে পরবর্তীতে এই secrets add করতে হবে (এখন app basic-ভাবে চলবে, শুধু ওই feature কাজ করবে না যতক্ষণ না keys আসে):
- **bKash**: `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_BASE_URL` (sandbox/live)
- **SMS gateway**: provider-specific keys (`bkash.server.ts` / `sms.server.ts` read করার পর exact নাম confirm হবে)

## After import — verification

1. Build pass করবে (typecheck + Vite build)
2. Home route (`/`) landing page render করবে
3. `/login` কাজ করবে (Supabase auth)
4. `/app` gated route redirect করবে unauthenticated হলে
5. Migrations সব apply হয়েছে — Cloud tab-এ tables দেখা যাবে

## Notes / limitations

- এটি project-এ existing template files overwrite করবে (এই project এখনো blank, তাই কিছু হারানোর নেই)।
- Real bKash + SMS testing-এর জন্য আপনার sandbox/production credentials লাগবে।
- Repo-এর existing database data (rows) migrate হবে না — শুধু schema। যদি production data দরকার হয়, source project থেকে আলাদাভাবে export/import করতে হবে।

Approve করলে build mode-এ গিয়ে ধাপে ধাপে সব file import + Cloud enable + migrations apply করব।
