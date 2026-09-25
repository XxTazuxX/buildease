import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildingsApi, type Space } from "@/modules/buildings";
import {
  newProspectSchema,
  prospectsApi,
  type NewProspect,
  type ProspectStatus,
} from "../model/prospects";

export function useProspects(
  org: string,
  building: string,
  status?: ProspectStatus,
) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = [org, "building", building, "prospects", status ?? ""];
  const list = useQuery({
    queryKey: key,
    queryFn: () => prospectsApi.list(org, building, status),
    enabled: !!building,
  });
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await cache.invalidateQueries({
        queryKey: [org, "building", building, "prospects"],
      });
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return {
    list,
    busy,
    error,
    create: (body: NewProspect) =>
      run(() =>
        prospectsApi.create(org, building, newProspectSchema.parse(body)),
      ),
    updateStatus: (id: string, status: ProspectStatus, notes?: string) =>
      run(() => prospectsApi.updateStatus(org, building, id, status, notes)),
    linkLease: (id: string, leaseId: string) =>
      run(() => prospectsApi.linkLease(org, building, id, leaseId)),
  };
}

export function useProspectSpaces(org: string, building: string) {
  return useQuery<Space[]>({
    queryKey: [org, "building", building, "spaces"],
    queryFn: () => buildingsApi.spaces(org, building),
    enabled: !!building,
  });
}
