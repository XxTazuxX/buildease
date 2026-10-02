import type { ReactNode } from "react";
import {
  Alert,
  Button,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { AdaptiveDialog } from "@/shared/components/Responsive";

/**
 * One consistent confirmation for destructive actions. It stays open while the action runs and
 * shows the server's reason in place if the action is refused.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = true,
  busy = false,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string;
  onConfirm: () => void | Promise<unknown>;
  onClose: () => void;
}) {
  return (
    <AdaptiveDialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <Divider />
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography>{children}</Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: "flex-end" }}
          >
            <Button onClick={onClose}>{cancelLabel}</Button>
            <Button
              color={destructive ? "error" : "primary"}
              variant="contained"
              disabled={busy}
              onClick={() => void onConfirm()}
            >
              {confirmLabel}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </AdaptiveDialog>
  );
}
