import { Link as RouterLink } from "react-router-dom";
import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  FormControlLabel,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import {
  usePlatform,
  useAction,
  useAdminCommands,
} from "../viewmodel/useAdmin";
import { useAuth } from "@/modules/auth/viewmodel/AuthProvider";
import type { Account, Organization } from "../model/admin";
import { FieldsForm } from "@/shared/components/FieldsForm";
import { Pager } from "@/shared/components/Pager";
import {
  MetricCard,
  PageHeader,
  StatusChip,
} from "@/shared/components/Surface";
import { ActionSheet, AdaptiveDialog } from "@/shared/components/Responsive";
import { SettingsPanel } from "./SettingsPanel";
import { AuditLogPanel } from "./AuditLogPanel";

type MoreTarget =
  | { kind: "organization"; item: Organization }
  | { kind: "account"; item: Account }
  | null;

type Tab = "organizations" | "accounts" | "settings" | "audit";

export function PlatformPage() {
  const [tab, setTab] = useState<Tab>("organizations");
  const [page, setPage] = useState(0);
  const [reset, setReset] = useState<Account | null>(null);
  const [create, setCreate] = useState(false);
  const [systemAdmin, setSystemAdmin] = useState(false);
  const [more, setMore] = useState<MoreTarget>(null);
  const isListTab = tab === "organizations" || tab === "accounts";
  const query = usePlatform(isListTab ? tab : "organizations", page, isListTab);
  const action = useAction();
  const commands = useAdminCommands();
  const auth = useAuth();
  return (
    <>
      <PageHeader
        eyebrow="Platform control"
        title="Administration"
        description="Manage customer organizations, platform accounts, and access lifecycle from one place."
        action={
          isListTab ? (
            <Button variant="contained" onClick={() => setCreate(true)}>
              <Box component="span" aria-hidden sx={{ mr: 0.75 }}>
                +
              </Box>
              Create {tab === "organizations" ? "organization" : "account"}
            </Button>
          ) : undefined
        }
      />
      {isListTab && (
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
            label="Current view"
            value={query.data?.length ?? "—"}
            detail={`Visible ${tab} on this page`}
          />
          <MetricCard
            label="Platform status"
            value="Online"
            detail="Authentication and database available"
            tone="gold"
          />
          <MetricCard
            label="Security"
            value="Enforced"
            detail="Sessions, roles, and audit trail"
            tone="slate"
          />
        </Box>
      )}
      <Paper sx={{ px: 1.5, mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, value: Tab) => {
            setTab(value);
            setPage(0);
          }}
        >
          <Tab value="organizations" label="Organizations" />
          <Tab value="accounts" label="Accounts" />
          <Tab value="settings" label="Settings" />
          <Tab value="audit" label="Audit log" />
        </Tabs>
      </Paper>
      {tab === "settings" && <SettingsPanel />}
      {tab === "audit" && <AuditLogPanel />}
      {isListTab && (
        <>
          {(query.error || action.error) && (
            <Alert severity="error">
              {action.error || query.error?.message}
            </Alert>
          )}
          {query.isLoading && <Typography sx={{ p: 3 }}>Loading…</Typography>}
          {query.data?.length === 0 && (
            <Paper sx={{ p: 5, my: 3 }}>
              <Typography>
                No {tab} yet. Create your first one to get started.
              </Typography>
            </Paper>
          )}
          <Stack spacing={1.25} sx={{ my: 2 }}>
            {tab === "organizations"
              ? (query.data as Organization[] | undefined)?.map((o) => (
                  <Paper
                    key={o.id}
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
                          width: 46,
                          height: 46,
                          borderRadius: 2.5,
                          bgcolor: "primary.light",
                          color: "primary.main",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 850,
                        }}
                      >
                        {o.name.slice(0, 2).toUpperCase()}
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6">{o.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Organization ID · {o.id.slice(0, 8)}
                        </Typography>
                      </Box>
                      <StatusChip active={o.active} />
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ display: { xs: "none", md: "flex" } }}
                      >
                        <Button
                          variant="outlined"
                          component={RouterLink}
                          to={`/organizations/${o.id}`}
                          disabled={!o.active}
                        >
                          Open workspace
                        </Button>
                        <Button
                          color={o.active ? "error" : "primary"}
                          disabled={action.busy}
                          onClick={() =>
                            void action.run(() =>
                              commands.organizationStatus(o.id, !o.active),
                            )
                          }
                        >
                          {o.active ? "Deactivate" : "Activate"}
                        </Button>
                      </Stack>
                      <Button
                        fullWidth
                        variant="outlined"
                        sx={{ display: { xs: "flex", md: "none" } }}
                        onClick={() =>
                          setMore({ kind: "organization", item: o })
                        }
                      >
                        More actions
                      </Button>
                    </Stack>
                  </Paper>
                ))
              : (query.data as Account[] | undefined)?.map((a) => (
                  <Paper
                    key={a.id}
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
                          width: 46,
                          height: 46,
                          flexShrink: 0,
                          borderRadius: "50%",
                          bgcolor: a.platform_admin
                            ? "secondary.light"
                            : "primary.light",
                          color: a.platform_admin
                            ? "secondary.dark"
                            : "primary.main",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 850,
                        }}
                      >
                        {a.display_name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6">{a.display_name}</Typography>
                        <Typography color="text.secondary">
                          {a.email}
                        </Typography>
                      </Box>
                      {a.platform_admin ? (
                        <Chip
                          label="System Administrator"
                          color="secondary"
                          variant="outlined"
                        />
                      ) : (
                        <StatusChip active={a.active} />
                      )}
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ display: { xs: "none", md: "flex" } }}
                      >
                        <Button variant="outlined" onClick={() => setReset(a)}>
                          Reset password
                        </Button>
                        {a.id !== auth.profile?.id && (
                          <Button
                            variant="outlined"
                            disabled={action.busy}
                            onClick={() =>
                              void action.run(() => commands.impersonate(a.id))
                            }
                          >
                            Login as
                          </Button>
                        )}
                        <Button
                          color={a.active ? "error" : "primary"}
                          disabled={action.busy}
                          onClick={() =>
                            void action.run(() =>
                              commands.accountStatus(a.id, !a.active),
                            )
                          }
                        >
                          {a.active ? "Deactivate" : "Activate"}
                        </Button>
                      </Stack>
                      <Button
                        fullWidth
                        variant="outlined"
                        sx={{ display: { xs: "flex", md: "none" } }}
                        onClick={() => setMore({ kind: "account", item: a })}
                      >
                        More actions
                      </Button>
                    </Stack>
                  </Paper>
                ))}
          </Stack>
          <Pager
            page={page}
            count={query.data?.length || 0}
            onChange={setPage}
          />
        </>
      )}
      <ActionSheet
        open={!!more}
        onClose={() => setMore(null)}
        title={
          more?.kind === "organization"
            ? more.item.name
            : more?.kind === "account"
              ? more.item.display_name
              : "Actions"
        }
      >
        {more?.kind === "organization" && (
          <>
            <Button
              component={RouterLink}
              to={`/organizations/${more.item.id}`}
              disabled={!more.item.active}
              onClick={() => setMore(null)}
            >
              Open workspace
            </Button>
            <Button
              color={more.item.active ? "error" : "primary"}
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await commands.organizationStatus(
                    more.item.id,
                    !more.item.active,
                  );
                  setMore(null);
                })
              }
            >
              {more.item.active ? "Deactivate" : "Activate"}
            </Button>
          </>
        )}
        {more?.kind === "account" && (
          <>
            <Button
              onClick={() => {
                setReset(more.item);
                setMore(null);
              }}
            >
              Reset password
            </Button>
            {more.item.id !== auth.profile?.id && (
              <Button
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await commands.impersonate(more.item.id);
                    setMore(null);
                  })
                }
              >
                Login as
              </Button>
            )}
            <Button
              color={more.item.active ? "error" : "primary"}
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await commands.accountStatus(more.item.id, !more.item.active);
                  setMore(null);
                })
              }
            >
              {more.item.active ? "Deactivate" : "Activate"}
            </Button>
          </>
        )}
      </ActionSheet>
      <AdaptiveDialog
        open={create}
        onClose={() => setCreate(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Create {tab === "organizations" ? "organization" : "account"}
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {tab === "accounts" && (
              <FormControlLabel
                label="System Administrator"
                control={
                  <Checkbox
                    checked={systemAdmin}
                    onChange={(_, checked) => setSystemAdmin(checked)}
                  />
                }
              />
            )}
            <FieldsForm
              fields={
                tab === "organizations"
                  ? [
                      { name: "name", label: "Organization name", max: 120 },
                      {
                        name: "ownerEmail",
                        label: "Owner email",
                        type: "email",
                      },
                      { name: "ownerName", label: "Owner name", max: 120 },
                      {
                        name: "temporaryPassword",
                        label: "Temporary password (new accounts only)",
                        type: "password",
                        password: true,
                        optional: true,
                      },
                    ]
                  : [
                      { name: "name", label: "Name", max: 120 },
                      { name: "email", label: "Email", type: "email" },
                      {
                        name: "temporaryPassword",
                        label: "Temporary password",
                        type: "password",
                        password: true,
                      },
                    ]
              }
              onSubmit={async (values) => {
                if (tab === "organizations") await commands.createOrg(values);
                else
                  await commands.createAccount({
                    ...values,
                    platformAdmin: systemAdmin,
                  });
                setCreate(false);
              }}
              label="Create"
            />
          </Box>
        </DialogContent>
      </AdaptiveDialog>
      <AdaptiveDialog
        open={!!reset}
        onClose={() => setReset(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Reset password for {reset?.display_name}</DialogTitle>
        <Divider />
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            All sessions will be revoked. Deliver this temporary password
            privately; it expires in 24 hours.
          </Typography>
          <FieldsForm
            fields={[
              {
                name: "temporaryPassword",
                label: "Temporary password",
                type: "password",
                password: true,
              },
            ]}
            onSubmit={async (v) => {
              await commands.reset(reset!.id, v.temporaryPassword);
              setReset(null);
            }}
            label="Reset password"
          />
        </DialogContent>
      </AdaptiveDialog>
    </>
  );
}
