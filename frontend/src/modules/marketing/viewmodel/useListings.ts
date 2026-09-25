import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildingsApi, type Space } from "@/modules/buildings";
import {
  listingsApi,
  newListingSchema,
  type ListingChannel,
  type NewListing,
} from "../model/listings";

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
    list,
    busy,
    error,
    create: (body: NewListing) =>
      run(() =>
        listingsApi.create(org, building, newListingSchema.parse(body)),
      ),
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
