import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { MetricCard } from "@/shared/components/Surface";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { PromptDialog } from "@/shared/components/PromptDialog";
import { QueryError } from "@/shared/components/QueryError";
import { useZodForm } from "@/shared/forms/useZodForm";
import { formatDate } from "@/shared/utils/dates";
import {
  billingCycles,
  invoiceFormSchema,
  invoiceStatuses,
  limitLabel,
  money,
  planFormSchema,
  subscriptionFormSchema,
  subscriptionStatuses,
  type BillingCycle,
  type InvoiceStatus,
  type Plan,
  type SubscriptionRow,
  type SubscriptionStatus,
} from "../model/billing";
import { usePlatformBilling } from "../viewmodel/useBilling";
import { InvoiceDialog } from "./InvoiceDocument";
import { InvoiceStatusChip, SubscriptionStatusChip } from "./InvoiceStatusChip";

type Section = "subscriptions" | "invoices" | "plans";
type PlatformVm = ReturnType<typeof usePlatformBilling>;

const emptyPlan = {
  code: "",
  name: "",
  description: "",
  monthlyPrice: "0",
  annualPrice: "0",
  currency: "USD",
  maxBuildings: "",
  maxSpaces: "",
  maxStaff: "",
  features: "",
  trialDays: "0",
  publiclyListed: true,
  active: true,
  sortOrder: "10",
};

const limitValue = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

function planToForm(plan: Plan) {
  return {
    code: plan.code,
    name: plan.name,
    description: plan.description ?? "",
    monthlyPrice: String(plan.monthly_price),
    annualPrice: String(plan.annual_price),
    currency: plan.currency,
    maxBuildings: limitValue(plan.max_buildings),
    maxSpaces: limitValue(plan.max_spaces),
    maxStaff: limitValue(plan.max_staff),
    features: plan.features.join("\n"),
    trialDays: String(plan.trial_days),
    publiclyListed: plan.public,
    active: plan.active,
    sortOrder: String(plan.sort_order),
  };
}

