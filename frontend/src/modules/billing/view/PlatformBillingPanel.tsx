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
import { QueryError } from "@/shared/components/QueryError";
import { formatDate } from "@/shared/utils/dates";
import {
  billingCycles,
  invoiceStatuses,
  limitLabel,
  money,
  subscriptionStatuses,
  type BillingCycle,
  type InvoiceStatus,
  type NewInvoice,
  type Plan,
  type PlanInput,
  type SubscriptionRow,
  type SubscriptionStatus,
} from "../model/billing";
import { usePlatformBilling } from "../viewmodel/useBilling";
import { InvoiceDialog } from "./InvoiceDocument";
import { InvoiceStatusChip, SubscriptionStatusChip } from "./InvoiceStatusChip";

type Section = "subscriptions" | "invoices" | "plans";

const emptyPlan: PlanInput = {
  code: "",
  name: "",
  description: "",
  monthlyPrice: 0,
  annualPrice: 0,
  currency: "USD",
  maxBuildings: null,
  maxSpaces: null,
  maxStaff: null,
  features: [],
  trialDays: 0,
  publiclyListed: true,
  active: true,
  sortOrder: 10,
};

function planToInput(plan: Plan): PlanInput {
  return {
    code: plan.code,
    name: plan.name,
    description: plan.description ?? "",
    monthlyPrice: Number(plan.monthly_price),
    annualPrice: Number(plan.annual_price),
    currency: plan.currency,
    maxBuildings: plan.max_buildings,
    maxSpaces: plan.max_spaces,
    maxStaff: plan.max_staff,
    features: plan.features,
    trialDays: plan.trial_days,
    publiclyListed: plan.public,
    active: plan.active,
    sortOrder: plan.sort_order,
  };
}

