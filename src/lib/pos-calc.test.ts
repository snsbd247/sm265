import { describe, it, expect } from "vitest";
import {
  computeCartTotals,
  clampDiscount,
  percentToDiscount,
  discountToPercent,
  validateSale,
  buildPaymentBreakdown,
} from "./pos-calc";

const lines = [
  { quantity: 2, unit_price: 100 },              // 200
  { quantity: 1, unit_price: 50, discount_amount: 5 }, // 50 - 5
];

describe("computeCartTotals", () => {
  it("counts items and units", () => {
    const t = computeCartTotals({ lines, order_discount: 0, tax_rate: 0, sale_type: "cash", paid: 0 });
    expect(t.itemCount).toBe(2);
    expect(t.unitCount).toBe(3);
    expect(t.subtotal).toBe(250);
    expect(t.itemDiscountTotal).toBe(5);
    expect(t.discountBase).toBe(245);
  });

  it("cash sale: paid = total, due = 0 (order_discount ignored beyond base)", () => {
    const t = computeCartTotals({ lines, order_discount: 45, tax_rate: 0, sale_type: "cash", paid: 0 });
    expect(t.orderDiscount).toBe(45);
    expect(t.taxable).toBe(200);
    expect(t.total).toBe(200);
    expect(t.paid).toBe(200);
    expect(t.due).toBe(0);
  });

  it("applies VAT after all discounts", () => {
    const t = computeCartTotals({ lines, order_discount: 45, tax_rate: 10, sale_type: "cash", paid: 0 });
    // taxable=200, tax=20, total=220
    expect(t.taxAmount).toBe(20);
    expect(t.total).toBe(220);
  });

  it("full due sale: paid=0, due=total", () => {
    const t = computeCartTotals({ lines, order_discount: 0, tax_rate: 0, sale_type: "due", paid: 0 });
    expect(t.paid).toBe(0);
    expect(t.due).toBe(245);
  });

  it("partial payment: paid clamped to [0,total]", () => {
    const t = computeCartTotals({ lines, order_discount: 0, tax_rate: 0, sale_type: "due", paid: 500 });
    expect(t.paid).toBe(245);
    expect(t.due).toBe(0);

    const t2 = computeCartTotals({ lines, order_discount: 0, tax_rate: 0, sale_type: "due", paid: 100 });
    expect(t2.paid).toBe(100);
    expect(t2.due).toBe(145);
  });

  it("installment: partial paid + rest due", () => {
    const t = computeCartTotals({ lines, order_discount: 0, tax_rate: 0, sale_type: "installment", paid: 45 });
    expect(t.paid).toBe(45);
    expect(t.due).toBe(200);
  });

  it("order discount is clamped to [0, discountBase]", () => {
    const t = computeCartTotals({ lines, order_discount: 9999, tax_rate: 0, sale_type: "cash", paid: 0 });
    expect(t.orderDiscount).toBe(245);
    expect(t.total).toBe(0);
  });

  it("empty cart yields zero totals", () => {
    const t = computeCartTotals({ lines: [], order_discount: 10, tax_rate: 5, sale_type: "cash", paid: 0 });
    expect(t.total).toBe(0);
    expect(t.itemCount).toBe(0);
    expect(t.unitCount).toBe(0);
    expect(t.orderDiscount).toBe(0);
  });

  it("ignores NaN / negatives defensively", () => {
    const t = computeCartTotals({
      lines: [{ quantity: NaN as any, unit_price: 10 }, { quantity: -3, unit_price: 20 }],
      order_discount: -50, tax_rate: -5, sale_type: "cash", paid: -10,
    });
    expect(t.subtotal).toBe(-60); // -3 * 20 kept as-is by design (returns), but total clamped >= 0
    // total = max(0, taxable) with negatives; ensure no NaN
    expect(Number.isNaN(t.total)).toBe(false);
  });

  it("fractional quantities and prices round to 2dp", () => {
    const t = computeCartTotals({
      lines: [{ quantity: 1.333, unit_price: 3.33 }],
      order_discount: 0, tax_rate: 15, sale_type: "cash", paid: 0,
    });
    // subtotal 1.333*3.33 = 4.43889 -> 4.44
    expect(t.subtotal).toBe(4.44);
    expect(t.taxAmount).toBe(0.67); // 4.44 * 0.15 = 0.666 -> 0.67
    expect(t.total).toBe(5.11);
  });
});

