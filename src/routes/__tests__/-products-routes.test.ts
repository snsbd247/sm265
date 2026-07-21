import { describe, it, expect } from "vitest";
import { Route as ListRoute } from "@/routes/app.products.index";
import { Route as DetailRoute } from "@/routes/app.products.$productId";

describe("products routes", () => {
  it("list route module exports a Route with a component", () => {
    expect(ListRoute).toBeDefined();
    expect((ListRoute.options as any).component).toBeDefined();
  });

  it("detail route module exports a Route with parseParams + component", () => {
    expect(DetailRoute).toBeDefined();
    expect((DetailRoute.options as any).component).toBeDefined();
    expect((DetailRoute.options as any).parseParams).toBeTypeOf("function");
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