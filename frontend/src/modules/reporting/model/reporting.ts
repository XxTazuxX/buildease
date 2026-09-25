import { api, downloadFile } from "@/shared/api/client";

export interface RentRollRow {
  lease_id: string;
  resident_id: string;
  resident_name: string;
  space_id: string;
  space_name: string;
  space_code: string;
  rent_amount: string;
  currency: string;
  next_charge_on: string;
  starts_on: string;
  ends_on: string | null;
  charged: string;
  paid: string;
  balance: string;
  deposit_status: "HELD" | "REFUNDED" | "FORFEITED" | null;
  deposit_amount: string | null;
}

export interface IncomeStatement {
  from: string;
  to: string;
  totalCharged: string;
  totalCollected: string;
  outstandingBalance: string;
}

export interface StatementLine {
  id: string;
  kind: "CHARGE" | "PAYMENT";
  label: string;
  amount: string;
  date: string;
  runningBalance: string;
}

export interface LeaseStatement {
  from: string;
  to: string;
  openingBalance: string;
  lines: StatementLine[];
  closingBalance: string;
}

export interface OccupancyReport {
  byStatus: Record<string, number>;
  totalRentable: number;
  occupancyRate: number;
  averageTenancyDays: number | null;
}

export interface MaintenanceReportRow {
  status: string;
  count: number;
}
export interface MaintenanceReport {
  from: string;
  to: string;
  byStatus: MaintenanceReportRow[];
  averageResolutionHours: number | null;
  slaComplianceRate: number;
}

const base = (org: string, building: string) =>
  `/organizations/${org}/buildings/${building}/reports`;

export const reportingApi = {
  rentRoll: (org: string, building: string) =>
    api<RentRollRow[]>(`${base(org, building)}/rent-roll`),
  incomeStatement: (org: string, building: string, from: string, to: string) =>
    api<IncomeStatement>(
      `${base(org, building)}/income-statement?from=${from}&to=${to}`,
    ),
  leaseStatement: (
    org: string,
    building: string,
    lease: string,
    from: string,
    to: string,
  ) =>
    api<LeaseStatement>(
      `${base(org, building)}/leases/${lease}/statement?from=${from}&to=${to}`,
    ),
  occupancyReport: (org: string, building: string) =>
    api<OccupancyReport>(`${base(org, building)}/occupancy`),
  maintenanceReport: (
    org: string,
    building: string,
    from: string,
    to: string,
  ) =>
    api<MaintenanceReport>(
      `${base(org, building)}/maintenance?from=${from}&to=${to}`,
    ),
  exportRentRoll: (org: string, building: string) =>
    downloadFile(`${base(org, building)}/rent-roll/export`, "rent-roll.csv"),
  exportIncomeStatement: (
    org: string,
    building: string,
    from: string,
    to: string,
  ) =>
    downloadFile(
      `${base(org, building)}/income-statement/export?from=${from}&to=${to}`,
      "income-statement.csv",
    ),
};
