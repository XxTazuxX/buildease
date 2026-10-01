import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { StatusChip } from "@/shared/components/Surface";
import { useZodForm } from "@/shared/forms/useZodForm";
import { useAuth } from "@/modules/auth/viewmodel/AuthProvider";
import { SignaturePanel } from "@/modules/signing";
import {
  depositFormSchema,
  leaseEndFormSchema,
  leaseEndReasons,
  leaseFormSchema,
  paymentFormSchema,
  paymentMethods,
  refundFormSchema,
  type Lease,
  type LeaseEndReason,
  type PaymentMethod,
} from "../model/leases";
import { useLeaseDetail, useLeases } from "../viewmodel/useLeases";

const emptyLease = {
  residentId: "",
  spaceId: "",
  startsOn: "",
  endsOn: "",
  rentAmount: "",
  firstChargeOn: "",
  depositAmount: "",
};

function EndLeaseDialog({
  lease,
  busy,
  onEnd,
  close,
}: {
  lease: Lease;
  busy: boolean;
  onEnd: (endsOn: string, reason: LeaseEndReason) => Promise<boolean>;
  close: () => void;
}) {
  const form = useZodForm(leaseEndFormSchema(lease.starts_on), {
    endsOn: lease.starts_on,
    reason: "TERMINATED" as LeaseEndReason,
  });
  return (
    <AdaptiveDialog open onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>End lease</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Ends on"
            type="date"
            slotProps={{ inputLabel: { shrink: true } }}
            {...form.field("endsOn")}
          />
          <TextField select label="Reason" {...form.field("reason")}>
            {leaseEndReasons.map((reason) => (
              <MenuItem key={reason} value={reason}>
                {reason}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            disabled={busy}
            onClick={form.submit(async (values) => {
              if (await onEnd(values.endsOn, values.reason)) close();
            })}
          >
            End lease
          </Button>
        </Stack>
      </DialogContent>
    </AdaptiveDialog>
  );
}

export function LeasesPanel({
  org,
  building,
  canManage,
  canManageFinance,
}: {
  org: string;
  building: string;
  canManage: boolean;
  canManageFinance: boolean;
}) {
  const vm = useLeases(org, building);
  const [newLeaseOpen, setNewLeaseOpen] = useState(false);
  const newLease = useZodForm(leaseFormSchema, emptyLease);
  const [endingLease, setEndingLease] = useState<Lease | null>(null);
  const [detailLease, setDetailLease] = useState<string | null>(null);
  const error = vm.error || vm.leases.error?.message;

  const residentName = (id: string) =>
    vm.residents.data?.find((item) => item.id === id)?.display_name ??
    "Resident";
  const spaceName = (id: string) =>
    vm.spaces.data?.find((item) => item.id === id)?.name ?? "Space";

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
            Leases
          </Typography>
          <Typography variant="h5">Leases and rent</Typography>
          <Typography color="text.secondary">
            Lease terms, rent charges, deposits, and payments.
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            onClick={() => {
              newLease.reset(emptyLease);
              setNewLeaseOpen(true);
            }}
          >
            New lease
          </Button>
        )}
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      <Stack spacing={1} sx={{ mt: 2 }}>
        {vm.leases.data?.map((lease) => (
          <Paper variant="outlined" key={lease.id} sx={{ p: 1.75 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{ gap: 1, alignItems: { sm: "center" } }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 750 }}>
                  {residentName(lease.resident_id)} ·{" "}
                  {spaceName(lease.space_id)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {lease.rent_amount} {lease.currency} / month · Starts{" "}
                  {lease.starts_on}
                </Typography>
              </Box>
              <StatusChip
                active={lease.status === "ACTIVE"}
                label={lease.status}
              />
              <Button onClick={() => setDetailLease(lease.id)}>View</Button>
              {canManage && lease.status === "DRAFT" && (
                <>
                  <Button
                    variant="contained"
                    disabled={vm.busy}
                    onClick={() => void vm.activate(lease.id)}
                  >
                    Activate
                  </Button>
                  <Button
                    color="error"
                    disabled={vm.busy}
                    onClick={() => void vm.cancel(lease.id)}
                  >
                    Cancel
                  </Button>
                </>
              )}
              {canManage && lease.status === "ACTIVE" && (
                <Button color="warning" onClick={() => setEndingLease(lease)}>
                  End lease
                </Button>
              )}
            </Stack>
          </Paper>
        ))}
        {vm.leases.data?.length === 0 && (
          <Typography color="text.secondary">No leases yet.</Typography>
        )}
      </Stack>

      <AdaptiveDialog
        open={newLeaseOpen}
        onClose={() => setNewLeaseOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>New lease</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField select label="Resident" {...newLease.field("residentId")}>
              {vm.residents.data
                ?.filter((item) => item.active)
                .map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.display_name}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              select
              label="Rentable space"
              {...newLease.field("spaceId")}
            >
              {vm.spaces.data
                ?.filter((item) => ["VACANT", "RESERVED"].includes(item.status))
                .map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name} · {item.code}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              label="Starts on"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...newLease.field("startsOn")}
            />
            <TextField
              label="Ends on (optional)"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...newLease.field("endsOn")}
            />
            <TextField
              label="Monthly rent"
              type="number"
              {...newLease.field("rentAmount")}
            />
            <TextField
              label="First charge on"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...newLease.field("firstChargeOn")}
            />
            <TextField
              label="Deposit amount (optional)"
              type="number"
              {...newLease.field("depositAmount")}
            />
            <Button
              variant="contained"
              disabled={vm.busy}
              onClick={newLease.submit(async (values) => {
                const ok = await vm.create({
                  ...values,
                  depositHeldOn: values.startsOn,
                });
                if (ok) setNewLeaseOpen(false);
              })}
            >
              Create lease
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>

      {endingLease && (
        <EndLeaseDialog
          lease={endingLease}
          busy={vm.busy}
          close={() => setEndingLease(null)}
          onEnd={(endsOn, reason) => vm.end(endingLease.id, endsOn, reason)}
        />
      )}

      {detailLease && (
        <LeaseDetailDialog
          org={org}
          building={building}
          lease={detailLease}
          canManage={canManage}
          canManageFinance={canManageFinance}
          onClose={() => setDetailLease(null)}
        />
      )}
    </Paper>
  );
}

