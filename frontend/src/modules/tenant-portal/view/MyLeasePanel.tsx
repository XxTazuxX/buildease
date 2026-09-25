import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  useLeases,
  useLeaseDetail,
} from "@/modules/leases/viewmodel/useLeases";
import { useAuth } from "@/modules/auth/viewmodel/AuthProvider";
import { SignaturePanel } from "@/modules/signing";

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
  const [payAmount, setPayAmount] = useState("");
  const balance = detail.data ? Number(detail.data.balance) : 0;
  useEffect(() => {
    if (balance > 0) setPayAmount(balance.toFixed(2));
  }, [balance]);
  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 3 }}>
      <Typography variant="overline" color="primary.main">
        My lease
      </Typography>
      <Typography variant="h5">Lease &amp; balance</Typography>
      {!lease ? (
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
              value={new Date(lease.next_charge_on).toLocaleDateString()}
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
                    Rent charge · due {new Date(c.due_on).toLocaleDateString()}
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
                    Payment · {new Date(p.received_on).toLocaleDateString()} (
                    {p.method})
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
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  size="small"
                  label="Amount"
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
                <Button
                  variant="contained"
                  disabled={vm.busy || !payAmount || Number(payAmount) <= 0}
                  onClick={() => void vm.payOnline(lease.id, Number(payAmount))}
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
