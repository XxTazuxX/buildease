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
