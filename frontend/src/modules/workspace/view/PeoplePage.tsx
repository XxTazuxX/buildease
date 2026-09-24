import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";
import { OccupancyPanel } from "@/modules/occupancy";
import { useAuth } from "@/modules/auth/viewmodel/AuthProvider";
import { roles, type Member, type Role } from "@/modules/admin/model/admin";
import {
  useAction,
  useAdminCommands,
  useRoleEditor,
  useWorkspace,
} from "@/modules/admin/viewmodel/useAdmin";
import { FieldsForm } from "@/shared/components/FieldsForm";
import { Pager } from "@/shared/components/Pager";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { PageHeader, StatusChip } from "@/shared/components/Surface";

function RoleDialog({
  org,
  building,
  member,
  owner,
  close,
}: {
  org: string;
  building: string;
  member: Member;
  owner: boolean;
  close: () => void;
}) {
  const vm = useRoleEditor(org, building, member.account_id);
  const [selected, setSelected] = useState<Role[] | null>(null);
  const values = selected ?? vm.query.data?.map((item) => item.role) ?? [];
  return (
    <AdaptiveDialog open onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>Building roles · {member.display_name}</DialogTitle>
      <Divider />
      <DialogContent>
        {(vm.action.error || vm.query.error) && (
          <Alert severity="error">
            {vm.action.error || vm.query.error?.message}
          </Alert>
        )}
        <Stack spacing={0.5} sx={{ pt: 1 }}>
          {roles
            .filter((role) => owner || role !== "PROPERTY_MANAGER")
            .map((role) => (
              <FormControlLabel
                key={role}
                label={role.replaceAll("_", " ")}
                control={
                  <Checkbox
                    checked={values.includes(role)}
                    onChange={(_, checked) =>
                      setSelected(
                        checked
                          ? [...values, role]
                          : values.filter((value) => value !== role),
                      )
                    }
                  />
                }
              />
            ))}
          <Button
            variant="contained"
            disabled={vm.query.isLoading || !!vm.query.error || vm.action.busy}
            onClick={() => void vm.save(values).then((ok) => ok && close())}
          >
            Save roles
          </Button>
        </Stack>
      </DialogContent>
    </AdaptiveDialog>
  );
}

