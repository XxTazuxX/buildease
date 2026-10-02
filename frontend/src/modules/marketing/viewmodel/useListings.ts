import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildingsApi, type Space } from "@/modules/buildings";
import {
  listingsApi,
  newListingSchema,
  updateListingSchema,
  type ListingChannel,
  type NewListing,
  type UpdatedListing,
} from "../model/listings";
import { reportError } from "@/shared/feedback/reportError";
import { withOptimisticList, withoutId } from "@/shared/api/optimistic";

export function useListings(org: string, building: string) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = [org, "building", building, "listings"];
  const list = useQuery({
    queryKey: key,
    queryFn: () => listingsApi.list(org, building),
    enabled: !!building,
  });
  type Row = NonNullable<typeof list.data>[number];
  const run = async (
    fn: () => Promise<unknown>,
    patch?: (rows: Row[]) => Row[],
  ) => {
    setBusy(true);
    setError("");
    try {
      if (patch) await withOptimisticList<Row>(cache, key, patch, fn);
      else await fn();
      await cache.invalidateQueries({ queryKey: key });
      return true;
    } catch (cause) {
      setError(reportError(cause, "Operation failed"));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return {
    list,
    busy,
    error,
    create: (body: NewListing) =>
      run(() =>
        listingsApi.create(org, building, newListingSchema.parse(body)),
      ),
    loadDetail: (id: string) => listingsApi.detail(org, building, id),
    update: (id: string, body: UpdatedListing) =>
      run(() =>
        listingsApi.update(org, building, id, updateListingSchema.parse(body)),
      ),
    remove: (id: string) =>
      run(() => listingsApi.remove(org, building, id), withoutId(id)),
    publish: (id: string, channels: ListingChannel[]) =>
      run(() => listingsApi.publish(org, building, id, channels)),
    unpublish: (id: string) =>
      run(() => listingsApi.unpublish(org, building, id)),
  };
}

export function useListingSpaces(org: string, building: string) {
  return useQuery<Space[]>({
    queryKey: [org, "building", building, "spaces"],
    queryFn: () => buildingsApi.spaces(org, building),
    enabled: !!building,
  });
}

export function useListingDetail(org: string, building: string, id: string) {
  return useQuery({
    queryKey: [org, "building", building, "listings", id],
    queryFn: () => listingsApi.detail(org, building, id),
    enabled: !!id,
  });
}
