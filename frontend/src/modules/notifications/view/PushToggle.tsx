import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import {
  currentPushSubscription,
  disablePush,
  enablePush,
  pushApi,
  pushSupported,
} from "../model/push";
import { reportError } from "@/shared/feedback/reportError";

/** Opt-in for browser push notifications; hidden when the server has web push disabled. */
export function PushToggle() {
  const configuration = useQuery({
    queryKey: ["notifications", "push-configuration"],
    queryFn: pushApi.configuration,
    enabled: pushSupported(),
    retry: false,
  });
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void currentPushSubscription().then((subscription) =>
      setEnabled(!!subscription),
    );
  }, []);
  if (!pushSupported() || !configuration.data) return null;
  return (
    <Stack spacing={1}>
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            disabled={busy}
            onChange={(_, checked) => {
              setBusy(true);
              setError("");
              void (checked ? enablePush() : disablePush())
                .then(() => setEnabled(checked))
                .catch((cause: unknown) =>
                  setError(
                    reportError(cause, "Could not update notifications"),
                  ),
                )
                .finally(() => setBusy(false));
            }}
          />
        }
        label="Browser notifications on this device"
      />
      <Typography variant="caption" color="text.secondary">
        Get alerted about new requests, assignments and billing notices even
        when BuildEase is closed.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
