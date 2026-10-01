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
import { useZodForm } from "@/shared/forms/useZodForm";
import {
  conditions,
  inspectionFormSchema,
  inspectionTypes,
  itemSchema,
  type Condition,
  type InspectionType,
} from "../model/inspections";
import {
  useInspectionDetail,
  useInspectionResidents,
  useInspectionSpaces,
  useInspections,
} from "../viewmodel/useInspections";
import { todayIso } from "@/shared/utils/dates";

const emptyInspection = () => ({
  spaceId: "",
  residentId: "",
  type: "MOVE_IN" as InspectionType,
  scheduledOn: todayIso(),
});

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
  const form = useZodForm(inspectionFormSchema, emptyInspection());
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
            form.reset(emptyInspection());
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
            <TextField select label="Space" {...form.field("spaceId")}>
              {spaces.data?.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name} · {item.code}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Resident (optional)"
              {...form.field("residentId")}
            >
              <MenuItem value="">No resident</MenuItem>
              {residents.data?.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.display_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Type" {...form.field("type")}>
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
              {...form.field("scheduledOn")}
            />
            <Button
              variant="contained"
              disabled={vm.busy}
              onClick={form.submit(async (values) => {
                if (await vm.create(values)) setScheduleOpen(false);
              })}
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
  const item = useZodForm(itemSchema, {
    area: "",
    condition: "GOOD" as Condition,
    notes: "",
  });

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
                <TextField label="Area" {...item.field("area")} />
                <TextField select label="Condition" {...item.field("condition")}>
                  {conditions.map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Notes (optional)"
                  {...item.field("notes")}
                />
                <Button
                  variant="outlined"
                  disabled={detail.busy}
                  onClick={item.submit(async (values) => {
                    const ok = await detail.addItem({
                      ...values,
                      notes: values.notes || undefined,
                    });
                    if (ok)
                      item.reset({
                        area: "",
                        condition: values.condition,
                        notes: "",
                      });
                  })}
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
            {detail.detail.data.photos.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                {detail.detail.data.photos.map((photo, index) => (
                  <Button
                    key={photo.id}
                    size="small"
                    variant="outlined"
                    onClick={() => void detail.openPhoto(photo.id)}
                  >
                    View photo {index + 1}
                  </Button>
                ))}
              </Stack>
            )}
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
