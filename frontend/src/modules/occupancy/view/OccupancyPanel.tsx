import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  DialogContent,
  FormControlLabel,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { Member } from "@/modules/admin/model/admin";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import type { Resident } from "../model/occupancy";
import { useOccupancy } from "../viewmodel/useOccupancy";

export function OccupancyPanel({
  org,
  building,
  members,
}: {
  org: string;
  building: string;
  members: Member[];
}) {
  const vm = useOccupancy(org, building);
  const [residentOpen, setResidentOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [editing, setEditing] = useState<{
    resident: Resident;
    displayName: string;
    phone: string;
    active: boolean;
  } | null>(null);
  const [resident, setResident] = useState({
    accountId: "",
    displayName: "",
    phone: "",
  });
  const [assignment, setAssignment] = useState({ residentId: "", spaceId: "" });
  const error =
    vm.error || vm.residents.error?.message || vm.spaces.error?.message;
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
            Occupancy
          </Typography>
          <Typography variant="h5">Residents and spaces</Typography>
          <Typography color="text.secondary">
            Verified resident accounts and current space assignments.
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" onClick={() => setResidentOpen(true)}>
            Add resident
          </Button>
          <Button variant="contained" onClick={() => setAssignmentOpen(true)}>
            Assign space
          </Button>
        </Stack>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      <Stack spacing={1} sx={{ mt: 2 }}>
        {vm.residents.data?.map((item) => (
          <Paper variant="outlined" key={item.id} sx={{ p: 1.75 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{ gap: 1, alignItems: { sm: "center" } }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 750 }}>
                  {item.display_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.phone || "No phone"} ·{" "}
                  {item.active ? "Active" : "Inactive"}
                </Typography>
                {item.assignments.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No active spaces
                  </Typography>
                )}
                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                  {item.assignments.map((current) => (
                    <Stack
                      key={current.id}
                      direction="row"
                      sx={{ alignItems: "center", gap: 1 }}
                    >
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>
                        {vm.spaces.data?.find(
                          (space) => space.id === current.space_id,
                        )?.name ?? "Assigned space"}
                      </Typography>
                      <Button
                        size="small"
                        color="warning"
                        disabled={vm.busy}
                        onClick={() => void vm.end(current.id)}
                      >
                        End
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              </Box>
              <Button
                disabled={vm.busy}
                onClick={() =>
                  setEditing({
                    resident: item,
                    displayName: item.display_name,
                    phone: item.phone ?? "",
                    active: item.active,
                  })
                }
              >
                Edit resident
              </Button>
            </Stack>
          </Paper>
        ))}
      </Stack>
      <AdaptiveDialog
        open={residentOpen}
        onClose={() => setResidentOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add resident profile</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Tenant account"
              value={resident.accountId}
              onChange={(e) => {
                const member = members.find(
                  (item) => item.account_id === e.target.value,
                );
                setResident({
                  ...resident,
                  accountId: e.target.value,
                  displayName: member?.display_name ?? "",
                });
              }}
            >
              {members
                .filter((item) => item.status === "ACTIVE")
                .map((item) => (
                  <MenuItem key={item.account_id} value={item.account_id}>
                    {item.display_name} · {item.email}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              label="Resident name"
              value={resident.displayName}
              onChange={(e) =>
                setResident({ ...resident, displayName: e.target.value })
              }
            />
            <TextField
              label="Phone (optional)"
              value={resident.phone}
              onChange={(e) =>
                setResident({ ...resident, phone: e.target.value })
              }
            />
            <Button
              variant="contained"
              disabled={
                vm.busy || !resident.accountId || !resident.displayName.trim()
              }
              onClick={() =>
                void vm
                  .create(resident)
                  .then((ok) => ok && setResidentOpen(false))
              }
            >
              Create resident
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>
      {editing && (
        <AdaptiveDialog
          open
          onClose={() => setEditing(null)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Edit resident</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {vm.error && <Alert severity="error">{vm.error}</Alert>}
              <TextField
                label="Resident name"
                value={editing.displayName}
                onChange={(event) =>
                  setEditing({ ...editing, displayName: event.target.value })
                }
                slotProps={{ htmlInput: { maxLength: 120 } }}
              />
              <TextField
                label="Phone (optional)"
                value={editing.phone}
                onChange={(event) =>
                  setEditing({ ...editing, phone: event.target.value })
                }
                slotProps={{ htmlInput: { maxLength: 40 } }}
              />
              <FormControlLabel
                label="Active resident"
                control={
                  <Checkbox
                    checked={editing.active}
                    onChange={(_, active) => setEditing({ ...editing, active })}
                  />
                }
              />
              {!editing.active && editing.resident.assignments.length > 0 && (
                <Alert severity="info">
                  End every active space assignment before deactivating this
                  resident.
                </Alert>
              )}
              <Button
                variant="contained"
                disabled={vm.busy || !editing.displayName.trim()}
                onClick={() =>
                  void vm
                    .update(editing.resident.id, {
                      displayName: editing.displayName,
                      phone: editing.phone,
                      active: editing.active,
                    })
                    .then((ok) => ok && setEditing(null))
                }
              >
                Save resident
              </Button>
            </Stack>
          </DialogContent>
        </AdaptiveDialog>
      )}
      <AdaptiveDialog
        open={assignmentOpen}
        onClose={() => setAssignmentOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Assign resident to space</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Resident"
              value={assignment.residentId}
              onChange={(e) =>
                setAssignment({ ...assignment, residentId: e.target.value })
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
              label="Vacant space"
              value={assignment.spaceId}
              onChange={(e) =>
                setAssignment({ ...assignment, spaceId: e.target.value })
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
            <Button
              variant="contained"
              disabled={
                vm.busy || !assignment.residentId || !assignment.spaceId
              }
              onClick={() =>
                void vm
                  .assign(assignment.residentId, assignment.spaceId)
                  .then((ok) => ok && setAssignmentOpen(false))
              }
            >
              Activate assignment
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>
    </Paper>
  );
}
