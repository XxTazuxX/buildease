import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { PageHeader } from "@/shared/components/Surface";
import { QueryError } from "@/shared/components/QueryError";
import { useZodForm } from "@/shared/forms/useZodForm";
import { formatDate } from "@/shared/utils/dates";
import {
  billingProfileSchema,
  money,
  type BillingCycle,
  type BillingOverview,
  type BillingProfile,
} from "../model/billing";
import { useBilling } from "../viewmodel/useBilling";
import { InvoiceDialog } from "./InvoiceDocument";
import { InvoiceStatusChip, SubscriptionStatusChip } from "./InvoiceStatusChip";
import { CycleToggle, PlanCards } from "./PlanCards";
import { PageSkeleton } from "@/shared/components/Skeletons";

function UsageMeter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const ratio = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between" }}>
        <Typography variant="body2" sx={{ fontWeight: 650 }}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {used} / {limit ?? "∞"}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={limit === null ? 0 : ratio}
        color={ratio >= 100 ? "error" : ratio >= 80 ? "warning" : "primary"}
        sx={{ mt: 0.75, height: 8, borderRadius: 4 }}
        aria-label={`${label} usage`}
      />
    </Box>
  );
}

function statusMessage(overview: BillingOverview) {
  if (overview.status === "TRIALING")
    return overview.writable
      ? `Your free trial ends in ${overview.trial_days_left ?? 0} day${overview.trial_days_left === 1 ? "" : "s"}. Choose a plan to keep your data editable afterwards.`
      : "Your free trial has ended. Your workspace is read-only until a plan is active.";
  if (overview.status === "PAST_DUE")
    return "An invoice is overdue. Please settle it to avoid suspension.";
  if (overview.status === "SUSPENDED")
    return "Your subscription is suspended. Contact billing support to reactivate it.";
  if (overview.status === "CANCELLED")
    return "Your subscription is cancelled. Choose a plan to reactivate it.";
  return null;
}

