# বিক্রয় ইনভয়েস ডিটেইল পেজ — প্ল্যান

## ১. লিস্ট পেজ (`/app/sales`) আপডেট
- পুরো row ক্লিকযোগ্য করা (এখন কেবল "রিসিট" বাটন) → ক্লিকে সরাসরি ডিটেইল পেজে যাবে
- Action কলামে dropdown menu: দেখুন / প্রিন্ট / PDF / লিঙ্ক কপি / SMS / ইমেইল / ক্যান্সেল
- Status badge (Active / Cancelled / Returned / Partial Return) কলাম যোগ

## ২. ইনভয়েস ডিটেইল পেজ (`/app/sales/$saleId`) নতুন ডিজাইন
বর্তমান পেজটি পুরোনো thermal-receipt style — এটাকে full-page invoice ডিটেইল ভিউ বানানো হবে।

### লেআউট
```
┌─ Header bar ──────────────────────────────────────────────┐
│ ← ফিরে   Inv# INV-2026-000123  [Status badge]             │
│                  [Actions dropdown ▼] [Edit] [Print] [PDF]│
└───────────────────────────────────────────────────────────┘
┌─ Left (2/3) ─────────────────────┬─ Right sidebar (1/3) ──┐
│ Original invoice preview (same    │ Quick info card:       │
│ template as public link /i/):     │  • কাস্টমার + link     │
│  • Shop header, logo              │  • Total / Paid / Due  │
│  • Customer info                  │  • Payment breakdown   │
│  • Items table                    │  • Installment list    │
│  • Totals + payment breakdown     │                        │
│  • QR code (public link)          │ Tabs:                  │
│                                   │  [Delivery] [Revisions]│
│                                   │  [Activity log]        │
└───────────────────────────────────┴────────────────────────┘
```

### Actions toolbar (উপরে)
- **Edit** — বিদ্যমান edit flow (rollback + re-open in POS) কল করবে; cancelled/returned হলে disable
- **Cancel** — existing dialog, শিফট চেক সহ
- **Return** — existing dialog
- **Print** — `window.print()`, original template
- **PDF ডাউনলোড** — `sales.new.tsx`-এ থাকা html2canvas + jsPDF logic reuse (shared helper-এ move)
- **Share dropdown**:
  - লিঙ্ক কপি (public `/i/$token`)
  - SMS পাঠান (existing `sendInvoiceSms`)
  - ইমেইল পাঠান (existing invoice email server fn — টেমপ্লেট থেকে)
  - WhatsApp share (`wa.me/?text=...link...`)
- Copy invoice number, Duplicate as new sale (draft) — অপশনাল

### ডান পাশে Tabs
1. **Delivery History** — SMS/Email logs (existing `SaleDeliveryHistory` component), resend button প্রতিটা row থেকে
2. **Edit History** — existing `SaleRevisionsList`, প্রতিটা version-এ "দেখুন" (modal) ও "PDF" বাটন
3. **Activity log** — created / edited / cancelled / returned / payment received timeline (audit_logs থেকে)

## ৩. সাজেশন (এড করা ভালো)
1. **Payment history section** — এই ইনভয়েসের against যত customer_payments হয়েছে (তারিখ, method, amount) + এখান থেকে "আরো পেমেন্ট রিসিভ" বাটন (due > 0 হলে)
2. **Installment schedule table** — প্রতিটা কিস্তিতে "পরিশোধ" বাটন
3. **QR code visible on-screen** — শুধু PDF-এ না, স্ক্রিনেও যাতে কাস্টমার সরাসরি স্ক্যান করতে পারে
4. **WhatsApp share** — বাংলাদেশে সবচেয়ে বেশি ব্যবহৃত
5. **"Duplicate as new sale"** — একই কাস্টমার/আইটেম দিয়ে নতুন invoice draft
6. **Keyboard shortcut**: `P` = print, `E` = edit, `S` = share
7. **Print-friendly** — শুধু invoice body প্রিন্ট হবে, sidebar/tabs হাইড

## ৪. Technical notes
- `InvoicePreview` component `app.sales.new.tsx` থেকে `src/components/invoice-preview.tsx`-এ extract করে detail page + success dialog + public link — তিন জায়গাতেই reuse
- PDF ও public-link generator একই `src/lib/invoice-share.ts` helper-এ move
- নতুন কোনো DB migration লাগবে না — সব data (deliveries, revisions, payments) আগে থেকেই আছে
- Activity timeline `audit_logs` table থেকে (existing) filter করে দেখাবো

## Files affected
- `src/routes/app.sales.$saleId.tsx` — সম্পূর্ণ redesign
- `src/routes/app.sales.index.tsx` — row click + actions dropdown
- `src/components/invoice-preview.tsx` — নতুন shared component
- `src/lib/invoice-share.ts` — PDF/link/share helpers
- `src/components/invoice-actions-menu.tsx` — নতুন dropdown component

এপ্রুভ করলে কাজ শুরু করব।
