import { describe, it, expect } from "vitest";
import { Route as ListRoute } from "@/routes/app.products.index";
import { Route as DetailRoute } from "@/routes/app.products.$productId";

describe("products routes", () => {
  it("list is registered at /app/products/ (index leaf)", () => {
    expect(ListRoute.id).toBe("/app/products/");
    expect(ListRoute.path).toBe("/");
  });

  it("detail is a sibling leaf at /app/products/$productId", () => {
    expect(DetailRoute.id).toBe("/app/products/$productId");
    expect(DetailRoute.path).toBe("$productId");
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