import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buildingsApi,
  configurationSchema,
  type BuildingConfiguration,
  type SpaceStatus,
} from "../model/buildings";

export function useBuildingConfiguration(org: string, building: string) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const enabled = !!org && !!building;
  const profile = useQuery({
    queryKey: [org, "building", building, "profile"],
    queryFn: () => buildingsApi.profile(org, building),
    enabled,
  });
  const levels = useQuery({
    queryKey: [org, "building", building, "levels"],
    queryFn: () => buildingsApi.levels(org, building),
    enabled,
  });
  const spaces = useQuery({
    queryKey: [org, "building", building, "spaces"],
    queryFn: () => buildingsApi.spaces(org, building),
    enabled,
  });
  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await operation();
      await cache.invalidateQueries({ queryKey: [org, "building", building] });
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return {
    profile,
    levels,
    spaces,
    busy,
    error,
    configure: (body: BuildingConfiguration) =>
      run(() =>
        buildingsApi.configure(org, building, configurationSchema.parse(body)),
      ),
    createLevel: (body: { name: string; code: string; sortOrder: number }) =>
      run(() => buildingsApi.createLevel(org, building, body)),
    createSpace: (body: unknown) =>
      run(() => buildingsApi.createSpace(org, building, body)),
    setStatus: (space: string, status: Exclude<SpaceStatus, "OCCUPIED">) =>
      run(() => buildingsApi.setStatus(org, building, space, status)),
  };
}