function SubscriptionDialog({
  row,
  vm,
  close,
}: {
  row: SubscriptionRow;
  vm: PlatformVm;
  close: () => void;
}) {
  const form = useZodForm(subscriptionFormSchema, {
    planId: row.requested_plan_id ?? row.plan_id ?? "",
    status: (row.status === "TRIALING" && row.requested_plan_id
      ? "ACTIVE"
      : (row.status ?? "ACTIVE")) as SubscriptionStatus,
    cycle: (row.requested_cycle ??
      row.billing_cycle ??
      "MONTHLY") as BillingCycle,
    trialEndsOn: row.trial_ends_on ?? "",
    periodEnd: "",
  });
  return (
    <AdaptiveDialog open onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>{row.organization_name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {vm.error && <Alert severity="error">{vm.error}</Alert>}
          <TextField select label="Plan" {...form.field("planId")}>
            {vm.plans.data?.map((plan) => (
              <MenuItem key={plan.id} value={plan.id}>
                {plan.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Status"
            {...form.field("status")}
            helperText={
              form.values.status === "SUSPENDED"
                ? "Suspending disables the organization for all of its users."
                : undefined
            }
          >
            {subscriptionStatuses.map((status) => (
              <MenuItem key={status} value={status}>
                {status.replace("_", " ")}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Billing cycle" {...form.field("cycle")}>
            {billingCycles.map((cycle) => (
              <MenuItem key={cycle} value={cycle}>
                {cycle.toLowerCase()}
              </MenuItem>
            ))}
          </TextField>
          {form.values.status === "TRIALING" && (
            <TextField
              label="Trial ends"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...form.field("trialEndsOn")}
            />
          )}
          <TextField
            label="Current period ends (optional)"
            type="date"
            slotProps={{ inputLabel: { shrink: true } }}
            {...form.field("periodEnd")}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button
          variant="contained"
          disabled={vm.busy}
          onClick={form.submit(async (values) => {
            if (await vm.assign(row.organization_id, values)) close();
          })}
        >
          Save subscription
        </Button>
      </DialogActions>
    </AdaptiveDialog>
  );
}

function PlanDialog({
  plan,
  vm,
  close,
}: {
  plan: Plan | null;
  vm: PlatformVm;
  close: () => void;
}) {
  const form = useZodForm(planFormSchema, plan ? planToForm(plan) : emptyPlan);
  return (
    <AdaptiveDialog open onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>{plan ? "Edit plan" : "New plan"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {vm.error && <Alert severity="error">{vm.error}</Alert>}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ alignItems: { sm: "flex-start" } }}
          >
            <TextField
              label="Code"
              disabled={!!plan}
              fullWidth
              {...form.field("code")}
            />
            <TextField label="Name" fullWidth {...form.field("name")} />
          </Stack>
          <TextField label="Description" {...form.field("description")} />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ alignItems: { sm: "flex-start" } }}
          >
            <TextField
              label="Monthly price"
              type="number"
              fullWidth
              {...form.field("monthlyPrice")}
            />
            <TextField
              label="Annual price"
              type="number"
              fullWidth
              {...form.field("annualPrice")}
            />
            <TextField
              label="Currency"
              sx={{ width: { sm: 120 } }}
              {...form.field("currency")}
              onChange={(e) =>
                form.setValue("currency", e.target.value.toUpperCase())
              }
            />
          </Stack>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ alignItems: { sm: "flex-start" } }}
          >
            {(
              [
                ["maxBuildings", "Max buildings"],
                ["maxSpaces", "Max units"],
                ["maxStaff", "Max staff seats"],
              ] as const
            ).map(([field, label]) => (
              <TextField
                key={field}
                label={label}
                type="number"
                fullWidth
                {...form.field(field)}
                helperText={form.error(field) ?? "Blank = unlimited"}
              />
            ))}
          </Stack>
          <TextField
            label="Features (one per line)"
            multiline
            minRows={3}
            {...form.field("features")}
          />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ alignItems: { sm: "flex-start" } }}
          >
            <TextField
              label="Trial days"
              type="number"
              fullWidth
              {...form.field("trialDays")}
            />
            <TextField
              label="Sort order"
              type="number"
              fullWidth
              {...form.field("sortOrder")}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.values.publiclyListed}
                  onChange={(_, checked) =>
                    form.setValue("publiclyListed", checked)
                  }
                />
              }
              label="Show on pricing page"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.values.active}
                  onChange={(_, checked) => form.setValue("active", checked)}
                />
              }
              label="Active"
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button
          variant="contained"
          disabled={vm.busy}
          onClick={form.submit(async (values) => {
            if (await vm.savePlan(plan?.id ?? null, values)) close();
          })}
        >
          Save plan
        </Button>
      </DialogActions>
    </AdaptiveDialog>
  );
}

