import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import type { Membership } from "@/modules/auth/model/auth";
import { PageHeader, MetricCard } from "@/shared/components/Surface";
import { OfflineNotice } from "@/shared/components/OfflineNotice";
import { useDashboard } from "../viewmodel/useDashboard";

function target(org: string, path: string, building: string, tab?: string) {
  const params = new URLSearchParams();
  if (building) params.set("building", building);
  if (tab) params.set("tab", tab);
  const query = params.toString();
  return `/organizations/${org}/${path}${query ? `?${query}` : ""}`;
}

export function OverviewPage({
  org,
  building,
  displayName,
  pending,
  onAccept,
}: {
  org: string;
  building: string;
  displayName: string;
  pending: Membership[];
  onAccept: (org: string) => Promise<void>;
}) {
  const dashboard = useDashboard(org);
  const data = dashboard.data;
  return (
    <>
      <PageHeader
        eyebrow="Organization overview"
        title={`Hello, ${displayName}.`}
        description="A live view of properties, people, finances, and maintenance across your authorized workspace."
      />
      {dashboard.error && (
        <Alert severity="error">{dashboard.error.message}</Alert>
      )}
      {pending.map((membership) => (
        <Alert
          key={membership.organization_id}
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => void onAccept(membership.organization_id)}
            >
              Accept invitation
            </Button>
          }
        >
          Invitation to {membership.name}
        </Alert>
      ))}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
          },
          gap: 2,
          mb: 3,
        }}
      >
        <MetricCard
          label="Properties"
          value={data?.properties.building_count ?? "—"}
          detail={`${data?.properties.space_count ?? "—"} spaces · ${data?.properties.occupied_space_count ?? "—"} occupied`}
        />
        <MetricCard
          label="People"
          value={data?.people?.active_resident_count ?? "—"}
          detail={
            data?.people
              ? `${data.people.active_assignment_count} active assignments`
              : "Restricted for your role"
          }
          tone="gold"
        />
        <MetricCard
          label="Active leases"
          value={data?.finance?.active_lease_count ?? "—"}
          detail={
            data?.finance
              ? data.finance.balance_by_currency.length
                ? data.finance.balance_by_currency
                    .map((item) => `${item.amount} ${item.currency}`)
                    .join(" · ")
                : "No outstanding balance"
              : "Restricted for your role"
          }
          tone="slate"
        />
        <MetricCard
          label="Open maintenance"
          value={data?.maintenance?.open_request_count ?? "—"}
          detail={
            data?.maintenance
              ? `${data.maintenance.overdue_request_count} overdue`
              : "Restricted for your role"
          }
        />
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
          gap: 2,
        }}
      >
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5">Property operations</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75, mb: 2 }}>
            Configure buildings, levels, spaces, members, and occupancy.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              component={RouterLink}
              to={target(org, "properties", building)}
              variant="contained"
            >
              Open properties
            </Button>
            {data?.people && (
              <Button
                component={RouterLink}
                to={target(org, "people", building)}
              >
                Open people
              </Button>
            )}
          </Stack>
        </Paper>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5">Finance and maintenance</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75, mb: 2 }}>
            Review leases, balances, payments, and repair work requiring
            attention.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            {data?.finance && (
              <Button
                component={RouterLink}
                to={target(org, "operations", building, "finance")}
                variant="contained"
              >
                Open finance
              </Button>
            )}
            {data?.maintenance && (
              <Button
                component={RouterLink}
                to={target(org, "operations", building, "maintenance")}
              >
                Open maintenance
              </Button>
            )}
          </Stack>
        </Paper>
      </Box>
      <OfflineNotice />
    </>
  );
}
