import { describe, it, expect } from "vitest";
import { Route as ListRoute } from "@/routes/app.products.index";
import { Route as DetailRoute } from "@/routes/app.products.$productId";

describe("products routes", () => {
  it("list route is declared at /app/products/", () => {
    expect((ListRoute.options as any).path).toBe("/app/products/");
  });

  it("detail route is a sibling declared at /app/products/$productId", () => {
    expect((DetailRoute.options as any).path).toBe("/app/products/$productId");
  });

  it("detail route parses a valid uuid productId", () => {
    const parsed = (DetailRoute.options as any).parseParams({
      productId: "96718212-c25e-4163-9943-85701a876999",
    });
    expect(parsed.productId).toBe("96718212-c25e-4163-9943-85701a876999");
  });

  it("detail route rejects a non-uuid productId", () => {
    expect(() =>
      (DetailRoute.options as any).parseParams({ productId: "not-a-uuid" }),
    ).toThrow();
  });
});