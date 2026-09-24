import { api } from "@/shared/api/client";

export interface DashboardProperties {
  building_count: number;
  space_count: number;
  occupied_space_count: number;
  vacant_space_count: number;
}

export interface DashboardPeople {
  active_member_count: number;
  active_resident_count: number;
  active_assignment_count: number;
}

export interface DashboardFinance {
  active_lease_count: number;
  balance_by_currency: { currency: string; amount: string }[];
}

export interface DashboardMaintenance {
  open_request_count: number;
  overdue_request_count: number;
}

export interface Dashboard {
  properties: DashboardProperties;
  people: DashboardPeople | null;
  finance: DashboardFinance | null;
  maintenance: DashboardMaintenance | null;
}

export const dashboardApi = {
  get: (org: string) => api<Dashboard>(`/organizations/${org}/dashboard`),
};
