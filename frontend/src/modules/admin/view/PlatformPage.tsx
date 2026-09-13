import { Link as RouterLink } from "react-router-dom";
import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  FormControlLabel,
  Dialog,
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
import type { Account, Organization } from "../model/admin";
import { FieldsForm } from "@/shared/components/FieldsForm";
import { Pager } from "@/shared/components/Pager";
import {
  MetricCard,
  PageHeader,
  StatusChip,
} from "@/shared/components/Surface";
export function PlatformPage() {
  const [tab, setTab] = useState<"organizations" | "accounts">("organizations");
  const [page, setPage] = useState(0);
  const [reset, setReset] = useState<Account | null>(null);
  const [create, setCreate] = useState(false);
  const [systemAdmin, setSystemAdmin] = useState(false);
  const query = usePlatform(tab, page);
  const action = useAction();
  const commands = useAdminCommands();
  return (
    <>
      <PageHeader
        eyebrow="Platform control"
        title="Administration"
        description="Manage customer organizations, platform accounts, and access lifecycle from one place."
        action={
          <Button variant="contained" onClick={() => setCreate(true)}>
            <Box component="span" aria-hidden sx={{ mr: 0.75 }}>
              +
            </Box>
            Create {tab === "organizations" ? "organization" : "account"}
          </Button>
        }
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          gap: 2,
          mb: 3,
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
      <Paper sx={{ px: 1.5, mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, value) => {
            setTab(value);
            setPage(0);
          }}
        >
          <Tab value="organizations" label="Organizations" />
          <Tab value="accounts" label="Accounts" />
        </Tabs>
      </Paper>
      {(query.error || action.error) && (
        <Alert severity="error">{action.error || query.error?.message}</Alert>
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
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  sx={{ alignItems: { xs: "stretch", md: "center" } }}
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
                  <Stack direction="row" spacing={1}>
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
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  sx={{ justifyContent: "space-between" }}
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
                    <Typography color="text.secondary">{a.email}</Typography>
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
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" onClick={() => setReset(a)}>
                      Reset password
                    </Button>
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
                </Stack>
              </Paper>
            ))}
      </Stack>
      <Pager page={page} count={query.data?.length || 0} onChange={setPage} />
      <Dialog
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
      </Dialog>
      <Dialog
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
      </Dialog>
    </>
  );
}
