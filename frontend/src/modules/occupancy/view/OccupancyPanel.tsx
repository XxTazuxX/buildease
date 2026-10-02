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
import { PromptDialog } from "@/shared/components/PromptDialog";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { useZodForm } from "@/shared/forms/useZodForm";
import {
  assignmentFormSchema,
  residentFormSchema,
  residentUpdateFormSchema,
  type HouseholdMember,
  type Resident,
} from "../model/occupancy";
import { useOccupancy } from "../viewmodel/useOccupancy";

const emptyResident = { accountId: "", displayName: "", phone: "" };
const emptyAssignment = { residentId: "", spaceId: "" };

function EditResidentDialog({
  resident,
  busy,
  error,
  onSave,
  close,
}: {
  resident: Resident;
  busy: boolean;
  error: string;
  onSave: (values: {
    displayName: string;
    phone: string;
    active: boolean;
  }) => Promise<boolean>;
  close: () => void;
}) {
  const form = useZodForm(residentUpdateFormSchema, {
    displayName: resident.display_name,
    phone: resident.phone ?? "",
    active: resident.active,
  });
  return (
    <AdaptiveDialog open onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>Edit resident</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Resident name" {...form.field("displayName")} />
          <TextField label="Phone (optional)" {...form.field("phone")} />
          <FormControlLabel
            label="Active resident"
            control={
              <Checkbox
                checked={form.values.active}
                onChange={(_, active) => form.setValue("active", active)}
              />
            }
          />
          {!form.values.active && resident.assignments.length > 0 && (
            <Alert severity="info">
              End every active space assignment before deactivating this
              resident.
            </Alert>
          )}
          <Button
            variant="contained"
            disabled={busy}
            onClick={form.submit(async (values) => {
              if (await onSave(values)) close();
            })}
          >
            Save resident
          </Button>
        </Stack>
      </DialogContent>
    </AdaptiveDialog>
  );
}

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
  const [editing, setEditing] = useState<Resident | null>(null);
  const [householdFor, setHouseholdFor] = useState<Resident | null>(null);
  const [editingMember, setEditingMember] = useState<{
    resident: Resident;
    member: HouseholdMember;
  } | null>(null);
  const [removingMember, setRemovingMember] = useState<{
    resident: Resident;
    member: HouseholdMember;
  } | null>(null);
  const resident = useZodForm(residentFormSchema, emptyResident);
  const assignment = useZodForm(assignmentFormSchema, emptyAssignment);
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
          <Button
            variant="outlined"
            onClick={() => {
              resident.reset(emptyResident);
              setResidentOpen(true);
            }}
          >
            Add resident
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              assignment.reset(emptyAssignment);
              setAssignmentOpen(true);
            }}
          >
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
                {(item.household?.length ?? 0) > 0 && (
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      Household
                    </Typography>
                    {item.household?.map((member) => (
                      <Stack
                        key={member.id}
                        direction="row"
                        sx={{ alignItems: "center", gap: 1 }}
                      >
                        <Typography variant="body2" sx={{ flexGrow: 1 }}>
                          {member.relationship
                            ? `${member.name} (${member.relationship})`
                            : member.name}
                        </Typography>
                        <Button
                          size="small"
                          disabled={vm.busy}
                          aria-label={`Edit household member ${member.name}`}
                          onClick={() =>
                            setEditingMember({ resident: item, member })
                          }
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          disabled={vm.busy}
                          aria-label={`Remove household member ${member.name}`}
                          onClick={() =>
                            setRemovingMember({ resident: item, member })
                          }
                        >
                          Remove
                        </Button>
                      </Stack>
                    ))}
                  </Box>
                )}
              </Box>
              <Button
                disabled={vm.busy || !item.active}
                onClick={() => setHouseholdFor(item)}
              >
                Add household
              </Button>
              <Button disabled={vm.busy} onClick={() => setEditing(item)}>
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
              {...resident.field("accountId")}
              onChange={(e) => {
                const member = members.find(
                  (item) => item.account_id === e.target.value,
                );
                resident.setValue("accountId", e.target.value);
                resident.setValue("displayName", member?.display_name ?? "");
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
              {...resident.field("displayName")}
            />
            <TextField label="Phone (optional)" {...resident.field("phone")} />
            <Button
              variant="contained"
              disabled={vm.busy}
              onClick={resident.submit(async (values) => {
                if (await vm.create(values)) setResidentOpen(false);
              })}
            >
              Create resident
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>
      {editing && (
        <EditResidentDialog
          resident={editing}
          busy={vm.busy}
          error={vm.error}
          close={() => setEditing(null)}
          onSave={(values) => vm.update(editing.id, values)}
        />
      )}
      {householdFor && (
        <PromptDialog
          title={`Add household member · ${householdFor.display_name}`}
          fields={[
            { name: "name", label: "Household member name", max: 120 },
            {
              name: "relationship",
              label: "Relationship (optional)",
              max: 60,
              optional: true,
            },
          ]}
          label="Add household member"
          error={vm.error}
          onClose={() => setHouseholdFor(null)}
          onSubmit={async (values) => {
            if (
              await vm.addHouseholdMember(
                householdFor.id,
                values.name,
                values.relationship,
              )
            )
              setHouseholdFor(null);
          }}
        />
      )}
      {editingMember && (
        <PromptDialog
          title={`Edit household member · ${editingMember.resident.display_name}`}
          fields={[
            {
              name: "name",
              label: "Household member name",
              max: 120,
              defaultValue: editingMember.member.name,
            },
            {
              name: "relationship",
              label: "Relationship (optional)",
              max: 60,
              optional: true,
              defaultValue: editingMember.member.relationship ?? "",
            },
          ]}
          label="Save household member"
          error={vm.error}
          onClose={() => setEditingMember(null)}
          onSubmit={async (values) => {
            if (
              await vm.updateHouseholdMember(
                editingMember.resident.id,
                editingMember.member.id,
                values.name,
                values.relationship,
              )
            )
              setEditingMember(null);
          }}
        />
      )}
      {removingMember && (
        <AdaptiveDialog
          open
          onClose={() => setRemovingMember(null)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Remove household member</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {vm.error && <Alert severity="error">{vm.error}</Alert>}
              <Typography>
                Remove &ldquo;{removingMember.member.name}&rdquo; from{" "}
                {removingMember.resident.display_name}&apos;s household? This
                cannot be undone.
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ justifyContent: "flex-end" }}
              >
                <Button onClick={() => setRemovingMember(null)}>Cancel</Button>
                <Button
                  color="error"
                  variant="contained"
                  disabled={vm.busy}
                  onClick={async () => {
                    if (
                      await vm.removeHouseholdMember(
                        removingMember.resident.id,
                        removingMember.member.id,
                      )
                    )
                      setRemovingMember(null);
                  }}
                >
                  Remove member
                </Button>
              </Stack>
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
              {...assignment.field("residentId")}
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
              {...assignment.field("spaceId")}
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
              disabled={vm.busy}
              onClick={assignment.submit(async (values) => {
                if (await vm.assign(values.residentId, values.spaceId))
                  setAssignmentOpen(false);
              })}
            >
              Activate assignment
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>
    </Paper>
  );
}
