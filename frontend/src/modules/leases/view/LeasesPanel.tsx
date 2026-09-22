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
import {
  leaseEndReasons,
  paymentMethods,
  type Lease,
  type LeaseEndReason,
  type NewLease,
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
  depositHeldOn: "",
};

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
  const [newLease, setNewLease] = useState(emptyLease);
  const [endingLease, setEndingLease] = useState<Lease | null>(null);
  const [endsOn, setEndsOn] = useState("");
  const [endReason, setEndReason] = useState<LeaseEndReason>("TERMINATED");
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
              setNewLease(emptyLease);
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
                <Button
                  color="warning"
                  onClick={() => {
                    setEndingLease(lease);
                    setEndsOn(lease.starts_on);
                    setEndReason("TERMINATED");
                  }}
                >
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
            <TextField
              select
              label="Resident"
              value={newLease.residentId}
              onChange={(e) =>
                setNewLease({ ...newLease, residentId: e.target.value })
              }
            >
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
              value={newLease.spaceId}
              onChange={(e) =>
                setNewLease({ ...newLease, spaceId: e.target.value })
              }
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
              value={newLease.startsOn}
              onChange={(e) =>
                setNewLease({ ...newLease, startsOn: e.target.value })
              }
            />
            <TextField
              label="Ends on (optional)"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              value={newLease.endsOn}
              onChange={(e) =>
                setNewLease({ ...newLease, endsOn: e.target.value })
              }
            />
            <TextField
              label="Monthly rent"
              type="number"
              value={newLease.rentAmount}
              onChange={(e) =>
                setNewLease({ ...newLease, rentAmount: e.target.value })
              }
            />
            <TextField
              label="First charge on"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              value={newLease.firstChargeOn}
              onChange={(e) =>
                setNewLease({ ...newLease, firstChargeOn: e.target.value })
              }
            />
            <TextField
              label="Deposit amount (optional)"
              type="number"
              value={newLease.depositAmount}
              onChange={(e) =>
                setNewLease({ ...newLease, depositAmount: e.target.value })
              }
            />
            <Button
              variant="contained"
              disabled={
                vm.busy ||
                !newLease.residentId ||
                !newLease.spaceId ||
                !newLease.startsOn ||
                !newLease.rentAmount ||
                !newLease.firstChargeOn
              }
              onClick={() => {
                const body: NewLease = {
                  residentId: newLease.residentId,
                  spaceId: newLease.spaceId,
                  startsOn: newLease.startsOn,
                  endsOn: newLease.endsOn || undefined,
                  rentAmount: Number(newLease.rentAmount),
                  firstChargeOn: newLease.firstChargeOn,
                  depositAmount: newLease.depositAmount
                    ? Number(newLease.depositAmount)
                    : undefined,
                  depositHeldOn: newLease.startsOn,
                };
                void vm.create(body).then((ok) => ok && setNewLeaseOpen(false));
              }}
            >
              Create lease
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>

      {endingLease && (
        <AdaptiveDialog
          open
          onClose={() => setEndingLease(null)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>End lease</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label="Ends on"
                type="date"
                slotProps={{ inputLabel: { shrink: true } }}
                value={endsOn}
                onChange={(e) => setEndsOn(e.target.value)}
              />
              <TextField
                select
                label="Reason"
                value={endReason}
                onChange={(e) => setEndReason(e.target.value as LeaseEndReason)}
              >
                {leaseEndReasons.map((reason) => (
                  <MenuItem key={reason} value={reason}>
                    {reason}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="contained"
                disabled={vm.busy || !endsOn}
                onClick={() =>
                  void vm
                    .end(endingLease.id, endsOn, endReason)
                    .then((ok) => ok && setEndingLease(null))
                }
              >
                End lease
              </Button>
            </Stack>
          </DialogContent>
        </AdaptiveDialog>
      )}

      {detailLease && (
        <LeaseDetailDialog
          org={org}
          building={building}
          lease={detailLease}
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
  canManageFinance,
  onClose,
}: {
  org: string;
  building: string;
  lease: string;
  canManageFinance: boolean;
  onClose: () => void;
}) {
  const detail = useLeaseDetail(org, building, lease);
  const vm = useLeases(org, building);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentReceivedOn, setPaymentReceivedOn] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositHeldOn, setDepositHeldOn] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundedOn, setRefundedOn] = useState("");

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
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
                <TextField
                  select
                  label="Method"
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as PaymentMethod)
                  }
                >
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
                  value={paymentReceivedOn}
                  onChange={(e) => setPaymentReceivedOn(e.target.value)}
                />
                <Button
                  variant="contained"
                  disabled={vm.busy || !paymentAmount || !paymentReceivedOn}
                  onClick={() =>
                    void vm
                      .recordPayment(lease, {
                        amount: Number(paymentAmount),
                        method: paymentMethod,
                        receivedOn: paymentReceivedOn,
                      })
                      .then((ok) => {
                        if (ok) {
                          setPaymentAmount("");
                          setPaymentReceivedOn("");
                        }
                      })
                  }
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
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
                <TextField
                  label="Held on"
                  type="date"
                  slotProps={{ inputLabel: { shrink: true } }}
                  value={depositHeldOn}
                  onChange={(e) => setDepositHeldOn(e.target.value)}
                />
                <Button
                  variant="outlined"
                  disabled={vm.busy || !depositAmount || !depositHeldOn}
                  onClick={() =>
                    void vm.recordDeposit(lease, {
                      amount: Number(depositAmount),
                      heldOn: depositHeldOn,
                    })
                  }
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
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                    />
                    <TextField
                      label="Refunded on"
                      type="date"
                      slotProps={{ inputLabel: { shrink: true } }}
                      value={refundedOn}
                      onChange={(e) => setRefundedOn(e.target.value)}
                    />
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        disabled={vm.busy || !refundAmount || !refundedOn}
                        onClick={() =>
                          void vm.refundDeposit(lease, {
                            refundedOn,
                            refundedAmount: Number(refundAmount),
                          })
                        }
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
          </Stack>
        )}
      </DialogContent>
    </AdaptiveDialog>
  );
}
