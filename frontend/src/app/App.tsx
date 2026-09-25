import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  Link as RouterLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  SvgIcon,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useAuth } from "@/modules/auth/viewmodel/AuthProvider";
import { ChangePasswordPage, LoginPage } from "@/modules/auth/view/AuthPages";
import {
  useAction,
  useAdminCommands,
  useWorkspaceContext,
} from "@/modules/admin/viewmodel/useAdmin";
import { BrandMark } from "@/shared/components/BrandMark";
import { OfflineNotice } from "@/shared/components/OfflineNotice";
import { PageHeader } from "@/shared/components/Surface";
import {
  OperationsPage,
  OverviewPage,
  PeoplePage,
  PropertiesPage,
} from "@/modules/workspace";

const drawerWidth = 272;
const PlatformPage = lazy(() =>
  import("@/modules/admin/view/PlatformPage").then((m) => ({
    default: m.PlatformPage,
  })),
);
const TenantPortalPage = lazy(() =>
  import("@/modules/tenant-portal/view/TenantPortalPage").then((m) => ({
    default: m.TenantPortalPage,
  })),
);
const elevatedRoles = new Set([
  "PROPERTY_MANAGER",
  "ACCOUNTANT",
  "MAINTENANCE_STAFF",
  "SECURITY_OPERATIONS_STAFF",
  "VENDOR",
]);

function NavigationIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="M3.5 10.8 12 3.8l8.5 7" />
        <path d="M5.8 9.8v10h12.4v-10M9.5 19.8v-6h5v6" />
      </>
    ),
    overview: (
      <>
        <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.4" />
        <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.4" />
        <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.4" />
        <rect x="14" y="14" width="6.5" height="6.5" rx="1.4" />
      </>
    ),
    properties: (
      <>
        <path d="M4 21V5.5L12 2v19M12 7h8v14M2.5 21h19" />
        <path d="M7.2 8h1.6M7.2 12h1.6M7.2 16h1.6M15.2 11h1.6M15.2 15h1.6" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20v-1.5A5.5 5.5 0 0 1 9 13a5.5 5.5 0 0 1 5.5 5.5V20" />
        <path d="M15.5 5.4a3 3 0 0 1 0 5.2M16.5 14a5.5 5.5 0 0 1 4 5.3V20" />
      </>
    ),
    operations: (
      <>
        <path d="M4 7.5h16v12H4zM7 7.5V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2.5" />
        <path d="M4 12h16M10 12v2h4v-2" />
      </>
    ),
    administration: (
      <>
        <path d="M12 3 4.5 6v5.2c0 4.6 3.1 8.2 7.5 9.8 4.4-1.6 7.5-5.2 7.5-9.8V6z" />
        <path d="M9 12.2 11 14l4-4" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </>
    ),
  };
  return (
    <SvgIcon aria-hidden="true" viewBox="0 0 24 24" sx={{ fontSize: 19 }}>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths[name]}
      </g>
    </SvgIcon>
  );
}

export function isTenantOnly(
  platformAdmin: boolean,
  access: { owner: boolean; roles: { role: string }[] } | undefined,
): boolean {
  return (
    !platformAdmin &&
    !!access &&
    !access.owner &&
    access.roles.length > 0 &&
    !access.roles.some((r) => elevatedRoles.has(r.role))
  );
}

