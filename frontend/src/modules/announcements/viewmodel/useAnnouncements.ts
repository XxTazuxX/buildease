import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  announcementsApi,
  announcementSchema,
  type NewAnnouncement,
} from "../model/announcements";

export function useAnnouncements(org: string, building: string, page: number) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const history = useQuery({
    queryKey: [org, "building", building, "announcements", page],
    queryFn: () => announcementsApi.history(org, building, page),
    enabled: !!building,
  });
  const send = async (body: NewAnnouncement) => {
    setBusy(true);
    setError("");
    try {
      const parsed = announcementSchema.parse(body);
      await announcementsApi.send(org, building, parsed);
      await cache.invalidateQueries({
        queryKey: [org, "building", building, "announcements"],
      });
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to send announcement",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { history, busy, error, send };
}
