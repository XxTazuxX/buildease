import { describe, it, expect } from "vitest";
import { isTenantOnly } from "./App";

describe("isTenantOnly", () => {
  it("is false for a platform admin, regardless of building roles", () => {
    expect(
      isTenantOnly(true, {
        owner: false,
        roles: [{ role: "TENANT", building_id: "b1" } as never],
      }),
    ).toBe(false);
  });

  it("is false for an organization owner", () => {
    expect(isTenantOnly(false, { owner: true, roles: [] })).toBe(false);
  });

  it("is false when access data hasn't loaded yet", () => {
    expect(isTenantOnly(false, undefined)).toBe(false);
  });

  it("is false when the user has no building roles at all", () => {
    expect(isTenantOnly(false, { owner: false, roles: [] })).toBe(false);
  });

  it("is true when the user's only role anywhere is TENANT", () => {
    expect(
      isTenantOnly(false, {
        owner: false,
        roles: [{ role: "TENANT", building_id: "b1" } as never],
      }),
    ).toBe(true);
  });

  it("is false for each elevated/vendor role on its own", () => {
    for (const role of [
      "PROPERTY_MANAGER",
      "ACCOUNTANT",
      "MAINTENANCE_STAFF",
      "SECURITY_OPERATIONS_STAFF",
      "VENDOR",
    ]) {
      expect(
        isTenantOnly(false, {
          owner: false,
          roles: [{ role, building_id: "b1" } as never],
        }),
      ).toBe(false);
    }
  });

  it("is false when TENANT is mixed with any elevated role, even in a different building", () => {
    expect(
      isTenantOnly(false, {
        owner: false,
        roles: [
          { role: "TENANT", building_id: "b1" } as never,
          { role: "MAINTENANCE_STAFF", building_id: "b2" } as never,
        ],
      }),
    ).toBe(false);
  });
});
