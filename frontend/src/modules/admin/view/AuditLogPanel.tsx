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
import { isUuid } from "@/shared/forms/rules";
import { useOrgAudit, usePlatformAudit } from "../viewmodel/useAdmin";
import { ListSkeleton } from "@/shared/components/Skeletons";

const idProblem = (value: string) =>
  value.trim() !== "" && !isUuid(value.trim()) ? "Enter a valid ID (UUID)" : "";

/** Platform-wide audit trail, or a single organization's trail when `org` is given. */
export function AuditLogPanel({ org }: { org?: string } = {}) {
  const [page, setPage] = useState(0);
  const [organizationId, setOrganizationId] = useState("");
  const [actorId, setActorId] = useState("");
  const organizationProblem = idProblem(organizationId);
  const actorProblem = idProblem(actorId);
  const platformQuery = usePlatformAudit(
    page,
    organizationProblem ? undefined : organizationId.trim() || undefined,
    actorProblem ? undefined : actorId.trim() || undefined,
    !org,
  );
  const orgQuery = useOrgAudit(org ?? "", page);
  const query = org ? orgQuery : platformQuery;
  return (
    <Stack spacing={2}>
      <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography variant="overline" color="primary.main">
          {org ? "Organization audit" : "Platform audit"}
        </Typography>
        <Typography variant="h5">
          {org
            ? "Recent activity in this organization"
            : "Activity across every organization"}
        </Typography>
        {!org && (
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
              error={!!organizationProblem}
              helperText={organizationProblem || undefined}
              sx={{ flexGrow: 1 }}
            />
            <TextField
              label="Actor ID"
              value={actorId}
              onChange={(e) => {
                setActorId(e.target.value);
                setPage(0);
              }}
              error={!!actorProblem}
              helperText={actorProblem || undefined}
              sx={{ flexGrow: 1 }}
            />
          </Stack>
        )}
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
        {query.isLoading && <ListSkeleton label="Loading activity" />}
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
              {org
                ? ""
                : e.organization_id
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