function LoadingScreen() {
  return (
    <Box sx={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <Stack spacing={2} sx={{ alignItems: "center" }}>
        <BrandMark />
        <CircularProgress size={28} aria-label="Loading session" />
      </Stack>
    </Box>
  );
}

function ProfilePage({
  displayName,
  email,
  initials,
  platformAdmin,
  membershipCount,
  canChangePassword,
}: {
  displayName: string;
  email: string;
  initials: string;
  platformAdmin: boolean;
  membershipCount: number;
  canChangePassword: boolean;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Your profile"
        description="Manage your personal details and account security."
      />
      <Paper sx={{ overflow: "hidden", maxWidth: 760 }}>
        <Box
          sx={{
            height: 92,
            background: "linear-gradient(110deg, #155E57, #72B5A2)",
          }}
        />
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2.5}
          sx={{
            px: 3.5,
            pb: 3.5,
            mt: -3,
            alignItems: { xs: "flex-start", sm: "flex-end" },
          }}
        >
          <Avatar
            sx={{
              width: 76,
              height: 76,
              bgcolor: "secondary.main",
              color: "#3B2A10",
              fontWeight: 850,
              fontSize: 24,
              border: "5px solid white",
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ flexGrow: 1, pt: { sm: 4 } }}>
            <Typography variant="h5">{displayName}</Typography>
            <Typography color="text.secondary">{email}</Typography>
          </Box>
          {canChangePassword && (
            <Button variant="outlined" component={RouterLink} to="/password">
              Change password
            </Button>
          )}
        </Stack>
        <Divider />
        <Box sx={{ p: 3.5 }}>
          <Typography variant="overline" color="text.secondary">
            Access level
          </Typography>
          <Typography sx={{ mt: 0.5 }}>
            {platformAdmin
              ? "System Administrator"
              : `${membershipCount} active organization${membershipCount === 1 ? "" : "s"}`}
          </Typography>
        </Box>
      </Paper>
    </>
  );
}

