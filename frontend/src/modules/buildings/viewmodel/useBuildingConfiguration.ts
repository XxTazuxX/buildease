import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buildingsApi,
  configurationSchema,
  type BuildingConfiguration,
  type SpaceStatus,
} from "../model/buildings";
import { reportError } from "@/shared/feedback/reportError";
import { withOptimisticList, withoutId } from "@/shared/api/optimistic";

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
  const levelsKey = [org, "building", building, "levels"];
  const spacesKey = [org, "building", building, "spaces"];
  type Level = NonNullable<typeof levels.data>[number];
  type Space = NonNullable<typeof spaces.data>[number];
  const run = async (
    operation: () => Promise<unknown>,
    optimistic?: () => Promise<void>,
  ) => {
    setBusy(true);
    setError("");
    try {
      await (optimistic ? optimistic() : operation());
      await cache.invalidateQueries({ queryKey: [org, "building", building] });
      return true;
    } catch (cause) {
      setError(reportError(cause, "Operation failed"));
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
    updateLevel: (
      level: string,
      body: { name: string; code: string; sortOrder: number },
    ) => run(() => buildingsApi.updateLevel(org, building, level, body)),
    deleteLevel: (level: string) => {
      const operation = () => buildingsApi.deleteLevel(org, building, level);
      return run(operation, () =>
        withOptimisticList<Level>(
          cache,
          levelsKey,
          withoutId(level),
          operation,
        ),
      );
    },
    updateSpace: (space: string, body: unknown) =>
      run(() => buildingsApi.updateSpace(org, building, space, body)),
    deleteSpace: (space: string) => {
      const operation = () => buildingsApi.deleteSpace(org, building, space);
      return run(operation, () =>
        withOptimisticList<Space>(
          cache,
          spacesKey,
          withoutId(space),
          operation,
        ),
      );
    },
    createSpace: (body: unknown) =>
      run(() => buildingsApi.createSpace(org, building, body)),
    setStatus: (space: string, status: Exclude<SpaceStatus, "OCCUPIED">) =>
      run(() => buildingsApi.setStatus(org, building, space, status)),
  };
}