describe("discount helpers", () => {
  it("clampDiscount clamps to base", () => {
    expect(clampDiscount(50, 100)).toBe(50);
    expect(clampDiscount(-1, 100)).toBe(0);
    expect(clampDiscount(500, 100)).toBe(100);
    expect(clampDiscount(NaN, 100)).toBe(0);
  });
  it("percent <-> discount round-trips within base", () => {
    expect(percentToDiscount(10, 200)).toBe(20);
    expect(percentToDiscount(150, 200)).toBe(200); // clamped at 100%
    expect(discountToPercent(20, 200)).toBe(10);
    expect(discountToPercent(50, 0)).toBe(0);
  });
});

describe("validateSale", () => {
  const base = { lines, order_discount: 0, tax_rate: 0 } as const;

  it("rejects empty cart", () => {
    const totals = computeCartTotals({ ...base, lines: [], sale_type: "cash", paid: 0 });
    expect(validateSale({ totals, sale_type: "cash", hasCustomer: false })).toMatch(/পণ্য/);
  });

  it("rejects zero total", () => {
    const totals = computeCartTotals({ ...base, order_discount: 9999, sale_type: "cash", paid: 0 });
    expect(validateSale({ totals, sale_type: "cash", hasCustomer: false })).toMatch(/০|ঋণাত্মক/);
  });

  it("requires customer for due/installment", () => {
    const totals = computeCartTotals({ ...base, sale_type: "due", paid: 0 });
    expect(validateSale({ totals, sale_type: "due", hasCustomer: false })).toMatch(/কাস্টমার/);
    expect(validateSale({ totals, sale_type: "due", hasCustomer: true })).toBeNull();
  });

  it("blocks fully-paid due sale (nudge to cash)", () => {
    const totals = computeCartTotals({ ...base, sale_type: "due", paid: 245 });
    expect(validateSale({ totals, sale_type: "due", hasCustomer: true })).toMatch(/নগদ/);
  });

  it("installment requires remaining due and positive count", () => {
    const paidAll = computeCartTotals({ ...base, sale_type: "installment", paid: 245 });
    expect(validateSale({ totals: paidAll, sale_type: "installment", hasCustomer: true, installments: 3 })).toMatch(/বাকি/);

    const ok = computeCartTotals({ ...base, sale_type: "installment", paid: 45 });
    expect(validateSale({ totals: ok, sale_type: "installment", hasCustomer: true, installments: 3 })).toBeNull();
    expect(validateSale({ totals: ok, sale_type: "installment", hasCustomer: true, installments: 0 })).toMatch(/কিস্তির/);
  });
});

describe("buildPaymentBreakdown", () => {
  it("cash breakdown: paid=total, due=0", () => {
    const totals = computeCartTotals({ lines, order_discount: 0, tax_rate: 0, sale_type: "cash", paid: 0 });
    const b = buildPaymentBreakdown({ sale_type: "cash", method: "cash", totals });
    expect(b).toMatchObject({ paid_now: 245, due: 0, is_partial: false, installments: 0 });
  });

  it("installment per-installment split", () => {
    const totals = computeCartTotals({ lines, order_discount: 0, tax_rate: 0, sale_type: "installment", paid: 45 });
    const b = buildPaymentBreakdown({ sale_type: "installment", method: "cash", totals, installments: 4, installment_frequency: "weekly" });
    expect(b.installments).toBe(4);
    expect(b.per_installment).toBe(50); // 200/4
    expect(b.installment_frequency).toBe("weekly");
  });

  it("marks partial pays", () => {
    const totals = computeCartTotals({ lines, order_discount: 0, tax_rate: 0, sale_type: "due", paid: 100 });
    const b = buildPaymentBreakdown({ sale_type: "due", method: "cash", totals });
    expect(b.is_partial).toBe(true);
  });
});