function InvoiceDraftDialog({
  vm,
  close,
}: {
  vm: PlatformVm;
  close: () => void;
}) {
  const form = useZodForm(invoiceFormSchema, {
    organizationId: "",
    fromPlan: true,
    description: "",
    amount: "",
    tax: "",
    notes: "",
  });
  return (
    <AdaptiveDialog open onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>New invoice</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {vm.error && <Alert severity="error">{vm.error}</Alert>}
          <TextField
            select
            label="Organization"
            {...form.field("organizationId")}
          >
            {vm.subscriptions.data?.map((row) => (
              <MenuItem key={row.organization_id} value={row.organization_id}>
                {row.organization_name}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Checkbox
                checked={form.values.fromPlan}
                onChange={(_, checked) => form.setValue("fromPlan", checked)}
              />
            }
            label="Bill the current plan and period"
          />
          {!form.values.fromPlan && (
            <>
              <TextField label="Description" {...form.field("description")} />
              <TextField
                label="Amount"
                type="number"
                {...form.field("amount")}
              />
            </>
          )}
          <TextField
            label="Tax (optional)"
            type="number"
            {...form.field("tax")}
          />
          <TextField
            label="Notes (optional)"
            multiline
            minRows={2}
            {...form.field("notes")}
          />
          <Typography variant="caption" color="text.secondary">
            The invoice is saved as a draft; issue it to email the customer.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button
          variant="contained"
          disabled={vm.busy}
          onClick={form.submit(async (values) => {
            if (await vm.createInvoice(values)) close();
          })}
        >
          Create draft
        </Button>
      </DialogActions>
    </AdaptiveDialog>
  );
}

export function PlatformBillingPanel() {
  const [section, setSection] = useState<Section>("subscriptions");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<
    SubscriptionStatus | ""
  >("");
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus | "">("");
  const vm = usePlatformBilling({
    pendingOnly,
    subscriptionStatus: subscriptionStatus || undefined,
    invoiceStatus: invoiceStatus || undefined,
  });
  const [managing, setManaging] = useState<SubscriptionRow | null>(null);
  const [editingPlan, setEditingPlan] = useState<{
    plan: Plan | null;
  } | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const summary = vm.summary.data;
  const currency = summary?.currency ?? "USD";

  const openManage = (row: SubscriptionRow) => {
    vm.clearError();
    setManaging(row);
  };

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
        }}
      >
        <MetricCard
          label="MRR"
          value={money(summary?.mrr, currency)}
          detail={`ARR ${money(summary?.arr, currency)}`}
        />
        <MetricCard
          label="Paying customers"
          value={
            (summary?.subscriptions.ACTIVE ?? 0) +
            (summary?.subscriptions.PAST_DUE ?? 0)
          }
          detail={`${summary?.subscriptions.TRIALING ?? 0} on trial`}
          tone="slate"
        />
        <MetricCard
          label="Outstanding"
          value={money(summary?.outstanding, currency)}
          detail={`${money(summary?.overdue, currency)} overdue`}
          tone="gold"
        />
        <MetricCard
          label="Collected (30 days)"
          value={money(summary?.collectedLast30Days, currency)}
          detail={`${summary?.pendingRequests ?? 0} plan requests pending`}
        />
      </Box>
      <QueryError
        queries={[vm.summary, vm.plans, vm.subscriptions, vm.invoices]}
        what="billing data"
      />
      {vm.error &&
        !managing &&
        !editingPlan &&
        !creatingInvoice &&
        !paying &&
        !voiding && <Alert severity="error">{vm.error}</Alert>}
      <Paper sx={{ p: { xs: 2, sm: 2.5 }, overflowX: "auto" }}>
        <Tabs
          value={section}
          onChange={(_, value: Section) => setSection(value)}
          sx={{ mb: 2 }}
        >
          <Tab value="subscriptions" label="Subscriptions" />
          <Tab value="invoices" label="Invoices" />
          <Tab value="plans" label="Plans" />
        </Tabs>

        {section === "subscriptions" && (
          <>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ mb: 2 }}
            >
              <TextField
                select
                size="small"
                label="Status"
                value={subscriptionStatus}
                onChange={(e) =>
                  setSubscriptionStatus(
                    e.target.value as SubscriptionStatus | "",
                  )
                }
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">All</MenuItem>
                {subscriptionStatuses.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status.replace("_", " ")}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={pendingOnly}
                    onChange={(_, checked) => setPendingOnly(checked)}
                  />
                }
                label="Pending plan requests only"
              />
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Organization</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Renews / trial ends</TableCell>
                  <TableCell>Request</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {vm.subscriptions.data?.map((row) => (
                  <TableRow key={row.organization_id}>
                    <TableCell>{row.organization_name}</TableCell>
                    <TableCell>
                      {row.plan_name ?? "—"}
                      {row.billing_cycle && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block" }}
                        >
                          {row.billing_cycle.toLowerCase()}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <SubscriptionStatusChip status={row.status} />
                    </TableCell>
                    <TableCell>
                      {formatDate(
                        row.status === "TRIALING"
                          ? row.trial_ends_on
                          : row.current_period_end,
                      )}
                    </TableCell>
                    <TableCell>
                      {row.requested_plan_name
                        ? `${row.requested_plan_name} (${row.requested_cycle?.toLowerCase()})`
                        : "—"}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      {row.requested_plan_id && (
                        <>
                          <Button
                            size="small"
                            disabled={vm.busy}
                            onClick={() => void vm.approve(row.organization_id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            color="inherit"
                            disabled={vm.busy}
                            onClick={() => void vm.decline(row.organization_id)}
                          >
                            Decline
                          </Button>
                        </>
                      )}
                      <Button size="small" onClick={() => openManage(row)}>
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {vm.subscriptions.data?.length === 0 && (
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                No subscriptions match these filters.
              </Typography>
            )}
          </>
        )}

        {section === "invoices" && (
          <>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ mb: 2, justifyContent: "space-between" }}
            >
              <TextField
                select
                size="small"
                label="Status"
                value={invoiceStatus}
                onChange={(e) =>
                  setInvoiceStatus(e.target.value as InvoiceStatus | "")
                }
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">All</MenuItem>
                {invoiceStatuses.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="contained"
                onClick={() => {
                  vm.clearError();
                  setCreatingInvoice(true);
                }}
              >
                New invoice
              </Button>
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Number</TableCell>
                  <TableCell>Organization</TableCell>
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
                    <TableCell>{invoice.organization_name}</TableCell>
                    <TableCell>{formatDate(invoice.due_on)}</TableCell>
                    <TableCell align="right">
                      {money(invoice.total, invoice.currency)}
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusChip status={invoice.status} />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Button
                        size="small"
                        onClick={() => setViewing(invoice.id)}
                      >
                        View
                      </Button>
                      {invoice.status === "DRAFT" && (
                        <Button
                          size="small"
                          disabled={vm.busy}
                          onClick={() => void vm.issue(invoice.id)}
                        >
                          Issue
                        </Button>
                      )}
                      {["ISSUED", "OVERDUE"].includes(invoice.status) && (
                        <Button
                          size="small"
                          disabled={vm.busy}
                          onClick={() => {
                            vm.clearError();
                            setPaying(invoice.id);
                          }}
                        >
                          Mark paid
                        </Button>
                      )}
                      {["DRAFT", "ISSUED", "OVERDUE"].includes(
                        invoice.status,
                      ) && (
                        <Button
                          size="small"
                          color="error"
                          disabled={vm.busy}
                          onClick={() => {
                            vm.clearError();
                            setVoiding(invoice.id);
                          }}
                        >
                          Void
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {vm.invoices.data?.length === 0 && (
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                No invoices yet.
              </Typography>
            )}
          </>
        )}

        {section === "plans" && (
          <>
            <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 2 }}>
              <Button
                variant="contained"
                onClick={() => {
                  vm.clearError();
                  setEditingPlan({ plan: null });
                }}
              >
                New plan
              </Button>
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Plan</TableCell>
                  <TableCell align="right">Monthly</TableCell>
                  <TableCell align="right">Annual</TableCell>
                  <TableCell>Limits</TableCell>
                  <TableCell>Visibility</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {vm.plans.data?.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      {plan.name}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {plan.code}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {money(plan.monthly_price, plan.currency)}
                    </TableCell>
                    <TableCell align="right">
                      {money(plan.annual_price, plan.currency)}
                    </TableCell>
                    <TableCell>
                      {limitLabel(plan.max_buildings, "building")} ·{" "}
                      {limitLabel(plan.max_spaces, "unit")} ·{" "}
                      {limitLabel(plan.max_staff, "seat")}
                    </TableCell>
                    <TableCell>
                      {!plan.active
                        ? "Retired"
                        : plan.public
                          ? "Public"
                          : "Hidden"}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => {
                          vm.clearError();
                          setEditingPlan({ plan });
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Paper>

      {managing && (
        <SubscriptionDialog
          row={managing}
          vm={vm}
          close={() => setManaging(null)}
        />
      )}

      {editingPlan && (
        <PlanDialog
          plan={editingPlan.plan}
          vm={vm}
          close={() => setEditingPlan(null)}
        />
      )}

      {creatingInvoice && (
        <InvoiceDraftDialog vm={vm} close={() => setCreatingInvoice(false)} />
      )}

      {paying && (
        <PromptDialog
          title="Mark invoice paid"
          fields={[
            {
              name: "method",
              label: "Payment method",
              max: 40,
              optional: true,
              defaultValue: "Bank transfer",
            },
            {
              name: "reference",
              label: "Payment reference (optional)",
              max: 120,
              optional: true,
            },
          ]}
          label="Mark paid"
          error={vm.error}
          onClose={() => setPaying(null)}
          onSubmit={async (values) => {
            if (await vm.pay(paying, values.method, values.reference))
              setPaying(null);
          }}
        />
      )}

      {voiding && (
        <PromptDialog
          title="Void invoice"
          fields={[
            {
              name: "reason",
              label: "Reason for voiding (optional)",
              max: 1000,
              optional: true,
              multiline: true,
            },
          ]}
          label="Void invoice"
          error={vm.error}
          onClose={() => setVoiding(null)}
          onSubmit={async (values) => {
            if (await vm.voidInvoice(voiding, values.reason)) setVoiding(null);
          }}
        />
      )}

      {viewing && (
        <InvoiceDialog
          org=""
          invoice={viewing}
          platform
          onClose={() => setViewing(null)}
        />
      )}
    </Stack>
  );
}
