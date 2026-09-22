import { api } from "@/shared/api/client";
export interface Assignment {
  id: string;
  space_id: string;
  starts_on: string;
}
export interface Resident {
  id: string;
  account_id: string;
  display_name: string;
  phone: string | null;
  active: boolean;
  assignments: Assignment[];
  assignment_id: string | null;
  space_id: string | null;
  starts_on: string | null;
}
const base = (org: string, building: string) =>
  `/organizations/${org}/buildings/${building}`;
export const occupancyApi = {
  residents: (org: string, building: string) =>
    api<Resident[]>(`${base(org, building)}/residents`),
  createResident: (
    org: string,
    building: string,
    body: { accountId: string; displayName: string; phone: string },
  ) => api(`${base(org, building)}/residents`, "POST", body),
  updateResident: (
    org: string,
    building: string,
    resident: string,
    body: { displayName: string; phone: string; active: boolean },
  ) => api(`${base(org, building)}/residents/${resident}`, "PATCH", body),
  assign: (
    org: string,
    building: string,
    body: { residentId: string; spaceId: string; startsOn: string },
  ) => api(`${base(org, building)}/space-assignments`, "POST", body),
  end: (org: string, building: string, assignment: string, endsOn: string) =>
    api(`${base(org, building)}/space-assignments/${assignment}/end`, "POST", {
      endsOn,
    }),
};
