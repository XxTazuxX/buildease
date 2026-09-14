import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  useLoginViewModel,
  useChangeViewModel,
} from "../viewmodel/useAuthForm";
import { useAuth } from "../viewmodel/AuthProvider";
import { BrandMark } from "@/shared/components/BrandMark";

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100svh",
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: "minmax(360px, .9fr) minmax(500px, 1.1fr)",
        },
        bgcolor: "#F7F9F6",
      }}
    >
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "space-between",
          p: { md: 6, lg: 8 },
          color: "white",
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(145deg, #0D302F 0%, #155E57 58%, #287B6E 100%)",
          "&::before": {
            content: '""',
            position: "absolute",
            width: 420,
            height: 420,
            borderRadius: "50%",
            border: "80px solid rgba(255,255,255,.055)",
            right: -180,
            bottom: -150,
          },
          "&::after": {
            content: '""',
            position: "absolute",
            width: 170,
            height: 170,
            borderRadius: "50%",
            bgcolor: "rgba(231,168,74,.16)",
            right: 80,
            top: 95,
          },
        }}
      >
        <BrandMark inverse />
        <Box sx={{ position: "relative", zIndex: 1, maxWidth: 560 }}>
          <Chip
            label="Property operations, simplified"
            sx={{
              mb: 3,
              bgcolor: "rgba(255,255,255,.1)",
              color: "#D7EEE8",
              border: "1px solid rgba(255,255,255,.12)",
            }}
          />
          <Typography variant="h1">
            Every building.
            <br />
            One clear view.
          </Typography>
          <Typography
            sx={{
              mt: 3,
              color: "#B8D2CD",
              fontSize: 18,
              lineHeight: 1.7,
              maxWidth: 500,
            }}
          >
            Give owners, managers, and on-site teams one secure place to
            coordinate access and daily operations.
          </Typography>
        </Box>
        <Stack
          direction="row"
          spacing={4}
          sx={{ position: "relative", zIndex: 1 }}
        >
          {["Secure by design", "Role-based access", "Built for teams"].map(
            (item) => (
              <Typography
                key={item}
                variant="caption"
                sx={{ color: "#A9C5C0", fontWeight: 650 }}
              >
                ✓ {item}
              </Typography>
            ),
          )}
        </Stack>
      </Box>
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          minHeight: "100svh",
          p: { xs: 2, sm: 5 },
          position: "relative",
          overflowY: "auto",
        }}
      >
        <Box
          sx={{
            display: { xs: "block", md: "none" },
            position: "absolute",
            top: 18,
            left: 18,
          }}
        >
          <BrandMark />
        </Box>
        {children}
      </Box>
    </Box>
  );
}

export function LoginPage() {
  const { form, error, submit } = useLoginViewModel();
  return (
    <AuthShell>
      <Box sx={{ width: "100%", maxWidth: 470, mt: { xs: 6, md: 0 } }}>
        <Typography variant="overline" color="primary.main">
          Welcome to your workspace
        </Typography>
        <Typography variant="h3" sx={{ mt: 1.2, mb: 1 }}>
          Welcome back.
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          Sign in to manage your buildings, people, and permissions.
        </Typography>
        <Paper
          sx={{
            p: { xs: 2, sm: 4 },
            borderRadius: 4,
            boxShadow: "0 22px 60px rgba(22,55,51,.08)",
            "@media (max-width:370px)": {
              mx: -1,
              borderRadius: 2.5,
              boxShadow: "none",
            },
          }}
        >
          <Stack component="form" onSubmit={submit} spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              {...form.register("email")}
              error={!!form.formState.errors.email}
              helperText={form.formState.errors.email?.message}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              {...form.register("password")}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={form.formState.isSubmitting}
              sx={{ mt: 0.5, py: 1.35 }}
            >
              {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </Stack>
        </Paper>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 3, textAlign: "center" }}
        >
          Need access? Contact your organization administrator.
        </Typography>
      </Box>
    </AuthShell>
  );
}

export function ChangePasswordPage() {
  const { form, error, submit } = useChangeViewModel();
  const auth = useAuth();
  return (
    <AuthShell>
      <Box sx={{ width: "100%", maxWidth: 500, mt: { xs: 6, md: 0 } }}>
        <Typography variant="overline" color="primary.main">
          Secure your account
        </Typography>
        <Typography variant="h3" sx={{ mt: 1.2, mb: 1 }}>
          Choose your password
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Use 15–64 characters, up to 72 UTF-8 bytes. You will sign in again
          after changing it.
        </Typography>
        <Paper
          sx={{
            p: { xs: 2, sm: 4 },
            borderRadius: 4,
            boxShadow: "0 22px 60px rgba(22,55,51,.08)",
            "@media (max-width:370px)": {
              mx: -1,
              borderRadius: 2.5,
              boxShadow: "none",
            },
          }}
        >
          <Stack component="form" onSubmit={submit} spacing={2.25}>
            {error && <Alert severity="error">{error}</Alert>}
            {(["oldPassword", "newPassword", "confirmPassword"] as const).map(
              (key, i) => (
                <TextField
                  key={key}
                  label={
                    [
                      "Current or temporary password",
                      "New password",
                      "Confirm password",
                    ][i]
                  }
                  type="password"
                  autoComplete={i === 0 ? "current-password" : "new-password"}
                  {...form.register(key)}
                  error={!!form.formState.errors[key]}
                  helperText={form.formState.errors[key]?.message}
                />
              ),
            )}
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={form.formState.isSubmitting}
            >
              Change password
            </Button>
            <Button onClick={() => void auth.signOut()}>Sign out</Button>
          </Stack>
        </Paper>
      </Box>
    </AuthShell>
  );
}
