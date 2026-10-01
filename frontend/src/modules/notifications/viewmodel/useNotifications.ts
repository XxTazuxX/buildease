import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  notificationKeys,
  notificationsApi,
  type AppNotification,
} from "../model/notifications";

export function useNotifications(open: boolean) {
  const cache = useQueryClient();
  const unread = useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const list = useQuery({
    queryKey: notificationKeys.list(),
    queryFn: () => notificationsApi.list(0),
    enabled: open,
  });
  const refresh = () =>
    cache.invalidateQueries({ queryKey: notificationKeys.all });
  return {
    unread: unread.data?.unread ?? 0,
    list,
    markRead: async (notification: AppNotification) => {
      if (notification.read_at) return;
      await notificationsApi.read(notification.id);
      await refresh();
    },
    markAllRead: async () => {
      await notificationsApi.readAll();
      await refresh();
    },
  };
}