function ProfileForm({
  overview,
  busy,
  onSave,
}: {
  overview: BillingOverview;
  busy: boolean;
  onSave: (profile: BillingProfile) => Promise<boolean>;
}) {
  const profile = useZodForm(billingProfileSchema, {
    billingEmail: overview.billing_email ?? "",
    billingName: overview.billing_name ?? "",
    billingAddress: overview.billing_address ?? "",
    taxId: overview.tax_id ?? "",
  });
  const [saved, setSaved] = useState(false);
  const snapshot = JSON.stringify(profile.values);
  useEffect(() => setSaved(false), [snapshot]);
  return (
    <Stack spacing={2}>
      <TextField
        label="Billing email"
        type="email"
        {...profile.field("billingEmail")}
        helperText={
          profile.error("billingEmail") ??
          "Invoices are sent here. Leave blank to email all owners."
        }
      />
      <TextField label="Company name" {...profile.field("billingName")} />
      <TextField
        label="Billing address"
        multiline
        minRows={2}
        {...profile.field("billingAddress")}
      />
      <TextField label="Tax / VAT ID" {...profile.field("taxId")} />
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Button
          variant="contained"
          disabled={busy}
          onClick={profile.submit(async (values) =>
            setSaved(await onSave(values)),
          )}
        >
          Save billing details
        </Button>
        {saved && (
          <Typography variant="body2" color="success.main">
            Saved
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}

export function BillingPage({ org }: { org: string }) {
  const vm = useBilling(org);
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const [viewing, setViewing] = useState<string | null>(null);
  const overview = vm.overview.data;
  const message = overview ? statusMessage(overview) : null;
  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Plan & billing"
        description="Your BuildEase subscription, usage, and invoices."
      />
      <QueryError queries={[vm.overview, vm.invoices]} what="billing" />
      {vm.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {vm.error}
        </Alert>
      )}
      {vm.overview.isLoading && <PageSkeleton label="Loading billing" />}
      {overview && (
        <Stack spacing={3}>
          {message && (
            <Alert
              severity={
                overview.status === "TRIALING" && overview.writable
                  ? "info"
                  : "warning"
              }
            >
              {message}
            </Alert>
          )}
          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            }}
          >
            <Paper sx={{ p: 3 }}>
              <Typography variant="overline" color="text.secondary">
                Current plan
              </Typography>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center", mt: 0.5 }}
              >
                <Typography variant="h5">{overview.plan_name}</Typography>
                <SubscriptionStatusChip status={overview.status} />
              </Stack>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {overview.status === "TRIALING"
                  ? `Trial ends ${formatDate(overview.trial_ends_on)}`
                  : `${money(
                      overview.billing_cycle === "ANNUAL"
                        ? overview.annual_price
                        : overview.monthly_price,
                      overview.currency,
                    )} billed ${overview.billing_cycle === "ANNUAL" ? "yearly" : "monthly"} · current period ${formatDate(overview.current_period_start)} – ${formatDate(overview.current_period_end)}`}
              </Typography>
              {overview.requested_plan && (
                <Alert
                  severity="info"
                  sx={{ mt: 2 }}
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      disabled={vm.busy}
                      onClick={() => void vm.withdrawRequest()}
                    >
                      Withdraw
                    </Button>
                  }
                >
                  You requested {overview.requested_plan.name} (
                  {overview.requested_cycle?.toLowerCase()}). Our team will
                  confirm and send your first invoice.
                </Alert>
              )}
            </Paper>
            <Paper sx={{ p: 3 }}>
              <Typography variant="overline" color="text.secondary">
                Usage
              </Typography>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <UsageMeter
                  label="Buildings"
                  used={overview.usage.buildings}
                  limit={overview.limits.buildings}
                />
                <UsageMeter
                  label="Units"
                  used={overview.usage.spaces}
                  limit={overview.limits.spaces}
                />
                <UsageMeter
                  label="Staff seats"
                  used={overview.usage.staff}
                  limit={overview.limits.staff}
                />
              </Stack>
            </Paper>
          </Box>

          <Paper sx={{ p: 3 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{ justifyContent: "space-between", gap: 2, mb: 2 }}
            >
              <Box>
                <Typography variant="h6">Change plan</Typography>
                <Typography color="text.secondary">
                  Plan changes are confirmed by our billing team, usually within
                  one business day.
                </Typography>
              </Box>
              <CycleToggle cycle={cycle} onChange={setCycle} />
            </Stack>
            <PlanCards
              plans={vm.plans.data ?? []}
              cycle={cycle}
              currentPlanId={
                overview.status === "TRIALING" ? undefined : overview.plan_id
              }
              disabled={vm.busy}
              actionLabel={(plan) =>
                plan.id === overview.plan_id &&
                cycle === overview.billing_cycle &&
                overview.status !== "TRIALING"
                  ? "Your plan"
                  : overview.requested_plan_id === plan.id &&
                      overview.requested_cycle === cycle
                    ? "Requested"
                    : `Request ${plan.name}`
              }
              onSelect={(plan) => {
                if (
                  plan.id === overview.plan_id &&
                  cycle === overview.billing_cycle &&
                  overview.status !== "TRIALING"
                )
                  return;
                void vm.requestPlan(plan.id, cycle);
              }}
            />
          </Paper>

          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
            }}
          >
            <Paper sx={{ p: 3, overflowX: "auto" }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Invoices
              </Typography>
              {vm.invoices.data?.length === 0 ? (
                <Typography color="text.secondary">No invoices yet.</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Number</TableCell>
                      <TableCell>Issued</TableCell>
                      <TableCell>Due</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {vm.invoices.data?.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>{invoice.number}</TableCell>
                        <TableCell>{formatDate(invoice.issued_on)}</TableCell>
                        <TableCell>{formatDate(invoice.due_on)}</TableCell>
                        <TableCell align="right">
                          {money(invoice.total, invoice.currency)}
                        </TableCell>
                        <TableCell>
                          <InvoiceStatusChip status={invoice.status} />
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            onClick={() => setViewing(invoice.id)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Paper>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Billing details
              </Typography>
              <ProfileForm
                key={overview.organization_id}
                overview={overview}
                busy={vm.busy}
                onSave={vm.updateProfile}
              />
            </Paper>
          </Box>
        </Stack>
      )}
      {viewing && (
        <InvoiceDialog
          org={org}
          invoice={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}
