import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildingsApi } from "@/modules/buildings/model/buildings";
import { todayIso } from "@/shared/utils/dates";
import { occupancyApi } from "../model/occupancy";
export function useOccupancy(org: string, building: string) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = [org, "building", building];
  const residents = useQuery({
    queryKey: [...key, "residents"],
    queryFn: () => occupancyApi.residents(org, building),
    enabled: !!building,
  });
  const spaces = useQuery({
    queryKey: [...key, "spaces"],
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return {
    residents,
    spaces,
    busy,
    error,
    create: (body: { accountId: string; displayName: string; phone: string }) =>
      run(() => occupancyApi.createResident(org, building, body)),
    update: (
      resident: string,
      body: { displayName: string; phone: string; active: boolean },
    ) => run(() => occupancyApi.updateResident(org, building, resident, body)),
    addHouseholdMember: (
      resident: string,
      name: string,
      relationship: string,
    ) =>
      run(() =>
        occupancyApi.addHouseholdMember(org, building, resident, {
          name: name.trim(),
          relationship: relationship.trim() || undefined,
        }),
      ),
    assign: (residentId: string, spaceId: string) =>
      run(() =>
        occupancyApi.assign(org, building, {
          residentId,
          spaceId,
          startsOn: todayIso(),
        }),
      ),
    end: (assignment: string) =>
      run(() => occupancyApi.end(org, building, assignment, todayIso())),
  };
}
