import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { StatusChip } from "@/shared/components/Surface";
import { useAccountingSync } from "../viewmodel/useIntegrations";

export function AccountingSyncPanel({
  org,
  building,
}: {
  org: string;
  building: string;
}) {
  const vm = useAccountingSync(org, building);
  const error = vm.error || vm.history.error?.message;

  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 3 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          gap: 1.5,
          justifyContent: "space-between",
          alignItems: { sm: "center" },
        }}
      >
        <Box>
          <Typography variant="overline" color="primary.main">
            Accounting sync
          </Typography>
          <Typography variant="h5">Push to accounting</Typography>
          <Typography color="text.secondary">
            Sends this building&apos;s ledger to a sandbox test-mode accounting
            connector.
          </Typography>
        </Box>
        <Button
          variant="contained"
          disabled={vm.busy}
          onClick={() => void vm.sync()}
        >
          Sync now
        </Button>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      <Stack spacing={1} sx={{ mt: 2 }}>
        {vm.history.data?.map((item) => (
          <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Typography variant="body2" color="text.secondary">
                {new Date(item.synced_at).toLocaleString()}
                {item.provider_reference ? ` · ${item.provider_reference}` : ""}
              </Typography>
              <StatusChip
                active={item.status === "SUCCEEDED"}
                label={item.status}
              />
            </Stack>
          </Paper>
        ))}
        {vm.history.data?.length === 0 && (
          <Typography color="text.secondary">No syncs yet.</Typography>
        )}
      </Stack>
    </Paper>
  );
}
