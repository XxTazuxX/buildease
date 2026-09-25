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
import { ScreeningDialog } from "@/modules/screening";
import { prospectStatuses, type ProspectStatus } from "../model/prospects";
import { useProspects, useProspectSpaces } from "../viewmodel/useProspects";

const terminalStatuses: ProspectStatus[] = ["LEASED", "REJECTED", "WITHDRAWN"];
const screenableStatuses: ProspectStatus[] = [
  "APPLIED",
  "SCREENING",
  "APPROVED",
  "REJECTED",
];

const emptyProspect = {
  spaceId: "",
  name: "",
  email: "",
  phone: "",
  notes: "",
};

export function ProspectsPanel({
  org,
  building,
}: {
  org: string;
  building: string;
}) {
  const [filter, setFilter] = useState<ProspectStatus | "">("");
  const vm = useProspects(org, building, filter || undefined);
  const spaces = useProspectSpaces(org, building);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyProspect);
  const [leaseIds, setLeaseIds] = useState<Record<string, string>>({});
  const [screeningProspect, setScreeningProspect] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const error = vm.error || vm.list.error?.message;

  const spaceName = (id: string) =>
    spaces.data?.find((item) => item.id === id)?.name ?? "Space";

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
            Leasing CRM
          </Typography>
          <Typography variant="h5">Prospects and applications</Typography>
          <Typography color="text.secondary">
            Track interest in vacant spaces from first contact through move-in.
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => {
            setForm(emptyProspect);
            setCreateOpen(true);
          }}
        >
          New prospect
        </Button>
      </Stack>
      <TextField
        select
        size="small"
        label="Filter by status"
        value={filter}
        onChange={(e) => setFilter(e.target.value as ProspectStatus | "")}
        sx={{ mt: 2, minWidth: 200 }}
      >
        <MenuItem value="">All statuses</MenuItem>
        {prospectStatuses.map((status) => (
          <MenuItem key={status} value={status}>
            {status}
          </MenuItem>
        ))}
      </TextField>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      <Stack spacing={1} sx={{ mt: 2 }}>
        {vm.list.data?.map((item) => {
          const terminal = terminalStatuses.includes(item.status);
          return (
            <Paper variant="outlined" key={item.id} sx={{ p: 1.75 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{ gap: 1.5, alignItems: { sm: "center" } }}
              >
                <Box sx={{ flexGrow: 1 }}>
                  <Typography sx={{ fontWeight: 750 }}>{item.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {spaceName(item.space_id)}
                    {item.email ? ` · ${item.email}` : ""}
                    {item.phone ? ` · ${item.phone}` : ""}
                  </Typography>
                </Box>
                <StatusChip
                  active={item.status === "LEASED"}
                  label={item.status}
                />
                {!terminal && (
                  <TextField
                    select
                    size="small"
                    label="Move to"
                    value=""
                    onChange={(e) =>
                      void vm.updateStatus(
                        item.id,
                        e.target.value as ProspectStatus,
                      )
                    }
                    sx={{ minWidth: 160 }}
                  >
                    {prospectStatuses
                      .filter(
                        (status) =>
                          status !== "LEASED" && status !== item.status,
                      )
                      .map((status) => (
                        <MenuItem key={status} value={status}>
                          {status}
                        </MenuItem>
                      ))}
                  </TextField>
                )}
                {screenableStatuses.includes(item.status) && (
                  <Button
                    onClick={() =>
                      setScreeningProspect({ id: item.id, name: item.name })
                    }
                  >
                    Screening
                  </Button>
                )}
                {item.status === "APPROVED" && (
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      label="Lease ID"
                      value={leaseIds[item.id] ?? ""}
                      onChange={(e) =>
                        setLeaseIds({ ...leaseIds, [item.id]: e.target.value })
                      }
                    />
                    <Button
                      size="small"
                      disabled={vm.busy || !leaseIds[item.id]}
                      onClick={() =>
                        void vm.linkLease(item.id, leaseIds[item.id])
                      }
                    >
                      Link lease
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Paper>
          );
        })}
        {vm.list.data?.length === 0 && (
          <Typography color="text.secondary">No prospects yet.</Typography>
        )}
      </Stack>

      <AdaptiveDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>New prospect</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Space"
              value={form.spaceId}
              onChange={(e) => setForm({ ...form, spaceId: e.target.value })}
            >
              {spaces.data
                ?.filter((item) => ["VACANT", "RESERVED"].includes(item.status))
                .map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name} · {item.code}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              label="Email (optional)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <TextField
              label="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <TextField
              label="Notes (optional)"
              multiline
              minRows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <Button
              variant="contained"
              disabled={vm.busy || !form.spaceId || !form.name.trim()}
              onClick={() =>
                void vm.create(form).then((ok) => ok && setCreateOpen(false))
              }
            >
              Add prospect
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>

      {screeningProspect && (
        <ScreeningDialog
          org={org}
          building={building}
          prospect={screeningProspect.id}
          prospectName={screeningProspect.name}
          onClose={() => setScreeningProspect(null)}
        />
      )}
    </Paper>
  );
}