export default function App() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const cache = useQueryClient();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileNavigation, setMobileNavigation] = useState(false);
  const action = useAction();
  const commands = useAdminCommands();
  const profile = auth.profile;
  const memberships = useMemo(
    () => (profile?.memberships ?? []).filter((m) => m.status === "ACTIVE"),
    [profile?.memberships],
  );
  const routeOrg =
    location.pathname.match(/^\/organizations\/([^/]+)/)?.[1] ?? "";
  const routeMembership = memberships.find(
    (m) => m.organization_id === routeOrg,
  );
  const activeOrg =
    routeOrg && (profile?.platform_admin || routeMembership)
      ? routeOrg
      : (memberships[0]?.organization_id ?? "");
  const context = useWorkspaceContext(activeOrg);
  const access = context.access.data;
  const tenantOnly = isTenantOnly(!!profile?.platform_admin, access);
  const search = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const requestedBuilding = search.get("building") ?? "";
  const building = context.buildings.data?.some(
    (item) => item.id === requestedBuilding,
  )
    ? requestedBuilding
    : (context.buildings.data?.[0]?.id ?? "");

  useEffect(() => {
    if (
      !activeOrg ||
      tenantOnly ||
      context.buildings.isLoading ||
      !location.pathname.startsWith(`/organizations/${activeOrg}/`) ||
      building === requestedBuilding
    )
      return;
    const next = new URLSearchParams(location.search);
    if (building) next.set("building", building);
    else next.delete("building");
    navigate(`${location.pathname}${next.toString() ? `?${next}` : ""}`, {
      replace: true,
    });
  }, [
    activeOrg,
    building,
    context.buildings.isLoading,
    location.pathname,
    location.search,
    navigate,
    requestedBuilding,
    tenantOnly,
  ]);

  if (!auth.ready) return <LoadingScreen />;
  if (auth.mustChange) return <ChangePasswordPage />;
  if (!profile) return <LoginPage />;

  const handleSignOut = () =>
    void (auth.impersonating ? auth.exitImpersonation() : auth.signOut());

  const initials = profile.display_name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const buildingRoles =
    access?.roles.filter((role) => role.building_id === building) ?? [];
  const hasBuildingRole = (role: string) =>
    buildingRoles.some((item) => item.role === role);
  const canManage = !!access?.owner || hasBuildingRole("PROPERTY_MANAGER");
  const canFinance = canManage || hasBuildingRole("ACCOUNTANT");
  const canMaintenance =
    canManage ||
    buildingRoles.some((item) =>
      ["MAINTENANCE_STAFF", "SECURITY_OPERATIONS_STAFF", "VENDOR"].includes(
        item.role,
      ),
    );
  const canPeopleAnywhere =
    !!access?.owner ||
    access?.roles.some((item) => item.role === "PROPERTY_MANAGER");
  const canOperationsAnywhere =
    !!access?.owner ||
    access?.roles.some((item) => elevatedRoles.has(item.role));
  const workspaceQuery = building
    ? `?building=${encodeURIComponent(building)}`
    : "";
  const nav =
    tenantOnly && activeOrg
      ? [
          {
            label: "My home",
            path: `/organizations/${activeOrg}`,
            icon: "home",
          },
        ]
      : activeOrg
        ? [
            {
              label: "Overview",
              path: `/organizations/${activeOrg}/overview`,
              icon: "overview",
            },
            {
              label: "Properties",
              path: `/organizations/${activeOrg}/properties`,
              icon: "properties",
            },
            ...(canPeopleAnywhere
              ? [
                  {
                    label: "People & occupancy",
                    path: `/organizations/${activeOrg}/people`,
                    icon: "people",
                  },
                ]
              : []),
            ...(canOperationsAnywhere
              ? [
                  {
                    label: "Finance & maintenance",
                    path: `/organizations/${activeOrg}/operations`,
                    icon: "operations",
                  },
                ]
              : []),
          ]
        : [];
  const globalNav = [
    ...(profile.platform_admin
      ? [
          {
            label: "Administration",
            path: "/admin",
            icon: "administration",
          },
        ]
      : []),
    { label: "Profile", path: "/profile", icon: "profile" },
  ];

  const sidebar = (
    <Stack sx={{ height: "100%", bgcolor: "#102E2D", color: "white", p: 2.25 }}>
      <Box sx={{ px: 1, py: 1.5 }}>
        <BrandMark inverse />
      </Box>
      {!desktop &&
        memberships.length > 1 &&
        memberships.some((m) => m.organization_id === activeOrg) && (
          <TextField
            select
            size="small"
            label="Organization"
            value={activeOrg}
            onChange={(event) => {
              cache.clear();
              setMobileNavigation(false);
              navigate(`/organizations/${event.target.value}/overview`);
            }}
            sx={{
              mx: 1,
              mt: 2,
              "& .MuiOutlinedInput-root": {
                bgcolor: "rgba(255,255,255,.08)",
                color: "white",
              },
              "& .MuiInputLabel-root": { color: "#B6CBC7" },
              "& .MuiSvgIcon-root": { color: "#B6CBC7" },
            }}
          >
            {memberships.map((membership) => (
              <MenuItem
                key={membership.organization_id}
                value={membership.organization_id}
              >
                {membership.name}
              </MenuItem>
            ))}
          </TextField>
        )}
      <Typography
        variant="overline"
        sx={{ px: 1.5, mt: 4, mb: 1, color: "#7FA6A1" }}
      >
        Workspace
      </Typography>
      <List component="nav" aria-label="Primary navigation" sx={{ p: 0 }}>
        {[...nav, ...globalNav].map((item) => {
          const selected =
            location.pathname === item.path ||
            location.pathname.startsWith(`${item.path}/`);
          const to = item.path.startsWith(`/organizations/${activeOrg}/`)
            ? `${item.path}${workspaceQuery}`
            : item.path;
          return (
            <ListItemButton
              key={item.path}
              component={RouterLink}
              to={to}
              selected={selected}
              onClick={() => setMobileNavigation(false)}
              sx={{
                borderRadius: 2.5,
                mb: 0.75,
                py: 1.15,
                color: selected ? "white" : "#B6CBC7",
                "&.Mui-selected": {
                  bgcolor: "rgba(120,201,183,.16)",
                  "&:hover": { bgcolor: "rgba(120,201,183,.2)" },
                },
                "&:hover": { bgcolor: "rgba(255,255,255,.06)" },
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  mr: 1.5,
                  bgcolor: selected ? "#79C8B7" : "rgba(255,255,255,.07)",
                  color: selected ? "#123A37" : "#9BB8B2",
                }}
              >
                <NavigationIcon name={item.icon} />
              </Box>
              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: { sx: { fontWeight: 700, fontSize: 14 } },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ flexGrow: 1 }} />
      <Paper
        sx={{
          bgcolor: "rgba(255,255,255,.065)",
          borderColor: "rgba(255,255,255,.08)",
          p: 1.5,
          color: "white",
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Avatar
            sx={{
              width: 38,
              height: 38,
              bgcolor: "#E7A84A",
              color: "#3B2A10",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>
              {profile.display_name}
            </Typography>
            <Typography variant="caption" sx={{ color: "#96B0AB" }} noWrap>
              {profile.email}
            </Typography>
          </Box>
        </Stack>
        <Button
          color="inherit"
          fullWidth
          onClick={handleSignOut}
          sx={{
            mt: 1.25,
            border: "1px solid rgba(255,255,255,.1)",
            minHeight: 36,
          }}
        >
          {auth.impersonating ? "Exit impersonation" : "Sign out"}
        </Button>
      </Paper>
    </Stack>
  );

  const noOrganization = (
    <Paper sx={{ p: 5, textAlign: "center" }}>
      <Typography variant="h5" gutterBottom>
        Set up your first workspace
      </Typography>
      <Typography color="text.secondary">
        {profile.platform_admin
          ? "Create an organization from Administration to begin."
          : "No active organizations yet. Contact your administrator or accept an invitation."}
      </Typography>
      {profile.memberships
        .filter((m) => m.status === "PENDING")
        .map((m) => (
          <Button
            key={m.organization_id}
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await commands.accept(m.organization_id);
                await auth.reload();
              })
            }
            sx={{ mt: 2 }}
          >
            Accept invitation to {m.name}
          </Button>
        ))}
      <OfflineNotice />
    </Paper>
  );
  const invalidOrganization =
    !!routeOrg && activeOrg !== routeOrg && !profile.platform_admin;
  const loadingWorkspace =
    !!activeOrg && (context.access.isLoading || context.buildings.isLoading);

  return (
    <Box sx={{ minHeight: "100vh" }}>
      {auth.impersonating && (
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "center",
            gap: 1.5,
            py: 1,
            px: 2,
            bgcolor: "warning.main",
            color: "warning.contrastText",
            flexWrap: "wrap",
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Viewing as {auth.impersonationTarget?.displayName} (
            {auth.impersonationTarget?.email})
          </Typography>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={() => void auth.exitImpersonation()}
          >
            Exit
          </Button>
        </Stack>
      )}
      {desktop ? (
        <Drawer
          variant="permanent"
          open
          sx={{ "& .MuiDrawer-paper": { width: drawerWidth, border: 0 } }}
        >
          {sidebar}
        </Drawer>
      ) : (
        <Drawer
          open={mobileNavigation}
          onClose={() => setMobileNavigation(false)}
          slotProps={{
            paper: { sx: { width: "min(86vw, 320px)", border: 0 } },
          }}
        >
          {sidebar}
        </Drawer>
      )}
      <Box sx={{ ml: { md: `${drawerWidth}px` }, minHeight: "100vh" }}>
        <Box
          component="header"
          sx={{
            height: { xs: 68, md: 76 },
            px: { xs: 1.5, sm: 3.5 },
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            bgcolor: "rgba(255,255,255,.84)",
            borderBottom: "1px solid",
            borderColor: "divider",
            backdropFilter: "blur(14px)",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          {!desktop && (
            <IconButton
              aria-label="Open navigation"
              onClick={() => setMobileNavigation(true)}
            >
              ☰
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="caption" color="text.secondary">
              OPERATIONS WORKSPACE
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 750 }}>
              {memberships.find((m) => m.organization_id === activeOrg)?.name ??
                (activeOrg ? "Organization workspace" : "Platform overview")}
            </Typography>
          </Box>
          {activeOrg &&
            !tenantOnly &&
            context.buildings.data &&
            context.buildings.data.length > 0 && (
              <TextField
                select
                size="small"
                label="Building"
                value={building}
                onChange={(event) => {
                  const next = new URLSearchParams(location.search);
                  next.set("building", event.target.value);
                  navigate(`${location.pathname}?${next}`);
                }}
                sx={{
                  width: { xs: 145, sm: 240 },
                  "& .MuiOutlinedInput-root": { bgcolor: "#F7F9F7" },
                }}
              >
                {context.buildings.data.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          {memberships.length > 1 &&
            memberships.some((m) => m.organization_id === activeOrg) && (
              <TextField
                select
                size="small"
                label="Organization"
                value={activeOrg}
                onChange={(event) => {
                  cache.clear();
                  navigate(`/organizations/${event.target.value}/overview`);
                }}
                sx={{
                  width: { xs: 145, sm: 240 },
                  display: { xs: "none", sm: "block" },
                  "& .MuiOutlinedInput-root": { bgcolor: "#F7F9F7" },
                }}
              >
                {memberships.map((m) => (
                  <MenuItem key={m.organization_id} value={m.organization_id}>
                    {m.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
        </Box>
        <Container
          maxWidth="xl"
          sx={{
            py: { xs: 2.5, md: 4.5 },
            px: { xs: 1.75, sm: 3.5 },
            overflowX: "hidden",
          }}
        >
          <Suspense
            fallback={
              <Box sx={{ py: 10, textAlign: "center" }}>
                <CircularProgress aria-label="Loading workspace" />
              </Box>
            }
          >
            {loadingWorkspace ? (
              <Box sx={{ py: 10, textAlign: "center" }}>
                <CircularProgress aria-label="Loading workspace" />
              </Box>
            ) : (
              <Routes>
                <Route
                  path="/"
                  element={
                    activeOrg ? (
                      <Navigate
                        to={`/organizations/${activeOrg}/${tenantOnly ? "" : "overview"}`}
                        replace
                      />
                    ) : (
                      noOrganization
                    )
                  }
                />
                <Route
                  path="/organizations/:org"
                  element={
                    invalidOrganization ? (
                      <Navigate
                        to={`/organizations/${activeOrg}/overview`}
                        replace
                      />
                    ) : tenantOnly ? (
                      <TenantPortalPage org={activeOrg} />
                    ) : (
                      <Navigate to={`overview${workspaceQuery}`} replace />
                    )
                  }
                />
                <Route
                  path="/organizations/:org/overview"
                  element={
                    invalidOrganization ? (
                      <Navigate
                        to={`/organizations/${activeOrg}/overview`}
                        replace
                      />
                    ) : tenantOnly ? (
                      <Navigate to={`/organizations/${activeOrg}`} replace />
                    ) : (
                      <OverviewPage
                        org={activeOrg}
                        building={building}
                        displayName={profile.display_name}
                        pending={profile.memberships.filter(
                          (m) => m.status === "PENDING",
                        )}
                        onAccept={async (organization) => {
                          await commands.accept(organization);
                          await auth.reload();
                        }}
                      />
                    )
                  }
                />
                <Route
                  path="/organizations/:org/properties"
                  element={
                    invalidOrganization ? (
                      <Navigate
                        to={`/organizations/${activeOrg}/overview`}
                        replace
                      />
                    ) : tenantOnly ? (
                      <Navigate to={`/organizations/${activeOrg}`} replace />
                    ) : (
                      <PropertiesPage
                        org={activeOrg}
                        building={building}
                        owner={!!access?.owner}
                      />
                    )
                  }
                />
                <Route
                  path="/organizations/:org/people"
                  element={
                    invalidOrganization ? (
                      <Navigate
                        to={`/organizations/${activeOrg}/overview`}
                        replace
                      />
                    ) : !canPeopleAnywhere ? (
                      <Navigate
                        to={`/organizations/${activeOrg}/overview${workspaceQuery}`}
                        replace
                      />
                    ) : (
                      <PeoplePage org={activeOrg} building={building} />
                    )
                  }
                />
                <Route
                  path="/organizations/:org/operations"
                  element={
                    invalidOrganization ? (
                      <Navigate
                        to={`/organizations/${activeOrg}/overview`}
                        replace
                      />
                    ) : !canOperationsAnywhere ? (
                      <Navigate
                        to={`/organizations/${activeOrg}/overview${workspaceQuery}`}
                        replace
                      />
                    ) : (
                      <OperationsPage
                        org={activeOrg}
                        building={building}
                        owner={!!access?.owner}
                        canManage={canManage}
                        canFinance={canFinance}
                        canMaintenance={canMaintenance}
                      />
                    )
                  }
                />
                <Route
                  path="/admin"
                  element={
                    profile.platform_admin ? (
                      <PlatformPage />
                    ) : (
                      <Navigate to="/" />
                    )
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProfilePage
                      displayName={profile.display_name}
                      email={profile.email}
                      initials={initials}
                      platformAdmin={profile.platform_admin}
                      membershipCount={memberships.length}
                      canChangePassword={!auth.impersonating}
                    />
                  }
                />
                <Route
                  path="/password"
                  element={
                    auth.impersonating ? (
                      <Navigate to="/profile" replace />
                    ) : (
                      <ChangePasswordPage />
                    )
                  }
                />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            )}
          </Suspense>
        </Container>
      </Box>
    </Box>
  );
}
