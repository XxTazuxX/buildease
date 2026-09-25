import { api } from "@/shared/api/client";

export const screeningStatuses = ["PENDING", "PASS", "FAIL", "REVIEW"] as const;
export type ScreeningStatus = (typeof screeningStatuses)[number];

export interface Screening {
  id: string;
  status: ScreeningStatus;
  report: string | null;
  provider_reference: string | null;
  requested_at: string;
  completed_at: string | null;
}

const base = (org: string, building: string, prospect: string) =>
  `/organizations/${org}/buildings/${building}/prospects/${prospect}/screenings`;

export const screeningsApi = {
  list: (org: string, building: string, prospect: string) =>
    api<Screening[]>(base(org, building, prospect)),
  request: (org: string, building: string, prospect: string) =>
    api<{ id: string }>(base(org, building, prospect), "POST"),
};
