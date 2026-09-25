import { useState } from "react";
import {
  Alert,
  Box,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  useIncomeStatement,
  useLeasesForStatement,
  useLeaseStatement,
  useRentRoll,
} from "../viewmodel/useReporting";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

export function ReportsPanel({
  org,
  building,
}: {
  org: string;
  building: string;
}) {
  const [tab, setTab] = useState<"rent-roll" | "income" | "statement">(
    "rent-roll",
  );
  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Typography variant="overline" color="primary.main">
        Reports
      </Typography>
      <Typography variant="h5">Financial reports</Typography>
      <Typography color="text.secondary">
        Rent roll, income summary, and per-lease statements for this building.
      </Typography>
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        sx={{ mt: 2, mb: 2 }}
      >
        <Tab value="rent-roll" label="Rent roll" />
        <Tab value="income" label="Income statement" />
        <Tab value="statement" label="Lease statement" />
      </Tabs>
      {tab === "rent-roll" && <RentRollTab org={org} building={building} />}
      {tab === "income" && <IncomeStatementTab org={org} building={building} />}
      {tab === "statement" && (
        <LeaseStatementTab org={org} building={building} />
      )}
    </Paper>
  );
}

function RentRollTab({ org, building }: { org: string; building: string }) {
  const query = useRentRoll(org, building);
  return (
    <Stack spacing={1}>
      {query.error && <Alert severity="error">{query.error.message}</Alert>}
      {query.data?.length === 0 && (
        <Typography color="text.secondary">
          No active leases in this building.
        </Typography>
      )}
      {query.data?.map((row) => (
        <Paper key={row.lease_id} variant="outlined" sx={{ p: 1.75 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            sx={{ gap: 1, justifyContent: "space-between" }}
          >
            <Box>
              <Typography sx={{ fontWeight: 700 }}>
                {row.resident_name} · {row.space_name} ({row.space_code})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {row.rent_amount} {row.currency} / month · Next charge{" "}
                {row.next_charge_on}
              </Typography>
            </Box>
            <Box sx={{ textAlign: { sm: "right" } }}>
              <Typography sx={{ fontWeight: 700 }}>
                Balance {row.balance} {row.currency}
              </Typography>
              {row.deposit_status && (
                <Typography variant="body2" color="text.secondary">
                  Deposit {row.deposit_status.toLowerCase()} ·{" "}
                  {row.deposit_amount} {row.currency}
                </Typography>
              )}
            </Box>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function IncomeStatementTab({
  org,
  building,
}: {
  org: string;
  building: string;
}) {
  const [from, setFrom] = useState(firstOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const query = useIncomeStatement(org, building, from, to);
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField
          label="From"
          type="date"
          slotProps={{ inputLabel: { shrink: true } }}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <TextField
          label="To"
          type="date"
          slotProps={{ inputLabel: { shrink: true } }}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </Stack>
      {query.error && <Alert severity="error">{query.error.message}</Alert>}
      {query.data && (
        <Stack spacing={1}>
          <Typography variant="body1">
            Charged in period: {query.data.totalCharged}
          </Typography>
          <Typography variant="body1">
            Collected in period: {query.data.totalCollected}
          </Typography>
          <Typography variant="h6">
            Outstanding balance as of {query.data.to}:{" "}
            {query.data.outstandingBalance}
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}

function LeaseStatementTab({
  org,
  building,
}: {
  org: string;
  building: string;
}) {
  const leases = useLeasesForStatement(org, building);
  const [lease, setLease] = useState("");
  const [from, setFrom] = useState(firstOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const query = useLeaseStatement(org, building, lease, from, to);
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField
          select
          label="Lease"
          value={lease}
          onChange={(e) => setLease(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          {leases.data?.map((item) => (
            <MenuItem key={item.id} value={item.id}>
              {item.status} · {item.rent_amount} {item.currency}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="From"
          type="date"
          slotProps={{ inputLabel: { shrink: true } }}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <TextField
          label="To"
          type="date"
          slotProps={{ inputLabel: { shrink: true } }}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </Stack>
      {query.error && <Alert severity="error">{query.error.message}</Alert>}
      {!lease && (
        <Typography color="text.secondary">
          Select a lease to view its statement.
        </Typography>
      )}
      {query.data && (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            Opening balance: {query.data.openingBalance}
          </Typography>
          {query.data.lines.map((line) => (
            <Stack
              key={line.id}
              direction="row"
              sx={{ justifyContent: "space-between" }}
            >
              <Typography variant="body2">
                {line.date} ·{" "}
                {line.kind === "CHARGE"
                  ? line.label
                  : `Payment (${line.label})`}
              </Typography>
              <Typography variant="body2">
                {line.kind === "CHARGE" ? "+" : "-"}
                {line.amount} → {line.runningBalance}
              </Typography>
            </Stack>
          ))}
          <Typography variant="h6">
            Closing balance: {query.data.closingBalance}
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}
