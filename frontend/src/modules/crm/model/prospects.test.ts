import { describe, it, expect } from "vitest";
import type { Lease } from "@/modules/leases";
import {
  linkableLeases,
  linkLeaseSchema,
  newProspectSchema,
  updateProspectSchema,
} from "./prospects";

describe("updateProspectSchema", () => {
  const body = { name: " Jane ", email: "", phone: "", notes: "" };
  it("keeps the contact rules but drops the space", () => {
    expect(updateProspectSchema.parse({ ...body, spaceId: "ignored" })).toEqual(
      { name: "Jane", email: "", phone: "", notes: "" },
    );
    expect(updateProspectSchema.safeParse({ ...body, name: "" }).success).toBe(
      false,
    );
    expect(
      updateProspectSchema.safeParse({ ...body, email: "nope" }).success,
    ).toBe(false);
    expect(
      updateProspectSchema.safeParse({ ...body, phone: "1".repeat(41) })
        .success,
    ).toBe(false);
  });
});

describe("newProspectSchema backend limits", () => {
  const valid = {
    spaceId: "11111111-1111-1111-1111-111111111111",
    name: "Jane",
  };
  it("enforces name 160, email 254, phone 40 and notes 2000", () => {
    const fails = (patch: object) =>
      !newProspectSchema.safeParse({ ...valid, ...patch }).success;
    expect(fails({ name: "n".repeat(161) })).toBe(true);
    expect(fails({ email: `${"a".repeat(250)}@b.co` })).toBe(true);
    expect(fails({ phone: "1".repeat(41) })).toBe(true);
    expect(fails({ notes: "n".repeat(2001) })).toBe(true);
  });
  it("asks for a space when none is chosen", () => {
    const result = newProspectSchema.safeParse({ ...valid, spaceId: "" });
    expect(!result.success && result.error.issues[0].message).toBe(
      "Select a space",
    );
  });
});

describe("linkLeaseSchema", () => {
  it("requires a lease to be chosen", () => {
    const blank = linkLeaseSchema.safeParse({ leaseId: "" });
    expect(!blank.success && blank.error.issues[0].message).toBe(
      "Select a lease",
    );
    expect(linkLeaseSchema.safeParse({ leaseId: "lease-1" }).success).toBe(
      true,
    );
  });
});

describe("linkableLeases", () => {
  const lease = (id: string, space_id: string, status: string) =>
    ({ id, space_id, status }) as Lease;
  const prospect = { id: "p1", space_id: "s1" };

  it("keeps draft or active leases for the prospect's space", () => {
    const leases = [
      lease("a", "s1", "DRAFT"),
      lease("b", "s1", "ACTIVE"),
      lease("c", "s1", "ENDED"),
      lease("d", "s1", "CANCELLED"),
      lease("e", "s2", "DRAFT"),
    ];
    expect(linkableLeases(leases, prospect, []).map((l) => l.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("drops leases already linked to another prospect but keeps this prospect's own", () => {
    const leases = [lease("a", "s1", "DRAFT"), lease("b", "s1", "DRAFT")];
    const prospects = [
      { id: "p2", lease_id: "a" },
      { id: "p1", lease_id: "b" },
    ];
    expect(
      linkableLeases(leases, prospect, prospects).map((l) => l.id),
    ).toEqual(["b"]);
  });
});

describe("newProspectSchema", () => {
  const valid = {
    spaceId: "11111111-1111-1111-1111-111111111111",
    name: "Jane Prospect",
  };
  it("accepts a prospect with only a space and name", () => {
    expect(newProspectSchema.safeParse(valid).success).toBe(true);
  });
  it("accepts a blank email but rejects a malformed one", () => {
    expect(newProspectSchema.safeParse({ ...valid, email: "" }).success).toBe(
      true,
    );
    expect(
      newProspectSchema.safeParse({ ...valid, email: "not-an-email" }).success,
    ).toBe(false);
  });
  it("rejects a blank name", () => {
    expect(newProspectSchema.safeParse({ ...valid, name: "" }).success).toBe(
      false,
    );
  });
});
