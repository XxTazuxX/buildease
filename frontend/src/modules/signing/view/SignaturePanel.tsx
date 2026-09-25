import { useState } from "react";
import { Alert, Button, Stack, TextField, Typography } from "@mui/material";
import { StatusChip } from "@/shared/components/Surface";
import type { SignatureRole } from "../model/signatures";
import { useSignature } from "../viewmodel/useSignature";

export function SignaturePanel({
  org,
  building,
  lease,
  role,
  defaultName,
  canSign = true,
}: {
  org: string;
  building: string;
  lease: string;
  role: SignatureRole;
  defaultName: string;
  canSign?: boolean;
}) {
  const vm = useSignature(org, building, lease);
  const [name, setName] = useState(defaultName);
  const mine =
    role === "OWNER" ? vm.status.data?.owner : vm.status.data?.resident;
  const other =
    role === "OWNER" ? vm.status.data?.resident : vm.status.data?.owner;
  const otherLabel = role === "OWNER" ? "Resident" : "Owner";

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">Signatures</Typography>
      {vm.error && <Alert severity="error">{vm.error}</Alert>}
      <StatusChip
        active={!!vm.status.data?.fullyExecuted}
        label={
          vm.status.data?.fullyExecuted
            ? "Fully executed"
            : "Awaiting signatures"
        }
      />
      <Typography variant="body2" color="text.secondary">
        {otherLabel}:{" "}
        {other ? `Signed by ${other.signed_name}` : "Not yet signed"}
      </Typography>
      {mine ? (
        <Typography variant="body2" color="text.secondary">
          You signed as {mine.signed_name}.
        </Typography>
      ) : canSign ? (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            size="small"
            label="Type your full legal name to sign"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ flexGrow: 1 }}
          />
          <Button
            variant="contained"
            disabled={vm.busy || !name.trim()}
            onClick={() => void vm.sign(role, name)}
          >
            Sign lease
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}
