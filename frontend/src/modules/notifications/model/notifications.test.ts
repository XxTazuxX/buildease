import { describe, expect, it } from "vitest";
import { notificationRoute, type AppNotification } from "./notifications";

const base: AppNotification = {
  id: "n1",
  organization_id: "org",
  building_id: "b1",
  type: "WORK_ASSIGNED",
  title: "Maintenance work assigned",
  target_path: "/maintenance/req-1",
  read_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

describe("notificationRoute", () => {
  it("opens maintenance and lease notices on the operations tabs", () => {
    expect(notificationRoute(base)).toBe(
      "/organizations/org/operations?tab=maintenance&building=b1",
    );
    expect(notificationRoute({ ...base, target_path: "/leases/l1" })).toBe(
      "/organizations/org/operations?tab=finance&building=b1",
    );
  });

  it("routes announcements, billing and unknown targets sensibly", () => {
    expect(
      notificationRoute({ ...base, target_path: "/announcements/a1" }),
    ).toBe("/organizations/org/people?tab=announcements&building=b1");
    expect(
      notificationRoute({
        ...base,
        building_id: null,
        target_path: "/billing",
      }),
    ).toBe("/organizations/org/billing");
    expect(
      notificationRoute({ ...base, building_id: null, target_path: "/other" }),
    ).toBe("/organizations/org/overview");
  });
});
