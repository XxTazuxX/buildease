import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../model/dashboard";

export function useDashboard(org: string) {
  return useQuery({
    queryKey: [org, "dashboard"],
    queryFn: () => dashboardApi.get(org),
    enabled: !!org,
  });
}
