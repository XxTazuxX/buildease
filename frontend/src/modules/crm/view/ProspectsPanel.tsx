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
import { ScreeningDialog } from "@/modules/screening";
import {
  linkLeaseSchema,
  newProspectSchema,
  prospectStatuses,
  type ProspectStatus,
} from "../model/prospects";
import { useProspects, useProspectSpaces } from "../viewmodel/useProspects";

function LinkLeaseForm({
  busy,
  onLink,
}: {
  busy: boolean;
  onLink: (leaseId: string) => Promise<unknown>;
}) {
  const form = useZodForm(linkLeaseSchema, { leaseId: "" });
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
      <TextField size="small" label="Lease ID" {...form.field("leaseId")} />
      <Button
        size="small"
        disabled={busy}
        onClick={form.submit((values) => onLink(values.leaseId))}
      >
        Link lease
      </Button>
    </Stack>
  );
}

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
  const form = useZodForm(newProspectSchema, emptyProspect);
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
            form.reset(emptyProspect);
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
                  <LinkLeaseForm
                    busy={vm.busy}
                    onLink={(leaseId) => vm.linkLease(item.id, leaseId)}
                  />
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
            <TextField select label="Space" {...form.field("spaceId")}>
              {spaces.data
                ?.filter((item) => ["VACANT", "RESERVED"].includes(item.status))
                .map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name} · {item.code}
                  </MenuItem>
                ))}
            </TextField>
            <TextField label="Name" {...form.field("name")} />
            <TextField label="Email (optional)" {...form.field("email")} />
            <TextField label="Phone (optional)" {...form.field("phone")} />
            <TextField
              label="Notes (optional)"
              multiline
              minRows={2}
              {...form.field("notes")}
            />
            <Button
              variant="contained"
              disabled={vm.busy}
              onClick={form.submit(async (values) => {
                if (await vm.create(values)) setCreateOpen(false);
              })}
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
