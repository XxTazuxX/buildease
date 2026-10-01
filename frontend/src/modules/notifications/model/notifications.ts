import { api } from "@/shared/api/client";

export interface AppNotification {
  id: string;
  organization_id: string;
  building_id: string | null;
  type: string;
  title: string;
  target_path: string;
  read_at: string | null;
  created_at: string;
}

export const notificationKeys = {
  all: ["notifications"] as const,
  list: () => ["notifications", "list"] as const,
  unread: () => ["notifications", "unread"] as const,
};

export const notificationsApi = {
  list: (page = 0) => api<AppNotification[]>(`/notifications?page=${page}`),
  unreadCount: () => api<{ unread: number }>("/notifications/unread-count"),
  read: (id: string) => api(`/notifications/${id}/read`, "POST"),
  readAll: () => api("/notifications/read-all", "POST"),
};

/**
 * Maps a backend notification target (a domain path such as "/maintenance/{id}") to the
 * workspace screen that shows it. Role-based redirects in the app shell send tenants to their
 * portal when they cannot open the staff screen.
 */
export function notificationRoute(notification: AppNotification): string {
  const org = `/organizations/${notification.organization_id}`;
  const building = notification.building_id
    ? `building=${encodeURIComponent(notification.building_id)}`
    : "";
  const withBuilding = (path: string, tab?: string) => {
    const params = [tab ? `tab=${tab}` : "", building]
      .filter(Boolean)
      .join("&");
    return params ? `${path}?${params}` : path;
  };
  const [, root] = notification.target_path.split("/");
  switch (root) {
    case "maintenance":
      return withBuilding(`${org}/operations`, "maintenance");
    case "leases":
      return withBuilding(`${org}/operations`, "finance");
    case "announcements":
      return withBuilding(`${org}/people`, "announcements");
    case "billing":
      return `${org}/billing`;
    default:
      return withBuilding(`${org}/overview`);
  }
}
