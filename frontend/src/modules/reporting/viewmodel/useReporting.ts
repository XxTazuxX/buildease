import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { leasesApi, type Lease } from "@/modules/leases";
import { reportingApi } from "../model/reporting";

export function useRentRoll(org: string, building: string) {
  return useQuery({
    queryKey: [org, "building", building, "reports", "rent-roll"],
    queryFn: () => reportingApi.rentRoll(org, building),
    enabled: !!building,
  });
}

export function useIncomeStatement(
  org: string,
  building: string,
  from: string,
  to: string,
) {
  return useQuery({
    queryKey: [
      org,
      "building",
      building,
      "reports",
      "income-statement",
      from,
      to,
    ],
    queryFn: () => reportingApi.incomeStatement(org, building, from, to),
    enabled: !!building && !!from && !!to,
  });
}

export function useLeasesForStatement(org: string, building: string) {
  return useQuery<Lease[]>({
    queryKey: [org, "building", building, "leases"],
    queryFn: () => leasesApi.list(org, building),
    enabled: !!building,
  });
}

export function useLeaseStatement(
  org: string,
  building: string,
  lease: string,
  from: string,
  to: string,
) {
  return useQuery({
    queryKey: [
      org,
      "building",
      building,
      "reports",
      "lease-statement",
      lease,
      from,
      to,
    ],
    queryFn: () => reportingApi.leaseStatement(org, building, lease, from, to),
    enabled: !!building && !!lease && !!from && !!to,
  });
}

export function useOccupancyReport(org: string, building: string) {
  return useQuery({
    queryKey: [org, "building", building, "reports", "occupancy"],
    queryFn: () => reportingApi.occupancyReport(org, building),
    enabled: !!building,
  });
}

export function useMaintenanceReport(
  org: string,
  building: string,
  from: string,
  to: string,
) {
  return useQuery({
    queryKey: [org, "building", building, "reports", "maintenance", from, to],
    queryFn: () => reportingApi.maintenanceReport(org, building, from, to),
    enabled: !!building && !!from && !!to,
  });
}

export function useReportExports(org: string, building: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };
  return {
    busy,
    error,
    exportRentRoll: () => run(() => reportingApi.exportRentRoll(org, building)),
    exportIncomeStatement: (from: string, to: string) =>
      run(() => reportingApi.exportIncomeStatement(org, building, from, to)),
  };
}
