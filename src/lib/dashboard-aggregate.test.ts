import { describe, it, expect } from "vitest";
import {
  sumBy, sumPositive, cashFor, stockValues,
  monthProfitFromItems, topProductsFromItems, dailyTrendMap,
} from "./dashboard-aggregate";

describe("dashboard-aggregate", () => {
  it("sumBy respects filter and coerces strings", () => {
    const rows = [{ v: "10" }, { v: 20 }, { v: null }, { v: "-5" }];
    expect(sumBy(rows, (r) => Number(r.v))).toBe(25);
    expect(sumBy(rows, (r) => Number(r.v), (r) => Number(r.v) > 0)).toBe(30);
  });

  it("sumPositive drops negative customer balances", () => {
    const custs = [{ b: 300 }, { b: -50 }, { b: 200 }, { b: 0 }];
    expect(sumPositive(custs, (c) => c.b)).toBe(500);
  });

  it("cashFor filters by date + method", () => {
    const payments = [
      { amount: 100, payment_method: "cash", payment_date: "2026-07-21" },
      { amount: 200, payment_method: "bkash", payment_date: "2026-07-21" },
      { amount: 50, payment_method: "cash", payment_date: "2026-07-20" },
    ];
    expect(cashFor(payments, { date: "2026-07-21", method: "cash" })).toBe(100);
    expect(cashFor(payments, { date: "2026-07-21", method: "bkash" })).toBe(200);
    expect(cashFor(payments, { date: "2026-07-19", method: "cash" })).toBe(0);
  });

  it("stockValues computes cost/retail/low correctly", () => {
    const products = [
      { stock_quantity: 10, purchase_price: 5, sale_price: 8, low_stock_alert: 20 }, // low
      { stock_quantity: 4, purchase_price: 2, sale_price: 3, low_stock_alert: 2 },
      { stock_quantity: 0, purchase_price: 1, sale_price: 2, low_stock_alert: 1 }, // low
    ];
    const s = stockValues(products);
    expect(s.cost).toBe(58);
    expect(s.retail).toBe(92);
    expect(s.productsCount).toBe(3);
    expect(s.lowStockCount).toBe(2);
  });

  it("monthProfit and topProducts derive from sale_items", () => {
    const items = [
      { product_id: "a", quantity: 2, unit_cost: 5, line_total: 20, product: { name: "A" } },
      { product_id: "b", quantity: 1, unit_cost: 3, line_total: 6, product: { name: "B" } },
      { product_id: "a", quantity: 3, unit_cost: 5, line_total: 30, product: { name: "A" } },
    ];
    const p = monthProfitFromItems(items);
    expect(p.revenue).toBe(56);
    expect(p.cost).toBe(28); // 2*5 + 1*3 + 3*5
    expect(p.profit).toBe(28);

    const top = topProductsFromItems(items, 5);
    expect(top[0].name).toBe("A");
    expect(top[0].qty).toBe(5);
    expect(top[0].revenue).toBe(50);
    expect(top[1].name).toBe("B");
  });

  it("dailyTrendMap fills gaps with 0 and sums duplicates", () => {
    const days = ["2026-07-19", "2026-07-20", "2026-07-21"];
    const rows = [
      { date: "2026-07-19", total: 100 },
      { date: "2026-07-21", total: 50 },
      { date: "2026-07-21", total: "25" },
      { date: "2026-07-01", total: 999 }, // out of range dropped
    ];
    expect(dailyTrendMap(days, rows)).toEqual([
      { date: "2026-07-19", total: 100 },
      { date: "2026-07-20", total: 0 },
      { date: "2026-07-21", total: 75 },
    ]);
  });

  it("handles null/undefined arrays without throwing", () => {
    expect(sumBy(null, (r: any) => r.v)).toBe(0);
    expect(sumPositive(undefined, (r: any) => r.v)).toBe(0);
    expect(topProductsFromItems(null)).toEqual([]);
    expect(dailyTrendMap(["2026-07-21"], null)).toEqual([{ date: "2026-07-21", total: 0 }]);
  });
});