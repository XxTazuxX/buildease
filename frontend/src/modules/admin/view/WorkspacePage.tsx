import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { roles, type Role, type Member } from "../model/admin";
import {
  useWorkspace,
  useAction,
  useRoleEditor,
  useAdminCommands,
} from "../viewmodel/useAdmin";
import { FieldsForm } from "@/shared/components/FieldsForm";
import { Pager } from "@/shared/components/Pager";
import {
  MetricCard,
  PageHeader,
  StatusChip,
} from "@/shared/components/Surface";
import { ActionSheet, AdaptiveDialog } from "@/shared/components/Responsive";
import { useAuth } from "@/modules/auth/viewmodel/AuthProvider";
import { BuildingConfigurationPanel } from "@/modules/buildings";
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
  const values = selected ?? vm.query.data?.map((r) => r.role) ?? [];
  return (
    <AdaptiveDialog open onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>Building roles · {member.display_name}</DialogTitle>
      <Divider />
      <DialogContent>
        {vm.action.error && <Alert severity="error">{vm.action.error}</Alert>}
        {vm.query.error && (
          <Alert severity="error">{vm.query.error.message}</Alert>
        )}
        <Stack spacing={0.5} sx={{ pt: 1 }}>
          {roles
            .filter((r) => owner || r !== "PROPERTY_MANAGER")
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
                          : values.filter((r) => r !== role),
                      )
                    }
                  />
                }
              />
            ))}
          <Button
            variant="contained"
            disabled={vm.query.isLoading || !!vm.query.error || vm.action.busy}
            onClick={() =>
              void vm.save(values).then((ok) => {
                if (ok) close();
              })
            }
          >
            Save roles
          </Button>
        </Stack>
      </DialogContent>
    </AdaptiveDialog>
  );
}
export function WorkspacePage({ org }: { org: string }) {
  const auth = useAuth();
  const currentUserId = auth.profile?.id;
  const [building, setBuilding] = useState("");
  const [page, setPage] = useState(0);
  const [newBuilding, setNewBuilding] = useState(false);
  const [invite, setInvite] = useState(false);
  const [owner, setOwner] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(["TENANT"]);
  const [editing, setEditing] = useState<Member | null>(null);
  const [moreMember, setMoreMember] = useState<Member | null>(null);
  const vm = useWorkspace(org, building, page);
  const action = useAction();
  const commands = useAdminCommands();
  return (
    <>
      <PageHeader
        eyebrow="Organization workspace"
        title="Buildings & people"
        description="Manage properties, organization members, and building-level responsibilities."
        action={
          vm.access.data?.owner ? (
            <Button variant="contained" onClick={() => setNewBuilding(true)}>
              <Box component="span" aria-hidden sx={{ mr: 0.75 }}>
                +
              </Box>
              Add building
            </Button>
          ) : undefined
        }
      />
      {(vm.access.error || vm.buildings.error || action.error) && (
        <Alert severity="error">
          {action.error ||
            vm.access.error?.message ||
            vm.buildings.error?.message}
        </Alert>
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            sm: "repeat(3, 1fr)",
          },
          gap: 2,
          mb: 3,
          "& > :nth-of-type(3)": { gridColumn: { xs: "1 / -1", sm: "auto" } },
        }}
      >
        <MetricCard
          label="Buildings"
          value={vm.buildings.data?.length ?? "—"}
          detail="Available in this organization"
        />
        <MetricCard
          label="Members"
          value={vm.members.data?.length ?? "—"}
          detail={
            building
              ? "Assigned to selected building"
              : "Across this organization"
          }
          tone="gold"
        />
        <MetricCard
          label="Your access"
          value={
            vm.access.data?.owner
              ? "Owner"
              : vm.canManage
                ? "Manager"
                : "Member"
          }
          detail="Current administration scope"
          tone="slate"
        />
      </Box>
      <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ alignItems: { md: "center" } }}
        >
          <Box sx={{ flexGrow: 1 }}>
            <Typography sx={{ fontWeight: 750 }}>Building scope</Typography>
            <Typography variant="body2" color="text.secondary">
              Choose a property to view its assigned team and roles.
            </Typography>
          </Box>
          <TextField
            select
            label="Building"
            value={building}
            onChange={(e) => {
              setBuilding(e.target.value);
              setPage(0);
            }}
            fullWidth
            sx={{ width: { md: 330 } }}
          >
            <MenuItem value="">
              {vm.access.data?.owner
                ? "All organization members"
                : "Select a building"}
            </MenuItem>
            {vm.buildings.data?.map((b) => (
              <MenuItem key={b.id} value={b.id}>
                {b.name} · {b.code}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        {!vm.buildings.isLoading && vm.buildings.data?.length === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            No buildings are assigned to you yet.
          </Alert>
        )}
      </Paper>
      {building && (
        <BuildingConfigurationPanel
          org={org}
          building={building}
          owner={!!vm.access.data?.owner}
        />
      )}
      {vm.canManage ? (
        <>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            sx={{
              gap: 1.5,
              justifyContent: "space-between",
              alignItems: { sm: "center" },
              mb: 1.5,
            }}
          >
            <Box>
              <Typography variant="h5">Members</Typography>
              <Typography variant="body2" color="text.secondary">
                People with access to this scope
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => setInvite(true)}>
              <Box component="span" aria-hidden sx={{ mr: 0.75 }}>
                +
              </Box>
              Add member
            </Button>
          </Stack>
          {vm.members.error && (
            <Alert severity="error">{vm.members.error.message}</Alert>
          )}
          <Stack spacing={1.25} sx={{ my: 2 }}>
            {vm.members.data?.map((m) => {
              const isSelf = m.account_id === currentUserId;
              return (
                <Paper
                  key={m.account_id}
                  sx={{
                    p: 2.5,
                    transition: "border-color .2s, transform .2s",
                    "&:hover": {
                      borderColor: "#B8D6CE",
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={2}
                    sx={{
                      alignItems: "center",
                      flexWrap: { xs: "wrap", md: "nowrap" },
                    }}
                  >
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        borderRadius: "50%",
                        bgcolor: "primary.light",
                        color: "primary.main",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 850,
                      }}
                    >
                      {m.display_name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6">{m.display_name}</Typography>
                      <Typography color="text.secondary">{m.email}</Typography>
                    </Box>
                    {m.owner ? (
                      <Chip
                        label="Organization owner"
                        color="secondary"
                        variant="outlined"
                      />
                    ) : (
                      <StatusChip
                        active={m.status === "ACTIVE"}
                        label={m.status}
                      />
                    )}
                    {isSelf && <Chip label="You" size="small" />}
                    {building && !isSelf && (
                      <Button
                        variant="outlined"
                        sx={{ display: { xs: "none", md: "flex" } }}
                        onClick={() => setEditing(m)}
                      >
                        Building roles
                      </Button>
                    )}
                    {vm.access.data?.owner && !isSelf && (
                      <>
                        <Button
                          sx={{ display: { xs: "none", md: "flex" } }}
                          disabled={action.busy}
                          onClick={() =>
                            void action.run(() =>
                              commands.membership(
                                org,
                                m.account_id,
                                !m.owner,
                                false,
                              ),
                            )
                          }
                        >
                          {m.owner ? "Remove owner role" : "Make owner"}
                        </Button>
                        <Button
                          color="error"
                          sx={{ display: { xs: "none", md: "flex" } }}
                          disabled={action.busy}
                          onClick={() =>
                            void action.run(() =>
                              commands.membership(
                                org,
                                m.account_id,
                                m.owner,
                                true,
                              ),
                            )
                          }
                        >
                          Remove membership
                        </Button>
                      </>
                    )}
                    {(building || vm.access.data?.owner) && !isSelf && (
                      <Button
                        fullWidth
                        variant="outlined"
                        sx={{ display: { xs: "flex", md: "none" } }}
                        onClick={() => setMoreMember(m)}
                      >
                        More actions
                      </Button>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
          <Pager
            page={page}
            count={vm.members.data?.length || 0}
            onChange={setPage}
          />
        </>
      ) : (
        <Paper sx={{ p: 4, bgcolor: "#F9FBFA" }}>
          <Typography variant="h6">Your workspace is ready</Typography>
          <Typography color="text.secondary">
            Your access is limited to assigned buildings and your own profile.
            Contact an owner or property manager for membership changes.
          </Typography>
        </Paper>
      )}
      <ActionSheet
        open={!!moreMember}
        onClose={() => setMoreMember(null)}
        title={moreMember?.display_name ?? "Member actions"}
      >
        {building && moreMember && moreMember.account_id !== currentUserId && (
          <Button
            onClick={() => {
              setEditing(moreMember);
              setMoreMember(null);
            }}
          >
            Building roles
          </Button>
        )}
        {vm.access.data?.owner &&
          moreMember &&
          moreMember.account_id !== currentUserId && (
            <>
              <Button
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await commands.membership(
                      org,
                      moreMember.account_id,
                      !moreMember.owner,
                      false,
                    );
                    setMoreMember(null);
                  })
                }
              >
                {moreMember.owner ? "Remove owner role" : "Make owner"}
              </Button>
              <Button
                color="error"
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await commands.membership(
                      org,
                      moreMember.account_id,
                      moreMember.owner,
                      true,
                    );
                    setMoreMember(null);
                  })
                }
              >
                Remove membership
              </Button>
            </>
          )}
      </ActionSheet>
      <AdaptiveDialog
        open={newBuilding}
        onClose={() => setNewBuilding(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add building</DialogTitle>
        <Divider />
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <FieldsForm
              fields={[
                { name: "name", label: "Building name", max: 120 },
                { name: "code", label: "Building code", max: 40 },
              ]}
              onSubmit={async (v) => {
                await commands.createBuilding(org, v);
                setNewBuilding(false);
              }}
              label="Add building"
            />
          </Box>
        </DialogContent>
      </AdaptiveDialog>
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
            receive a temporary password, delivered by you privately.
          </Typography>
          {vm.access.data?.owner && (
            <FormControlLabel
              label="Organization owner"
              control={
                <Checkbox checked={owner} onChange={(_, v) => setOwner(v)} />
              }
            />
          )}
          {building && (
            <Box sx={{ mb: 2 }}>
              {roles
                .filter(
                  (r) => vm.access.data?.owner || r !== "PROPERTY_MANAGER",
                )
                .map((r) => (
                  <FormControlLabel
                    key={r}
                    label={r.replaceAll("_", " ")}
                    control={
                      <Checkbox
                        checked={selectedRoles.includes(r)}
                        onChange={(_, checked) =>
                          setSelectedRoles(
                            checked
                              ? [...selectedRoles, r]
                              : selectedRoles.filter((x) => x !== r),
                          )
                        }
                      />
                    }
                  />
                ))}
            </Box>
          )}
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
            onSubmit={async (v) => {
              await commands.invite(org, {
                ...v,
                owner: !!vm.access.data?.owner && owner,
                buildingId: building || null,
                roles: building ? selectedRoles : [],
              });
              setInvite(false);
            }}
            label="Add member"
          />
        </DialogContent>
      </AdaptiveDialog>
      {editing && editing.account_id !== currentUserId && (
        <RoleDialog
          org={org}
          building={building}
          member={editing}
          owner={!!vm.access.data?.owner}
          close={() => setEditing(null)}
        />
      )}
    </>
  );
}
