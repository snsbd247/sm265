// Pure POS calculation helpers — no React / DOM imports so we can unit test them.

export type SaleType = "cash" | "due" | "installment";

export type CalcLine = {
  quantity: number;
  unit_price: number;
  discount_amount?: number; // per-line ৳ discount
};

export type CalcInput = {
  lines: CalcLine[];
  order_discount: number; // extra ৳ discount at order level
  tax_rate: number;       // % applied after discounts
  sale_type: SaleType;
  paid: number;           // ignored for cash (auto = total)
};

export type CalcTotals = {
  itemCount: number;
  unitCount: number;
  subtotal: number;
  itemDiscountTotal: number;
  discountBase: number;   // subtotal - itemDiscountTotal
  orderDiscount: number;  // clamped [0, discountBase]
  taxable: number;
  taxAmount: number;
  total: number;
  paid: number;
  due: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Clamp an order-level ৳ discount to [0, discountBase]. */
export function clampDiscount(value: number, discountBase: number): number {
  const v = Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(discountBase, v));
}

/** Convert a % discount (0-100) into a ৳ amount clamped to [0, discountBase]. */
export function percentToDiscount(pct: number, discountBase: number): number {
  const p = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return r2(discountBase * p / 100);
}

/** Compute the effective % discount given a ৳ amount and base. */
export function discountToPercent(amount: number, discountBase: number): number {
  if (discountBase <= 0) return 0;
  return r2((amount / discountBase) * 100);
}

/** Single source of truth for POS totals. Same logic runs in cart panel + checkout modal + tests. */
export function computeCartTotals(input: CalcInput): CalcTotals {
  const lines = input.lines ?? [];
  const subtotal = r2(lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0));
  const itemDiscountTotal = r2(lines.reduce((s, l) => s + (Number(l.discount_amount) || 0), 0));
  const discountBase = Math.max(0, r2(subtotal - itemDiscountTotal));
  const orderDiscount = clampDiscount(Number(input.order_discount) || 0, discountBase);
  const taxable = Math.max(0, r2(discountBase - orderDiscount));
  const taxRate = Math.max(0, Number(input.tax_rate) || 0);
  const taxAmount = r2(taxable * taxRate / 100);
  const total = Math.max(0, r2(taxable + taxAmount));
  const rawPaid = Number(input.paid) || 0;
  const paid = input.sale_type === "cash" ? total : Math.max(0, Math.min(total, rawPaid));
  const due = Math.max(0, r2(total - paid));
  const itemCount = lines.length;
  const unitCount = r2(lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0));
  return {
    itemCount, unitCount, subtotal, itemDiscountTotal, discountBase,
    orderDiscount, taxable, taxAmount, total, paid, due,
  };
}

export type ValidationCtx = {
  totals: CalcTotals;
  sale_type: SaleType;
  installments?: number;
  hasCustomer: boolean;
};

/** Returns null when the sale is submittable, otherwise a Bengali error message. */
export function validateSale(ctx: ValidationCtx): string | null {
  const { totals, sale_type, installments, hasCustomer } = ctx;
  if (totals.itemCount === 0) return "কমপক্ষে একটি পণ্য যোগ করুন";
  if (totals.total <= 0) return "মোট প্রদেয় ০ বা ঋণাত্মক — ছাড় ঠিক করুন";
  if (sale_type !== "cash" && !hasCustomer) return "বাকি/কিস্তি বিক্রির জন্য কাস্টমার বাছাই করুন";
  if (sale_type === "due" && totals.paid >= totals.total)
    return "সম্পূর্ণ পরিশোধ হলে 'নগদ বিক্রি' বাছাই করুন";
  if (sale_type === "installment") {
    if (totals.paid >= totals.total) return "কিস্তি বিক্রয়ে বাকি টাকা লাগবে";
    if (!installments || installments < 1) return "কিস্তির সংখ্যা কমপক্ষে ১ দিন";
  }
  return null;
}

/** Build a payment breakdown snapshot for the invoice preview + audit log. */
export function buildPaymentBreakdown(args: {
  sale_type: SaleType;
  method: string;
  totals: CalcTotals;
  installments?: number;
  installment_frequency?: "weekly" | "monthly";
}) {
  const { sale_type, method, totals, installments, installment_frequency } = args;
  const perInstallment = sale_type === "installment" && installments && installments > 0
    ? r2(totals.due / installments)
    : 0;
  return {
    sale_type,
    method,
    total: totals.total,
    paid_now: totals.paid,
    due: totals.due,
    installments: sale_type === "installment" ? (installments ?? 0) : 0,
    installment_frequency: sale_type === "installment" ? (installment_frequency ?? "monthly") : null,
    per_installment: perInstallment,
    is_partial: sale_type !== "cash" && totals.paid > 0 && totals.paid < totals.total,
  };
}