function LeaseDetailDialog({
  org,
  building,
  lease,
  canManage,
  canManageFinance,
  onClose,
}: {
  org: string;
  building: string;
  lease: string;
  canManage: boolean;
  canManageFinance: boolean;
  onClose: () => void;
}) {
  const auth = useAuth();
  const detail = useLeaseDetail(org, building, lease);
  const vm = useLeases(org, building);
  const payment = useZodForm(paymentFormSchema, {
    amount: "",
    method: "CASH" as PaymentMethod,
    receivedOn: "",
  });
  const deposit = useZodForm(depositFormSchema, { amount: "", heldOn: "" });
  const refund = useZodForm(
    refundFormSchema(Number(detail.data?.deposit?.amount ?? 0)),
    { refundedAmount: "", refundedOn: "" },
  );

  return (
    <AdaptiveDialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Lease detail</DialogTitle>
      <DialogContent>
        {detail.isLoading && (
          <Typography color="text.secondary">Loading…</Typography>
        )}
        {detail.data && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <StatusChip
              active={detail.data.status === "ACTIVE"}
              label={detail.data.status}
            />
            <Typography variant="h6">
              Balance: {detail.data.balance} {detail.data.currency}
            </Typography>
            <Divider />
            <Typography variant="overline" color="text.secondary">
              Charges
            </Typography>
            {detail.data.charges.length === 0 && (
              <Typography color="text.secondary">No charges yet.</Typography>
            )}
            {detail.data.charges.map((charge) => (
              <Typography key={charge.id} variant="body2">
                {charge.due_on} · {charge.amount} {charge.currency}
              </Typography>
            ))}
            <Divider />
            <Typography variant="overline" color="text.secondary">
              Payments
            </Typography>
            {detail.data.payments.length === 0 && (
              <Typography color="text.secondary">
                No payments recorded.
              </Typography>
            )}
            {detail.data.payments.map((payment) => (
              <Typography key={payment.id} variant="body2">
                {payment.received_on} · {payment.amount} {payment.currency} ·{" "}
                {payment.method}
              </Typography>
            ))}
            {canManageFinance && (
              <Stack spacing={1.5}>
                <Divider />
                <Typography variant="overline" color="text.secondary">
                  Record payment
                </Typography>
                {vm.error && <Alert severity="error">{vm.error}</Alert>}
                <TextField
                  label="Amount"
                  type="number"
                  {...payment.field("amount")}
                />
                <TextField select label="Method" {...payment.field("method")}>
                  {paymentMethods.map((method) => (
                    <MenuItem key={method} value={method}>
                      {method}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Received on"
                  type="date"
                  slotProps={{ inputLabel: { shrink: true } }}
                  {...payment.field("receivedOn")}
                />
                <Button
                  variant="contained"
                  disabled={vm.busy}
                  onClick={payment.submit(async (values) => {
                    const ok = await vm.recordPayment(lease, values);
                    if (ok)
                      payment.reset({
                        amount: "",
                        method: values.method,
                        receivedOn: "",
                      });
                  })}
                >
                  Record payment
                </Button>
              </Stack>
            )}
            <Divider />
            <Typography variant="overline" color="text.secondary">
              Deposit
            </Typography>
            {!detail.data.deposit && canManageFinance && (
              <Stack spacing={1.5}>
                <TextField
                  label="Deposit amount"
                  type="number"
                  {...deposit.field("amount")}
                />
                <TextField
                  label="Held on"
                  type="date"
                  slotProps={{ inputLabel: { shrink: true } }}
                  {...deposit.field("heldOn")}
                />
                <Button
                  variant="outlined"
                  disabled={vm.busy}
                  onClick={deposit.submit((values) =>
                    vm.recordDeposit(lease, values),
                  )}
                >
                  Record deposit
                </Button>
              </Stack>
            )}
            {!detail.data.deposit && !canManageFinance && (
              <Typography color="text.secondary">
                No deposit recorded.
              </Typography>
            )}
            {detail.data.deposit && (
              <Stack spacing={1}>
                <Typography variant="body2">
                  {detail.data.deposit.status} · {detail.data.deposit.amount}{" "}
                  {detail.data.currency}
                </Typography>
                {detail.data.deposit.status === "HELD" && canManageFinance && (
                  <Stack spacing={1.5}>
                    <TextField
                      label="Refund amount"
                      type="number"
                      {...refund.field("refundedAmount")}
                    />
                    <TextField
                      label="Refunded on"
                      type="date"
                      slotProps={{ inputLabel: { shrink: true } }}
                      {...refund.field("refundedOn")}
                    />
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        disabled={vm.busy}
                        onClick={refund.submit((values) =>
                          vm.refundDeposit(lease, values),
                        )}
                      >
                        Refund deposit
                      </Button>
                      <Button
                        color="error"
                        disabled={vm.busy}
                        onClick={() =>
                          void vm.forfeitDeposit(
                            lease,
                            "Forfeited by owner decision",
                          )
                        }
                      >
                        Forfeit deposit
                      </Button>
                    </Stack>
                  </Stack>
                )}
              </Stack>
            )}
            <Divider />
            <SignaturePanel
              org={org}
              building={building}
              lease={lease}
              role="OWNER"
              defaultName={auth.profile?.display_name ?? ""}
              canSign={canManage}
            />
          </Stack>
        )}
      </DialogContent>
    </AdaptiveDialog>
  );
}
