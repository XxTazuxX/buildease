import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildingsApi, type Space } from "@/modules/buildings";
import {
  assetSchema,
  assetsApi,
  type AssetStatus,
  type NewAsset,
} from "../model/assets";

export function useAssets(org: string, building: string, status?: AssetStatus) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = [org, "building", building, "assets", status ?? ""];
  const list = useQuery({
    queryKey: key,
    queryFn: () => assetsApi.list(org, building, status),
    enabled: !!building,
  });
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await cache.invalidateQueries({
        queryKey: [org, "building", building, "assets"],
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
    create: (body: NewAsset) =>
      run(() => assetsApi.create(org, building, assetSchema.parse(body))),
    setStatus: (id: string, status: AssetStatus) =>
      run(() => assetsApi.setStatus(org, building, id, status)),
  };
}

export function useAssetSpaces(org: string, building: string) {
  return useQuery<Space[]>({
    queryKey: [org, "building", building, "spaces"],
    queryFn: () => buildingsApi.spaces(org, building),
    enabled: !!building,
  });
}

export function useAssetDetail(org: string, building: string, asset: string) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = [org, "building", building, "assets", "detail", asset];
  const detail = useQuery({
    queryKey: key,
    queryFn: () => assetsApi.detail(org, building, asset),
    enabled: !!asset,
  });
  const recordMeterReading = async (value: number, unit: string) => {
    setBusy(true);
    setError("");
    try {
      await assetsApi.recordMeterReading(org, building, asset, value, unit);
      await cache.invalidateQueries({ queryKey: key });
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to record reading",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { detail, busy, error, recordMeterReading };
}
