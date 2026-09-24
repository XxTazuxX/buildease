import { useMemo } from "react";
import { Divider, Paper, Stack, Typography } from "@mui/material";
import {
  useLeases,
  useLeaseDetail,
} from "@/modules/leases/viewmodel/useLeases";

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
  const { leases } = useLeases(org, building);
  const lease = useMemo(() => {
    const list = leases.data ?? [];
    return (
      list.find((l) => l.status === "ACTIVE") ??
      [...list].sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0]
    );
  }, [leases.data]);
  const detail = useLeaseDetail(org, building, lease?.id ?? "");
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
        </Stack>
      )}
    </Paper>
  );
}
