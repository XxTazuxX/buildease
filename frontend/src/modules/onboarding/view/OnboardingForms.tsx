import { useState } from "react";
import {
  Alert,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { OnboardingMode } from "../model/onboarding";
import { useOnboarding } from "../viewmodel/useOnboarding";

export function OnboardingForm({
  mode,
  back,
}: {
  mode: OnboardingMode;
  back: () => void;
}) {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const { message, error, busy, submit } = useOnboarding(mode, token);
  const [values, setValues] = useState({
    email: "",
    displayName: "",
    organizationName: "",
    password: "",
  });
  const title =
    mode === "register"
      ? "Create your workspace"
      : mode === "forgot"
        ? "Recover your account"
        : mode === "verify"
          ? "Verify your email"
          : "Choose a new password";
  return (
    <Paper
      sx={{
        width: "100%",
        maxWidth: 470,
        p: { xs: 2.5, sm: 4 },
        borderRadius: 4,
      }}
    >
      <Typography variant="h4" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {mode === "register"
          ? "Start a free BuildEase pilot workspace."
          : mode === "verify"
            ? "We are validating your one-time link."
            : "Identity links expire after 30 minutes."}
      </Typography>
      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        {message && <Alert severity="success">{message}</Alert>}
        {["register", "forgot"].includes(mode) && (
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => setValues({ ...values, email: e.target.value })}
          />
        )}
        {mode === "register" && (
          <>
            <TextField
              label="Your name"
              value={values.displayName}
              onChange={(e) =>
                setValues({ ...values, displayName: e.target.value })
              }
            />
            <TextField
              label="Organization name"
              value={values.organizationName}
              onChange={(e) =>
                setValues({ ...values, organizationName: e.target.value })
              }
            />
          </>
        )}
        {["register", "reset"].includes(mode) && (
          <TextField
            label={mode === "register" ? "Password" : "New password"}
            type="password"
            autoComplete="new-password"
            helperText="Use 15–64 characters"
            value={values.password}
            onChange={(e) => setValues({ ...values, password: e.target.value })}
          />
        )}
        {mode !== "verify" && !message && (
          <Button
            variant="contained"
            size="large"
            disabled={busy || (mode === "reset" && !token)}
            onClick={() => void submit(values)}
          >
            {busy ? "Please wait…" : "Continue"}
          </Button>
        )}
        <Button onClick={back}>Back to sign in</Button>
      </Stack>
    </Paper>
  );
}
