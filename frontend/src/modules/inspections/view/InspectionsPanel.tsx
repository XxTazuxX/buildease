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
import { Pager } from "@/shared/components/Pager";
import { StatusChip } from "@/shared/components/Surface";
import {
  conditions,
  inspectionTypes,
  type Condition,
  type InspectionType,
} from "../model/inspections";
import {
  useInspectionDetail,
  useInspectionResidents,
  useInspectionSpaces,
  useInspections,
} from "../viewmodel/useInspections";

const emptyInspection = {
  spaceId: "",
  leaseId: "",
  residentId: "",
  type: "MOVE_IN" as InspectionType,
  scheduledOn: new Date().toISOString().slice(0, 10),
};

export function InspectionsPanel({
  org,
  building,
}: {
  org: string;
  building: string;
}) {
  const [page, setPage] = useState(0);
  const vm = useInspections(org, building, page);
  const spaces = useInspectionSpaces(org, building);
  const residents = useInspectionResidents(org, building);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [form, setForm] = useState(emptyInspection);
  const [openInspection, setOpenInspection] = useState<string | null>(null);
  const error = vm.error || vm.list.error?.message;

  const spaceName = (id: string) =>
    spaces.data?.find((item) => item.id === id)?.name ?? "Space";

  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
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
            Inspections
          </Typography>
          <Typography variant="h5">
            Move-in, move-out, and routine checks
          </Typography>
          <Typography color="text.secondary">
            Record a room-by-room condition checklist with photos, and have
            residents acknowledge the result.
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => {
            setForm(emptyInspection);
            setScheduleOpen(true);
          }}
        >
          Schedule inspection
        </Button>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      <Stack spacing={1} sx={{ mt: 2 }}>
        {vm.list.data?.map((item) => (
          <Paper variant="outlined" key={item.id} sx={{ p: 1.75 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{ gap: 1, alignItems: { sm: "center" } }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 750 }}>
                  {item.type.replaceAll("_", " ")} · {spaceName(item.space_id)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Scheduled {item.scheduled_on}
                  {item.resident_acknowledged_at
                    ? " · Acknowledged by resident"
                    : ""}
                </Typography>
              </Box>
              <StatusChip
                active={item.status === "COMPLETED"}
                label={item.status}
              />
              <Button onClick={() => setOpenInspection(item.id)}>View</Button>
            </Stack>
          </Paper>
        ))}
        {vm.list.data?.length === 0 && (
          <Typography color="text.secondary">No inspections yet.</Typography>
        )}
      </Stack>
      <Pager page={page} count={vm.list.data?.length ?? 0} onChange={setPage} />

      <AdaptiveDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Schedule inspection</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Space"
              value={form.spaceId}
              onChange={(e) => setForm({ ...form, spaceId: e.target.value })}
            >
              {spaces.data?.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name} · {item.code}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Resident (optional)"
              value={form.residentId}
              onChange={(e) => setForm({ ...form, residentId: e.target.value })}
            >
              <MenuItem value="">No resident</MenuItem>
              {residents.data?.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.display_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Type"
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as InspectionType })
              }
            >
              {inspectionTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Scheduled on"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              value={form.scheduledOn}
              onChange={(e) =>
                setForm({ ...form, scheduledOn: e.target.value })
              }
            />
            <Button
              variant="contained"
              disabled={vm.busy || !form.spaceId || !form.scheduledOn}
              onClick={() =>
                void vm.create(form).then((ok) => ok && setScheduleOpen(false))
              }
            >
              Schedule
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>

      {openInspection && (
        <InspectionDetailDialog
          org={org}
          building={building}
          inspection={openInspection}
          onClose={() => setOpenInspection(null)}
        />
      )}
    </Paper>
  );
}

function InspectionDetailDialog({
  org,
  building,
  inspection,
  onClose,
}: {
  org: string;
  building: string;
  inspection: string;
  onClose: () => void;
}) {
  const detail = useInspectionDetail(org, building, inspection);
  const vm = useInspections(org, building, 0);
  const [area, setArea] = useState("");
  const [condition, setCondition] = useState<Condition>("GOOD");
  const [notes, setNotes] = useState("");

  return (
    <AdaptiveDialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Inspection detail</DialogTitle>
      <DialogContent>
        {detail.detail.isLoading && (
          <Typography color="text.secondary">Loading…</Typography>
        )}
        {detail.error && <Alert severity="error">{detail.error}</Alert>}
        {detail.detail.data && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <StatusChip
              active={detail.detail.data.status === "COMPLETED"}
              label={detail.detail.data.status}
            />
            <Divider />
            <Typography variant="overline" color="text.secondary">
              Checklist
            </Typography>
            {detail.detail.data.items.length === 0 && (
              <Typography color="text.secondary">No items recorded.</Typography>
            )}
            {detail.detail.data.items.map((item) => (
              <Typography key={item.id} variant="body2">
                {item.area} · {item.condition}
                {item.notes ? ` — ${item.notes}` : ""}
              </Typography>
            ))}
            {detail.detail.data.status === "DRAFT" && (
              <Stack spacing={1.5}>
                <TextField
                  label="Area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                />
                <TextField
                  select
                  label="Condition"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as Condition)}
                >
                  {conditions.map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <Button
                  variant="outlined"
                  disabled={detail.busy || !area.trim()}
                  onClick={() =>
                    void detail
                      .addItem({ area, condition, notes: notes || undefined })
                      .then((ok) => {
                        if (ok) {
                          setArea("");
                          setNotes("");
                        }
                      })
                  }
                >
                  Add item
                </Button>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void detail.uploadPhoto(file);
                    event.target.value = "";
                  }}
                />
              </Stack>
            )}
            <Divider />
            <Typography variant="overline" color="text.secondary">
              Photos
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {detail.detail.data.photos.length} photo
              {detail.detail.data.photos.length === 1 ? "" : "s"} attached
            </Typography>
            {detail.detail.data.status === "DRAFT" && (
              <Button
                variant="contained"
                disabled={vm.busy}
                onClick={() =>
                  void vm.complete(inspection).then((ok) => {
                    if (ok) void detail.detail.refetch();
                  })
                }
              >
                Complete inspection
              </Button>
            )}
            {detail.detail.data.status === "COMPLETED" &&
              !detail.detail.data.resident_acknowledged_at && (
                <Button
                  variant="outlined"
                  disabled={vm.busy}
                  onClick={() =>
                    void vm.acknowledge(inspection).then((ok) => {
                      if (ok) void detail.detail.refetch();
                    })
                  }
                >
                  Acknowledge inspection
                </Button>
              )}
          </Stack>
        )}
      </DialogContent>
    </AdaptiveDialog>
  );
}
