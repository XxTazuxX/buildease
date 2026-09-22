import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildingsApi } from "@/modules/buildings/model/buildings";
import { occupancyApi } from "@/modules/occupancy/model/occupancy";
import {
  leasesApi,
  leaseSchema,
  type LeaseEndReason,
  type NewLease,
  type PaymentMethod,
} from "../model/leases";

export function useLeases(org: string, building: string) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = [org, "building", building, "leases"];
  const leases = useQuery({
    queryKey: key,
    queryFn: () => leasesApi.list(org, building),
    enabled: !!building,
  });
  const residents = useQuery({
    queryKey: [org, "building", building, "residents"],
    queryFn: () => occupancyApi.residents(org, building),
    enabled: !!building,
  });
  const spaces = useQuery({
    queryKey: [org, "building", building, "spaces"],
    queryFn: () => buildingsApi.spaces(org, building),
    enabled: !!building,
  });
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await cache.invalidateQueries({ queryKey: key });
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return {
    leases,
    residents,
    spaces,
    busy,
    error,
    create: (body: NewLease) =>
      run(() => leasesApi.create(org, building, leaseSchema.parse(body))),
    activate: (lease: string) =>
      run(() => leasesApi.activate(org, building, lease)),
    cancel: (lease: string) =>
      run(() => leasesApi.cancel(org, building, lease)),
    end: (lease: string, endsOn: string, reason: LeaseEndReason) =>
      run(() => leasesApi.end(org, building, lease, endsOn, reason)),
    recordPayment: (
      lease: string,
      body: {
        amount: number;
        method: PaymentMethod;
        reference?: string;
        receivedOn: string;
        notes?: string;
      },
    ) => run(() => leasesApi.recordPayment(org, building, lease, body)),
    recordDeposit: (lease: string, body: { amount: number; heldOn: string }) =>
      run(() => leasesApi.recordDeposit(org, building, lease, body)),
    refundDeposit: (
      lease: string,
      body: { refundedOn: string; refundedAmount: number; notes?: string },
    ) => run(() => leasesApi.refundDeposit(org, building, lease, body)),
    forfeitDeposit: (lease: string, reason: string) =>
      run(() => leasesApi.forfeitDeposit(org, building, lease, reason)),
  };
}

export function useLeaseDetail(org: string, building: string, lease: string) {
  return useQuery({
    queryKey: [org, "building", building, "leases", lease],
    queryFn: () => leasesApi.detail(org, building, lease),
    enabled: !!lease,
  });
}
