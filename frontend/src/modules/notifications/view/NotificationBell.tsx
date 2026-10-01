import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Stack,
  SvgIcon,
  Typography,
} from "@mui/material";
import { notificationRoute } from "../model/notifications";
import { useNotifications } from "../viewmodel/useNotifications";

function BellIcon() {
  return (
    <SvgIcon aria-hidden="true" viewBox="0 0 24 24" sx={{ fontSize: 22 }}>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z" />
        <path d="M10 20.5a2 2 0 0 0 4 0" />
      </g>
    </SvgIcon>
  );
}

export function NotificationBell() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const vm = useNotifications(!!anchor);
  const navigate = useNavigate();
  const items = vm.list.data ?? [];
  return (
    <>
      <IconButton
        aria-label={
          vm.unread > 0 ? `Notifications, ${vm.unread} unread` : "Notifications"
        }
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <Badge color="error" badgeContent={vm.unread} max={99}>
          <BellIcon />
        </Badge>
      </IconButton>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 360, maxWidth: "92vw" } } }}
      >
        <Stack
          direction="row"
          sx={{
            px: 2,
            py: 1.5,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography sx={{ fontWeight: 800 }}>Notifications</Typography>
          <Button
            size="small"
            disabled={vm.unread === 0}
            onClick={() => void vm.markAllRead()}
          >
            Mark all read
          </Button>
        </Stack>
        <Divider />
        {vm.list.isLoading && (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            Loading…
          </Typography>
        )}
        {vm.list.isError && (
          <Typography color="error" sx={{ p: 2 }}>
            Notifications could not be loaded.
          </Typography>
        )}
        {!vm.list.isLoading && items.length === 0 && !vm.list.isError && (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            You&apos;re all caught up.
          </Typography>
        )}
        <List dense sx={{ maxHeight: 420, overflowY: "auto", py: 0 }}>
          {items.map((item) => (
            <ListItemButton
              key={item.id}
              onClick={() => {
                void vm.markRead(item);
                setAnchor(null);
                navigate(notificationRoute(item));
              }}
              sx={{ alignItems: "flex-start", gap: 1 }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  mt: 0.9,
                  flexShrink: 0,
                  bgcolor: item.read_at ? "transparent" : "primary.main",
                }}
              />
              <ListItemText
                primary={item.title}
                secondary={new Date(item.created_at).toLocaleString()}
                slotProps={{
                  primary: { sx: { fontWeight: item.read_at ? 500 : 750 } },
                }}
              />
            </ListItemButton>
          ))}
        </List>
      </Popover>
    </>
  );
}