const limitValue = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);
const parseLimit = (value: string) =>
  value.trim() === "" ? null : Number(value);

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
  const [assignment, setAssignment] = useState({
    planId: "",
    status: "ACTIVE" as SubscriptionStatus,
    cycle: "MONTHLY" as BillingCycle,
    trialEndsOn: "",
    periodEnd: "",
  });
  const [editingPlan, setEditingPlan] = useState<{
    id: string | null;
    input: PlanInput;
    features: string;
  } | null>(null);
  const [newInvoice, setNewInvoice] = useState<NewInvoice | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const summary = vm.summary.data;
  const currency = summary?.currency ?? "USD";

  const openManage = (row: SubscriptionRow) => {
    vm.clearError();
    setManaging(row);
    setAssignment({
      planId: row.requested_plan_id ?? row.plan_id ?? "",
      status:
        row.status === "TRIALING" && row.requested_plan_id
          ? "ACTIVE"
          : (row.status ?? "ACTIVE"),
      cycle: row.requested_cycle ?? row.billing_cycle ?? "MONTHLY",
      trialEndsOn: row.trial_ends_on ?? "",
      periodEnd: "",
    });
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
      {vm.error && !managing && !editingPlan && !newInvoice && (
        <Alert severity="error">{vm.error}</Alert>
      )}
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
                  setNewInvoice({
                    organizationId: "",
                    fromPlan: true,
                    description: "",
                    amount: undefined,
                    tax: undefined,
                    notes: "",
                  });
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
                            const method = window.prompt(
                              "Payment method (e.g. Bank transfer)",
                              "Bank transfer",
                            );
                            if (method === null) return;
                            const reference =
                              window.prompt("Payment reference (optional)") ??
                              "";
                            void vm.pay(invoice.id, method, reference);
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
                            const reason = window.prompt("Reason for voiding");
                            if (reason !== null)
                              void vm.voidInvoice(invoice.id, reason);
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
                  setEditingPlan({ id: null, input: emptyPlan, features: "" });
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
                          setEditingPlan({
                            id: plan.id,
                            input: planToInput(plan),
                            features: plan.features.join("\n"),
                          });
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
        <AdaptiveDialog
          open
          onClose={() => setManaging(null)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>{managing.organization_name}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {vm.error && <Alert severity="error">{vm.error}</Alert>}
              <TextField
                select
                label="Plan"
                value={assignment.planId}
                onChange={(e) =>
                  setAssignment({ ...assignment, planId: e.target.value })
                }
              >
                {vm.plans.data?.map((plan) => (
                  <MenuItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Status"
                value={assignment.status}
                onChange={(e) =>
                  setAssignment({
                    ...assignment,
                    status: e.target.value as SubscriptionStatus,
                  })
                }
                helperText={
                  assignment.status === "SUSPENDED"
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
              <TextField
                select
                label="Billing cycle"
                value={assignment.cycle}
                onChange={(e) =>
                  setAssignment({
                    ...assignment,
                    cycle: e.target.value as BillingCycle,
                  })
                }
              >
                {billingCycles.map((cycle) => (
                  <MenuItem key={cycle} value={cycle}>
                    {cycle.toLowerCase()}
                  </MenuItem>
                ))}
              </TextField>
              {assignment.status === "TRIALING" && (
                <TextField
                  label="Trial ends"
                  type="date"
                  value={assignment.trialEndsOn}
                  onChange={(e) =>
                    setAssignment({
                      ...assignment,
                      trialEndsOn: e.target.value,
                    })
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              )}
              <TextField
                label="Current period ends (optional)"
                type="date"
                value={assignment.periodEnd}
                onChange={(e) =>
                  setAssignment({ ...assignment, periodEnd: e.target.value })
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setManaging(null)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={vm.busy || !assignment.planId}
              onClick={() =>
                void vm
                  .assign(managing.organization_id, {
                    planId: assignment.planId,
                    status: assignment.status,
                    cycle: assignment.cycle,
                    trialEndsOn: assignment.trialEndsOn || undefined,
                    periodEnd: assignment.periodEnd || undefined,
                  })
                  .then((ok) => ok && setManaging(null))
              }
            >
              Save subscription
            </Button>
          </DialogActions>
        </AdaptiveDialog>
      )}

      {editingPlan && (
        <AdaptiveDialog
          open
          onClose={() => setEditingPlan(null)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>{editingPlan.id ? "Edit plan" : "New plan"}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {vm.error && <Alert severity="error">{vm.error}</Alert>}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Code"
                  value={editingPlan.input.code}
                  disabled={!!editingPlan.id}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      input: { ...editingPlan.input, code: e.target.value },
                    })
                  }
                  fullWidth
                />
                <TextField
                  label="Name"
                  value={editingPlan.input.name}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      input: { ...editingPlan.input, name: e.target.value },
                    })
                  }
                  fullWidth
                />
              </Stack>
              <TextField
                label="Description"
                value={editingPlan.input.description}
                onChange={(e) =>
                  setEditingPlan({
                    ...editingPlan,
                    input: {
                      ...editingPlan.input,
                      description: e.target.value,
                    },
                  })
                }
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Monthly price"
                  type="number"
                  value={editingPlan.input.monthlyPrice}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      input: {
                        ...editingPlan.input,
                        monthlyPrice: Number(e.target.value),
                      },
                    })
                  }
                  fullWidth
                />
                <TextField
                  label="Annual price"
                  type="number"
                  value={editingPlan.input.annualPrice}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      input: {
                        ...editingPlan.input,
                        annualPrice: Number(e.target.value),
                      },
                    })
                  }
                  fullWidth
                />
                <TextField
                  label="Currency"
                  value={editingPlan.input.currency}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      input: {
                        ...editingPlan.input,
                        currency: e.target.value.toUpperCase(),
                      },
                    })
                  }
                  sx={{ width: { sm: 120 } }}
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
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
                    helperText="Blank = unlimited"
                    value={limitValue(editingPlan.input[field])}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        input: {
                          ...editingPlan.input,
                          [field]: parseLimit(e.target.value),
                        },
                      })
                    }
                    fullWidth
                  />
                ))}
              </Stack>
              <TextField
                label="Features (one per line)"
                multiline
                minRows={3}
                value={editingPlan.features}
                onChange={(e) =>
                  setEditingPlan({ ...editingPlan, features: e.target.value })
                }
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Trial days"
                  type="number"
                  value={editingPlan.input.trialDays}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      input: {
                        ...editingPlan.input,
                        trialDays: Number(e.target.value),
                      },
                    })
                  }
                  fullWidth
                />
                <TextField
                  label="Sort order"
                  type="number"
                  value={editingPlan.input.sortOrder}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      input: {
                        ...editingPlan.input,
                        sortOrder: Number(e.target.value),
                      },
                    })
                  }
                  fullWidth
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={editingPlan.input.publiclyListed}
                      onChange={(_, checked) =>
                        setEditingPlan({
                          ...editingPlan,
                          input: {
                            ...editingPlan.input,
                            publiclyListed: checked,
                          },
                        })
                      }
                    />
                  }
                  label="Show on pricing page"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={editingPlan.input.active}
                      onChange={(_, checked) =>
                        setEditingPlan({
                          ...editingPlan,
                          input: { ...editingPlan.input, active: checked },
                        })
                      }
                    />
                  }
                  label="Active"
                />
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingPlan(null)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={vm.busy}
              onClick={() =>
                void vm
                  .savePlan(editingPlan.id, {
                    ...editingPlan.input,
                    features: editingPlan.features
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                  })
                  .then((ok) => ok && setEditingPlan(null))
              }
            >
              Save plan
            </Button>
          </DialogActions>
        </AdaptiveDialog>
      )}

      {newInvoice && (
        <AdaptiveDialog
          open
          onClose={() => setNewInvoice(null)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>New invoice</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {vm.error && <Alert severity="error">{vm.error}</Alert>}
              <TextField
                select
                label="Organization"
                value={newInvoice.organizationId}
                onChange={(e) =>
                  setNewInvoice({
                    ...newInvoice,
                    organizationId: e.target.value,
                  })
                }
              >
                {vm.subscriptions.data?.map((row) => (
                  <MenuItem
                    key={row.organization_id}
                    value={row.organization_id}
                  >
                    {row.organization_name}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newInvoice.fromPlan}
                    onChange={(_, checked) =>
                      setNewInvoice({ ...newInvoice, fromPlan: checked })
                    }
                  />
                }
                label="Bill the current plan and period"
              />
              {!newInvoice.fromPlan && (
                <>
                  <TextField
                    label="Description"
                    value={newInvoice.description}
                    onChange={(e) =>
                      setNewInvoice({
                        ...newInvoice,
                        description: e.target.value,
                      })
                    }
                  />
                  <TextField
                    label="Amount"
                    type="number"
                    value={newInvoice.amount ?? ""}
                    onChange={(e) =>
                      setNewInvoice({
                        ...newInvoice,
                        amount:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                  />
                </>
              )}
              <TextField
                label="Tax (optional)"
                type="number"
                value={newInvoice.tax ?? ""}
                onChange={(e) =>
                  setNewInvoice({
                    ...newInvoice,
                    tax:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              />
              <TextField
                label="Notes (optional)"
                multiline
                minRows={2}
                value={newInvoice.notes}
                onChange={(e) =>
                  setNewInvoice({ ...newInvoice, notes: e.target.value })
                }
              />
              <Typography variant="caption" color="text.secondary">
                The invoice is saved as a draft; issue it to email the customer.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setNewInvoice(null)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={vm.busy || !newInvoice.organizationId}
              onClick={() =>
                void vm
                  .createInvoice(newInvoice)
                  .then((ok) => ok && setNewInvoice(null))
              }
            >
              Create draft
            </Button>
          </DialogActions>
        </AdaptiveDialog>
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
