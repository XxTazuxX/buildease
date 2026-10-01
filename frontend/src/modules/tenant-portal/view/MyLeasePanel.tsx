import { useEffect, useMemo } from "react";
import {
  Alert,
  Button,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { onlinePaymentFormSchema } from "@/modules/leases/model/leases";
import {
  useLeases,
  useLeaseDetail,
} from "@/modules/leases/viewmodel/useLeases";
import { useAuth } from "@/modules/auth/viewmodel/AuthProvider";
import { SignaturePanel } from "@/modules/signing";
import { QueryError } from "@/shared/components/QueryError";
import { useZodForm } from "@/shared/forms/useZodForm";
import { formatDate } from "@/shared/utils/dates";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Stack>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700 }}>{value}</Typography>
    </Stack>
  );
}

export function MyLeasePanel({
  org,
  building,
}: {
  org: string;
  building: string;
}) {
  const auth = useAuth();
  const vm = useLeases(org, building);
  const lease = useMemo(() => {
    const list = vm.leases.data ?? [];
    return (
      list.find((l) => l.status === "ACTIVE") ??
      [...list].sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0]
    );
  }, [vm.leases.data]);
  const detail = useLeaseDetail(org, building, lease?.id ?? "");
  const balance = detail.data ? Number(detail.data.balance) : 0;
  const ceiling = Math.max(balance, 0) + Number(lease?.rent_amount ?? 0);
  const pay = useZodForm(onlinePaymentFormSchema(ceiling), { amount: "" });
  const { reset: resetPay } = pay;
  useEffect(() => {
    if (balance > 0) resetPay({ amount: balance.toFixed(2) });
  }, [balance, resetPay]);
  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 3 }}>
      <Typography variant="overline" color="primary.main">
        My lease
      </Typography>
      <Typography variant="h5">Lease &amp; balance</Typography>
      <QueryError queries={[vm.leases, detail]} what="your lease" />
      {vm.leases.isError ? null : !lease ? (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          No lease on file yet.
        </Typography>
      ) : (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
            <Stat label="Status" value={lease.status} />
            <Stat
              label="Rent"
              value={`${lease.rent_amount} ${lease.currency}`}
            />
            <Stat
              label="Next charge"
              value={formatDate(lease.next_charge_on)}
            />
            <Stat
              label="Balance"
              value={
                detail.data ? `${detail.data.balance} ${lease.currency}` : "—"
              }
            />
          </Stack>
          <Divider />
          <Typography variant="subtitle2">Charges &amp; payments</Typography>
          {!detail.data?.charges.length && !detail.data?.payments.length ? (
            <Typography variant="body2" color="text.secondary">
              No charges yet.
            </Typography>
          ) : (
            <Stack spacing={0.75}>
              {detail.data?.charges.map((c) => (
                <Stack
                  key={c.id}
                  direction="row"
                  sx={{ justifyContent: "space-between" }}
                >
                  <Typography variant="body2">
                    Rent charge · due {formatDate(c.due_on)}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {c.amount} {c.currency}
                  </Typography>
                </Stack>
              ))}
              {detail.data?.payments.map((p) => (
                <Stack
                  key={p.id}
                  direction="row"
                  sx={{ justifyContent: "space-between" }}
                >
                  <Typography variant="body2">
                    Payment · {formatDate(p.received_on)} ({p.method})
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 700, color: "success.main" }}
                  >
                    -{p.amount} {p.currency}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
          {lease.status === "ACTIVE" && balance > 0 && (
            <>
              <Divider />
              <Typography variant="subtitle2">Pay rent online</Typography>
              {vm.error && <Alert severity="error">{vm.error}</Alert>}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ alignItems: { sm: "flex-start" } }}
              >
                <TextField
                  size="small"
                  label="Amount"
                  type="number"
                  {...pay.field("amount")}
                />
                <Button
                  variant="contained"
                  disabled={vm.busy}
                  onClick={pay.submit((values) =>
                    vm.payOnline(lease.id, values.amount),
                  )}
                >
                  Pay now
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Processed through a sandbox test payment gateway.
              </Typography>
            </>
          )}
          {detail.data?.deposit && (
            <>
              <Divider />
              <Typography variant="subtitle2">Security deposit</Typography>
              <Typography variant="body2" color="text.secondary">
                {detail.data.deposit.status} · {detail.data.deposit.amount}{" "}
                {lease.currency}
              </Typography>
            </>
          )}
          <Divider />
          <SignaturePanel
            org={org}
            building={building}
            lease={lease.id}
            role="RESIDENT"
            defaultName={auth.profile?.display_name ?? ""}
          />
        </Stack>
      )}
    </Paper>
  );
}
