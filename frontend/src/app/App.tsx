import { lazy, Suspense, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
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
} from "@/modules/admin/viewmodel/useAdmin";
import { BrandMark } from "@/shared/components/BrandMark";
import { OfflineNotice } from "@/shared/components/OfflineNotice";
import { PageHeader } from "@/shared/components/Surface";
import { ActionSheet, Glyph } from "@/shared/components/Responsive";

const drawerWidth = 264;
const PlatformPage = lazy(() =>
  import("@/modules/admin/view/PlatformPage").then((m) => ({
    default: m.PlatformPage,
  })),
);
const WorkspacePage = lazy(() =>
  import("@/modules/admin/view/WorkspacePage").then((m) => ({
    default: m.WorkspacePage,
  })),
);

function OrganizationRoute() {
  const { org } = useParams();
  return org ? <WorkspacePage key={org} org={org} /> : <Navigate to="/" />;
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

export default function App() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const cache = useQueryClient();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const [organizationSheet, setOrganizationSheet] = useState(false);
  const [org, setOrg] = useState("");
  const action = useAction();
  const commands = useAdminCommands();

  if (!auth.ready) return <LoadingScreen />;
  if (auth.mustChange) return <ChangePasswordPage />;
  if (!auth.profile) return <LoginPage />;

  const profile = auth.profile;
  const memberships = profile.memberships.filter((m) => m.status === "ACTIVE");
  const activeOrg = memberships.some((m) => m.organization_id === org)
    ? org
    : memberships[0]?.organization_id || "";
  const initials = profile.display_name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const nav = [
    { label: "Workspace", path: "/", badge: "01" },
    ...(profile.platform_admin
      ? [{ label: "Administration", path: "/admin", badge: "02" }]
      : []),
    {
      label: "Profile",
      path: "/profile",
      badge: profile.platform_admin ? "03" : "02",
    },
  ];

  const sidebar = (
    <Stack sx={{ height: "100%", bgcolor: "#102E2D", color: "white", p: 2.25 }}>
      <Box sx={{ px: 1, py: 1.5 }}>
        <BrandMark inverse />
      </Box>
      <Typography
        variant="overline"
        sx={{ px: 1.5, mt: 4, mb: 1, color: "#7FA6A1" }}
      >
        Command center
      </Typography>
      <List sx={{ p: 0 }}>
        {nav.map((item) => {
          const selected =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);
          return (
            <ListItemButton
              key={item.path}
              component={RouterLink}
              to={item.path}
              selected={selected}
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
                  fontSize: 10,
                  fontWeight: 900,
                }}
              >
                {item.badge}
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
          onClick={() => void auth.signOut()}
          sx={{
            mt: 1.25,
            border: "1px solid rgba(255,255,255,.1)",
            minHeight: 36,
          }}
        >
          Sign out
        </Button>
      </Paper>
    </Stack>
  );

  const home = (
    <>
      <Box
        sx={{
          p: { xs: 3, sm: 4 },
          mb: 3,
          borderRadius: 4,
          color: "white",
          background:
            "linear-gradient(120deg, #155E57 0%, #1B7167 60%, #4A8B79 100%)",
          position: "relative",
          overflow: "hidden",
          "&::after": {
            content: '""',
            position: "absolute",
            width: 240,
            height: 240,
            borderRadius: "50%",
            right: -70,
            top: -115,
            border: "45px solid rgba(255,255,255,.07)",
          },
        }}
      >
        <Typography variant="overline" sx={{ color: "#BCE4D9" }}>
          Today at BuildEase
        </Typography>
        <Typography variant="h3" sx={{ mt: 1, maxWidth: 600 }}>
          Hello, {profile.display_name}.
        </Typography>
        <Typography
          sx={{ color: "rgba(255,255,255,.76)", mt: 1.5, maxWidth: 550 }}
        >
          Keep your buildings, people, and access organized from one secure
          workspace.
        </Typography>
      </Box>
      {action.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {action.error}
        </Alert>
      )}
      {profile.memberships
        .filter((m) => m.status === "PENDING")
        .map((m) => (
          <Paper
            sx={{ p: 2.5, mb: 2, borderColor: "#F0D39D", bgcolor: "#FFFAF1" }}
            key={m.organization_id}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{
                gap: 2,
                justifyContent: "space-between",
                alignItems: { xs: "stretch", sm: "center" },
              }}
            >
              <Box>
                <Typography variant="overline" color="secondary.dark">
                  Pending invitation
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>
                  You’re invited to {m.name}
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="secondary"
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await commands.accept(m.organization_id);
                    await auth.reload();
                  })
                }
              >
                Accept invitation
              </Button>
            </Stack>
          </Paper>
        ))}
      {activeOrg ? (
        <WorkspacePage key={activeOrg} org={activeOrg} />
      ) : (
        <Paper sx={{ p: 5, textAlign: "center" }}>
          <Typography variant="h5" gutterBottom>
            Set up your first workspace
          </Typography>
          <Typography color="text.secondary">
            {profile.platform_admin
              ? "Create an organization from Administration to begin."
              : "No active organizations yet. Contact your administrator or accept an invitation above."}
            <OfflineNotice />
          </Typography>
        </Paper>
      )}
    </>
  );

  return (
    <Box sx={{ minHeight: "100vh" }}>
      {desktop && (
        <Drawer
          variant="permanent"
          open
          sx={{ "& .MuiDrawer-paper": { width: drawerWidth, border: 0 } }}
        >
          {sidebar}
        </Drawer>
      )}
      <Box sx={{ ml: { md: `${drawerWidth}px` }, minHeight: "100vh" }}>
        <Box
          component="header"
          sx={{
            height: { xs: "auto", md: 76 },
            px: { xs: 2, sm: 3.5 },
            py: { xs: 1.5, md: 0 },
            display: "flex",
            alignItems: "center",
            gap: 2,
            bgcolor: "rgba(255,255,255,.84)",
            borderBottom: "1px solid",
            borderColor: "divider",
            backdropFilter: "blur(14px)",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          {!desktop && <BrandMark />}
          <Box sx={{ flexGrow: 1, display: { xs: "none", md: "block" } }}>
            <Typography variant="caption" color="text.secondary">
              OPERATIONS WORKSPACE
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 750 }}>
              {memberships.find((m) => m.organization_id === activeOrg)?.name ??
                "Platform overview"}
            </Typography>
          </Box>
          {memberships.length > 0 && desktop && (
            <TextField
              select
              size="small"
              label="Organization"
              value={activeOrg}
              onChange={(e) => {
                cache.clear();
                setOrg(e.target.value);
                navigate("/");
              }}
              sx={{
                width: { xs: 180, sm: 260 },
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
          {memberships.length > 0 && !desktop && (
            <Button
              aria-label="Organization"
              onClick={() => setOrganizationSheet(true)}
              endIcon={
                <Box component="span" aria-hidden>
                  ⌄
                </Box>
              }
              sx={{
                minWidth: 0,
                maxWidth: 150,
                px: 1,
                color: "text.primary",
                "& .MuiButton-endIcon": { ml: 0.5 },
              }}
            >
              <Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>
                {memberships.find((m) => m.organization_id === activeOrg)?.name}
              </Typography>
            </Button>
          )}
          {!desktop && (
            <IconButton
              aria-label="Sign out"
              onClick={() => void auth.signOut()}
            >
              <Glyph name="logout" />
            </IconButton>
          )}
        </Box>
        <Container
          maxWidth="xl"
          sx={{
            py: { xs: 2.5, md: 4.5 },
            px: { xs: 1.75, sm: 3.5 },
            pb: { xs: "calc(92px + env(safe-area-inset-bottom))", md: 4.5 },
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
            <Routes>
              <Route
                path="/organizations/:org"
                element={<OrganizationRoute />}
              />
              <Route path="/" element={home} />
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
                          background:
                            "linear-gradient(110deg, #155E57, #72B5A2)",
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
                          <Typography variant="h5">
                            {profile.display_name}
                          </Typography>
                          <Typography color="text.secondary">
                            {profile.email}
                          </Typography>
                        </Box>
                        <Button
                          variant="outlined"
                          component={RouterLink}
                          to="/password"
                        >
                          Change password
                        </Button>
                      </Stack>
                      <Divider />
                      <Box sx={{ p: 3.5 }}>
                        <Typography variant="overline" color="text.secondary">
                          Access level
                        </Typography>
                        <Typography sx={{ mt: 0.5 }}>
                          {profile.platform_admin
                            ? "System Administrator"
                            : `${memberships.length} active organization${memberships.length === 1 ? "" : "s"}`}
                        </Typography>
                      </Box>
                    </Paper>
                  </>
                }
              />
              <Route path="/password" element={<ChangePasswordPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </Container>
        {!desktop && (
          <Paper
            component="nav"
            role="navigation"
            aria-label="Primary navigation"
            square
            sx={{
              position: "fixed",
              zIndex: 20,
              left: 0,
              right: 0,
              bottom: 0,
              borderWidth: "1px 0 0",
              pb: "env(safe-area-inset-bottom)",
              boxShadow: "0 -10px 35px rgba(20,50,47,.08)",
            }}
          >
            <BottomNavigation
              showLabels
              value={
                location.pathname.startsWith("/admin")
                  ? "/admin"
                  : location.pathname.startsWith("/profile") ||
                      location.pathname.startsWith("/password")
                    ? "/profile"
                    : "/"
              }
              sx={{ height: 68 }}
            >
              <BottomNavigationAction
                component={RouterLink}
                to="/"
                value="/"
                label="Workspace"
                icon={<Glyph name="home" />}
              />
              {profile.platform_admin && (
                <BottomNavigationAction
                  component={RouterLink}
                  to="/admin"
                  value="/admin"
                  label="Administration"
                  icon={<Glyph name="admin" />}
                />
              )}
              <BottomNavigationAction
                component={RouterLink}
                to="/profile"
                value="/profile"
                label="Profile"
                icon={<Glyph name="profile" />}
              />
            </BottomNavigation>
          </Paper>
        )}
      </Box>
      <ActionSheet
        open={organizationSheet}
        onClose={() => setOrganizationSheet(false)}
        title="Choose organization"
      >
        {memberships.map((membership) => (
          <Button
            key={membership.organization_id}
            variant={
              membership.organization_id === activeOrg ? "contained" : "text"
            }
            startIcon={<Glyph name="building" />}
            onClick={() => {
              cache.clear();
              setOrg(membership.organization_id);
              setOrganizationSheet(false);
              navigate("/");
            }}
          >
            {membership.name}
          </Button>
        ))}
      </ActionSheet>
    </Box>
  );
}
