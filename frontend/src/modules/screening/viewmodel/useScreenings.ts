import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { screeningsApi } from "../model/screenings";

export function useScreenings(org: string, building: string, prospect: string) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = [org, "building", building, "prospects", prospect, "screenings"];
  const list = useQuery({
    queryKey: key,
    queryFn: () => screeningsApi.list(org, building, prospect),
    enabled: !!prospect,
  });
  const request = async () => {
    setBusy(true);
    setError("");
    try {
      await screeningsApi.request(org, building, prospect);
      await cache.invalidateQueries({ queryKey: key });
      await cache.invalidateQueries({
        queryKey: [org, "building", building, "prospects"],
      });
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to request screening",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { list, busy, error, request };
}
