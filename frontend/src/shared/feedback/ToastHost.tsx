import { useEffect, useSyncExternalStore } from "react";
import { Alert, AlertTitle, Stack } from "@mui/material";
import { notify, type Toast } from "./notify";

const titles = {
  error: "Something went wrong",
  warning: "Heads up",
  success: undefined,
  info: undefined,
} as const;

const durations = { error: 8000, warning: 6000, success: 4000, info: 4500 };

function ToastItem({ toast }: { toast: Toast }) {
  useEffect(() => {
    const timer = window.setTimeout(
      () => notify.dismiss(toast.id),
      durations[toast.kind],
    );
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.kind]);
  const title = titles[toast.kind];
  return (
    <Alert
      severity={toast.kind}
      variant="filled"
      onClose={() => notify.dismiss(toast.id)}
      sx={{ boxShadow: "0 12px 32px rgba(18, 47, 45, 0.22)" }}
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      {toast.message}
    </Alert>
  );
}

/** Renders the global toast queue. Mount once, near the root. */
export function ToastHost() {
  const toasts = useSyncExternalStore(
    notify.subscribe,
    notify.snapshot,
    notify.snapshot,
  );
  return (
    <Stack
      spacing={1}
      aria-live="polite"
      sx={{
        position: "fixed",
        zIndex: (theme) => theme.zIndex.snackbar,
        right: { xs: 12, sm: 24 },
        bottom: { xs: 12, sm: 24 },
        left: { xs: 12, sm: "auto" },
        width: { sm: 400 },
        maxWidth: "calc(100vw - 24px)",
        pointerEvents: "none",
        "& > *": { pointerEvents: "auto" },
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </Stack>
  );
}
