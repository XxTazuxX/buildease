import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { StatusChip } from "@/shared/components/Surface";
import { useApiKeys } from "../viewmodel/useIntegrations";

export function ApiKeysPanel({ org }: { org: string }) {
  const vm = useApiKeys(org);
  const [name, setName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const error = vm.error || vm.list.error?.message;

  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 3 }}>
      <Typography variant="overline" color="primary.main">
        Integrations
      </Typography>
      <Typography variant="h5">API keys</Typography>
      <Typography color="text.secondary">
        Generate a key to let an external accounting tool pull your ledger
        through the read-only public API.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      {revealedKey && (
        <Alert
          severity="warning"
          sx={{ mt: 2 }}
          onClose={() => setRevealedKey(null)}
        >
          Copy this key now — it will not be shown again:{" "}
          <Box component="code" sx={{ fontWeight: 700 }}>
            {revealedKey}
          </Box>
        </Alert>
      )}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mt: 2 }}
      >
        <TextField
          label="Key name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ flexGrow: 1 }}
        />
        <Button
          variant="contained"
          disabled={vm.busy || !name.trim()}
          onClick={() =>
            void vm.create(name).then((created) => {
              if (created) {
                setRevealedKey(created.key);
                setName("");
              }
            })
          }
        >
          Create key
        </Button>
      </Stack>
      <Stack spacing={1} sx={{ mt: 2 }}>
        {vm.list.data?.map((item) => (
          <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{
                gap: 1,
                alignItems: { sm: "center" },
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 700 }}>{item.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Created {new Date(item.created_at).toLocaleDateString()}
                  {item.last_used_at
                    ? ` · Last used ${new Date(item.last_used_at).toLocaleDateString()}`
                    : " · Never used"}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <StatusChip
                  active={!item.revoked_at}
                  label={item.revoked_at ? "REVOKED" : "ACTIVE"}
                />
                {!item.revoked_at && (
                  <Button
                    color="error"
                    size="small"
                    disabled={vm.busy}
                    onClick={() => void vm.revoke(item.id)}
                  >
                    Revoke
                  </Button>
                )}
              </Stack>
            </Stack>
          </Paper>
        ))}
        {vm.list.data?.length === 0 && (
          <Typography color="text.secondary">No API keys yet.</Typography>
        )}
      </Stack>
    </Paper>
  );
}
