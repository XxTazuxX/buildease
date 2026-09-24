import { useState } from "react";
import {
  Alert,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Pager } from "@/shared/components/Pager";
import { usePlatformAudit } from "../viewmodel/useAdmin";

export function AuditLogPanel() {
  const [page, setPage] = useState(0);
  const [organizationId, setOrganizationId] = useState("");
  const [actorId, setActorId] = useState("");
  const query = usePlatformAudit(
    page,
    organizationId || undefined,
    actorId || undefined,
  );
  return (
    <Stack spacing={2}>
      <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography variant="overline" color="primary.main">
          Platform audit
        </Typography>
        <Typography variant="h5">Activity across every organization</Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ mt: 2 }}
        >
          <TextField
            label="Organization ID"
            value={organizationId}
            onChange={(e) => {
              setOrganizationId(e.target.value);
              setPage(0);
            }}
            sx={{ flexGrow: 1 }}
          />
          <TextField
            label="Actor ID"
            value={actorId}
            onChange={(e) => {
              setActorId(e.target.value);
              setPage(0);
            }}
            sx={{ flexGrow: 1 }}
          />
        </Stack>
      </Paper>
      {query.error && <Alert severity="error">{query.error.message}</Alert>}
      {!query.isLoading && query.data?.length === 0 && (
        <Paper sx={{ p: 5, textAlign: "center" }}>
          <Typography color="text.secondary">
            No audit events match these filters.
          </Typography>
        </Paper>
      )}
      <Stack spacing={1}>
        {query.data?.map((e) => (
          <Paper
            key={`${e.actor_id}-${e.action}-${e.created_at}`}
            variant="outlined"
            sx={{ p: 2 }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <Chip size="small" label={e.action.replaceAll("_", " ")} />
              {e.impersonated_by && (
                <Chip
                  size="small"
                  color="warning"
                  label={`via ${e.impersonated_by.slice(0, 8)}`}
                />
              )}
              <Typography variant="body2" color="text.secondary">
                {new Date(e.created_at).toLocaleString()}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Actor {e.actor_id.slice(0, 8)} · Target {e.target_id.slice(0, 8)}
              {e.organization_id
                ? ` · Org ${e.organization_id.slice(0, 8)}`
                : " · Platform"}
            </Typography>
          </Paper>
        ))}
      </Stack>
      <Pager page={page} count={query.data?.length || 0} onChange={setPage} />
    </Stack>
  );
}