export function PeoplePage({
  org,
  building,
}: {
  org: string;
  building: string;
}) {
  const auth = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "occupancy" ? "occupancy" : "members";
  const [page, setPage] = useState(0);
  const [invite, setInvite] = useState(false);
  const [makeOwner, setMakeOwner] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(["TENANT"]);
  const [editingRoles, setEditingRoles] = useState<Member | null>(null);
  const [editingProfile, setEditingProfile] = useState<{
    member: Member;
    name: string;
  } | null>(null);
  const vm = useWorkspace(org, building, page);
  const action = useAction();
  const commands = useAdminCommands();
  const owner = !!vm.access.data?.owner;
  const canManage = !!vm.canManage;
  const selectTab = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", value);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Members and occupancy"
        description="Manage organization access, resident profiles, and current space assignments."
        action={
          tab === "members" && canManage ? (
            <Button variant="contained" onClick={() => setInvite(true)}>
              Add member
            </Button>
          ) : undefined
        }
      />
      {!building ? (
        <Alert severity="info">
          Select or create a building to manage people.
        </Alert>
      ) : !canManage && !vm.access.isLoading ? (
        <Alert severity="warning">
          Property-manager access is required for this building.
        </Alert>
      ) : (
        <>
          <Paper sx={{ px: 1.5, mb: 2 }}>
            <Tabs value={tab} onChange={(_, value) => selectTab(value)}>
              <Tab value="members" label="Members" />
              <Tab value="occupancy" label="Occupancy" />
            </Tabs>
          </Paper>
          {tab === "occupancy" ? (
            <OccupancyPanel
              org={org}
              building={building}
              members={vm.members.data ?? []}
            />
          ) : (
            <>
              {(vm.members.error || action.error) && (
                <Alert severity="error">
                  {action.error || vm.members.error?.message}
                </Alert>
              )}
              <Stack spacing={1.25} sx={{ mb: 2 }}>
                {vm.members.data?.map((member) => {
                  const self = member.account_id === auth.profile?.id;
                  return (
                    <Paper key={member.account_id} sx={{ p: 2.25 }}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1.5}
                        sx={{ alignItems: { md: "center" } }}
                      >
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="h6">
                            {member.display_name}
                          </Typography>
                          <Typography color="text.secondary">
                            {member.email}
                          </Typography>
                        </Box>
                        {member.owner ? (
                          <StatusChip active label="Organization owner" />
                        ) : (
                          <StatusChip
                            active={member.status === "ACTIVE"}
                            label={member.status}
                          />
                        )}
                        {owner && (
                          <Button
                            onClick={() =>
                              setEditingProfile({
                                member,
                                name: member.display_name,
                              })
                            }
                          >
                            Edit
                          </Button>
                        )}
                        {!self && (
                          <Button
                            variant="outlined"
                            onClick={() => setEditingRoles(member)}
                          >
                            Roles
                          </Button>
                        )}
                        {owner && !self && (
                          <>
                            <Button
                              disabled={action.busy}
                              onClick={() =>
                                void action.run(() =>
                                  commands.membership(
                                    org,
                                    member.account_id,
                                    !member.owner,
                                    false,
                                  ),
                                )
                              }
                            >
                              {member.owner ? "Remove owner" : "Make owner"}
                            </Button>
                            <Button
                              color="error"
                              disabled={action.busy}
                              onClick={() =>
                                void action.run(() =>
                                  commands.membership(
                                    org,
                                    member.account_id,
                                    member.owner,
                                    true,
                                  ),
                                )
                              }
                            >
                              Remove
                            </Button>
                          </>
                        )}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
              <Pager
                page={page}
                count={vm.members.data?.length ?? 0}
                onChange={setPage}
              />
            </>
          )}
        </>
      )}

      <AdaptiveDialog
        open={invite}
        onClose={() => setInvite(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add organization member</DialogTitle>
        <Divider />
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Existing users accept an invitation after signing in. New users
            receive a temporary password delivered privately.
          </Typography>
          {owner && (
            <FormControlLabel
              label="Organization owner"
              control={
                <Checkbox
                  checked={makeOwner}
                  onChange={(_, checked) => setMakeOwner(checked)}
                />
              }
            />
          )}
          <Box sx={{ mb: 2 }}>
            {roles
              .filter((role) => owner || role !== "PROPERTY_MANAGER")
              .map((role) => (
                <FormControlLabel
                  key={role}
                  label={role.replaceAll("_", " ")}
                  control={
                    <Checkbox
                      checked={selectedRoles.includes(role)}
                      onChange={(_, checked) =>
                        setSelectedRoles(
                          checked
                            ? [...selectedRoles, role]
                            : selectedRoles.filter((value) => value !== role),
                        )
                      }
                    />
                  }
                />
              ))}
          </Box>
          <FieldsForm
            fields={[
              { name: "name", label: "Member name", max: 120 },
              { name: "email", label: "Member email", type: "email" },
              {
                name: "temporaryPassword",
                label: "Temporary password (new accounts only)",
                type: "password",
                password: true,
                optional: true,
              },
            ]}
            onSubmit={async (values) => {
              await commands.invite(org, {
                ...values,
                owner: owner && makeOwner,
                buildingId: building,
                roles: selectedRoles,
              });
              setInvite(false);
            }}
            label="Add member"
          />
        </DialogContent>
      </AdaptiveDialog>

      {editingProfile && (
        <AdaptiveDialog
          open
          onClose={() => setEditingProfile(null)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Edit organization member</DialogTitle>
          <Divider />
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label="Display name"
                value={editingProfile.name}
                onChange={(event) =>
                  setEditingProfile({
                    ...editingProfile,
                    name: event.target.value,
                  })
                }
                slotProps={{ htmlInput: { maxLength: 120 } }}
              />
              <Typography variant="body2" color="text.secondary">
                {editingProfile.member.email}
              </Typography>
              <Button
                variant="contained"
                disabled={action.busy || !editingProfile.name.trim()}
                onClick={() =>
                  void action.run(async () => {
                    await commands.updateMember(
                      org,
                      editingProfile.member.account_id,
                      editingProfile.name,
                    );
                    setEditingProfile(null);
                  })
                }
              >
                Save member
              </Button>
            </Stack>
          </DialogContent>
        </AdaptiveDialog>
      )}
      {editingRoles && (
        <RoleDialog
          org={org}
          building={building}
          member={editingRoles}
          owner={owner}
          close={() => setEditingRoles(null)}
        />
      )}
    </>
  );
}
