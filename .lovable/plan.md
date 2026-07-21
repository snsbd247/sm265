# POS Enhancement Plan

চারটি বড় ফিচার — ধাপে ধাপে বিল্ড করব।

## 1. আইটেম/অর্ডার ডিসকাউন্ট + VAT/ট্যাক্স

**DB (migration):**
- `sale_items`: `discount_amount NUMERIC DEFAULT 0`, `tax_rate NUMERIC DEFAULT 0`, `tax_amount NUMERIC DEFAULT 0` যোগ।
- `sales`: `tax_amount NUMERIC DEFAULT 0`, `discount_type TEXT DEFAULT 'flat'` (flat/percent) যোগ।
- `shops`: `default_tax_rate NUMERIC DEFAULT 0`, `tax_inclusive BOOLEAN DEFAULT false` যোগ।
- `create_sale` RPC আপডেট — per-item discount ও tax গণনা, subtotal/total এ রিফ্লেক্ট।

**UI:**
- POS কার্ট আইটেমে ছোট "%" আইকন → per-item discount input popover।
- চেকআউট ডায়ালগে: অর্ডার ডিসকাউন্ট (flat/percent টগল), VAT % ইনপুট (শপ ডিফল্ট প্রি-ফিলড), লাইভ ব্রেকডাউন (Subtotal, Item Disc, Order Disc, Tax, Total)।
- Receipt এ ডিসকাউন্ট/ট্যাক্স লাইন।

## 2. অর্ডার ক্যান্সেল/রিটার্ন

**DB:**
- `sales.status TEXT DEFAULT 'completed'` (completed/cancelled/returned/partial_return)।
- নতুন টেবিল `sale_returns` (id, shop_id, sale_id, return_date, reason, refund_amount, refund_method, created_by)।
- `sale_return_items` (id, return_id, sale_item_id, product_id, quantity, unit_price, line_total)।
- RPC `cancel_sale(_sale_id)` — completed → cancelled, stock restore, customer balance reverse, payment reverse।
- RPC `create_sale_return(_sale_id, _items, _refund_amount, _refund_method, _reason)` — partial/full return, stock_movement 'return_in', customer refund/credit।

**UI:**
- `/app/sales/$saleId`: "ক্যান্সেল" ও "রিটার্ন" বাটন (status অনুযায়ী disabled)।
- Return dialog: প্রতি আইটেমে রিটার্ন quantity ইনপুট + refund method।
- সেলস লিস্টে status badge।
- Success এ products + notifications invalidate → লো-স্টক ব্যাজ auto-refresh।

## 3. শিফট (ক্যাশ ড্রয়ার)

**DB:**
- `pos_shifts` (id, shop_id, opened_by, opened_at, closed_at, opening_cash, closing_cash_expected, closing_cash_actual, cash_sales_total, card_sales_total, bkash_sales_total, other_sales_total, total_sales, note, status)।
- `sales.shift_id UUID NULLABLE` — বিক্রয়ের সাথে অ্যাসাইন।
- RPC `open_shift(_opening_cash, _note)` — একটাই open shift/user।
- RPC `close_shift(_shift_id, _closing_cash_actual, _note)` — সব সেল অ্যাগ্রিগেট।

**UI:**
- নতুন রুট `/app/shifts` — শিফট লিস্ট + ওপেন/ক্লোজ বাটন।
- POS পেজ: শিফট open না থাকলে "শিফট শুরু করুন" মোডাল (opening cash), সেল ব্লক।
- শিফট ক্লোজ মোডাল: expected vs actual cash, variance, সামারি।
- সাইডবার Sales গ্রুপে "শিফট" মেনু।

## 4. কাস্টমার লেজার পেজ

**Backend:** `getCustomerLedger` (আছে) — লেজার এন্ট্রি + বকেয়া সামারি।

**UI:**
- নতুন রুট `/app/customers/$customerId` — 
  - হেডার: নাম, ফোন, মোট বকেয়া, লাইফটাইম বিক্রয়।
  - ট্যাব: লেজার (debit/credit/balance টেবিল), সেলস হিস্টরি, ইনস্টলমেন্ট, পেমেন্টস।
  - "পেমেন্ট গ্রহণ" বাটন → existing receiveCustomerPayment ডায়ালগ।
  - CSV এক্সপোর্ট, প্রিন্ট।
- `app.customers.tsx` লিস্টে প্রতি রো ক্লিকে লেজারে যাবে।
- POS এ কাস্টমার সিলেক্ট করলে "লেজার দেখুন" লিংক।

## ধাপক্রম (এই টার্নে সব বিল্ড)

1. Migration — সব DB পরিবর্তন এক ব্যাচে।
2. Server functions — shifts, returns, ledger helpers।
3. UI — POS আপডেট, নতুন রুট, নেভিগেশন।
4. QA — বিল্ড ও কী flows verify।

## Technical Notes

- Idempotency: cancel/return RPC গুলোতে status check।
- Shift enforcement: server-side check `create_sale`-এ open shift না থাকলে reject।
- Tax formula: `line = qty * price - item_disc; tax = line * rate/100; total = Σline + Σtax - order_disc`।
- Backward compat: existing sales এ status default 'completed', shift_id NULL allowed।

শুরু করব?
