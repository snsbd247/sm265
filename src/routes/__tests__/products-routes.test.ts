import { describe, it, expect } from "vitest";
import { routeTree } from "@/routeTree.gen";

describe("products routes", () => {
  it("registers list and detail as sibling leaf routes", () => {
    const ids = new Set<string>();
    const walk = (r: any) => {
      if (r?.id) ids.add(r.id);
      const children = (r?.children ?? []) as any[];
      children.forEach(walk);
      Object.values(r?.children ?? {}).forEach((c) => walk(c));
    };
    walk(routeTree);
    // Both routes must exist independently — prevents regressions where
    // /app/products becomes a layout without <Outlet /> and hides the detail page.
    expect(ids.has("/app/products/")).toBe(true);
    expect(ids.has("/app/products/$productId")).toBe(true);
    // The list route must NOT be a parent of the detail route.
    expect(ids.has("/app/products")).toBe(false);
  });
});