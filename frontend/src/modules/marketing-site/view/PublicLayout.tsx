import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { BrandMark } from "@/shared/components/BrandMark";

/** Chrome for the signed-out marketing pages. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F6F8F6" }}>
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "rgba(246,248,246,.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            height: 68,
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: { xs: 2, sm: 3 },
          }}
        >
          <Box
            component={RouterLink}
            to="/"
            sx={{ display: "flex", flexGrow: 1 }}
          >
            <BrandMark />
          </Box>
          <Button component={RouterLink} to="/pricing" color="inherit">
            Pricing
          </Button>
          <Button
            component={RouterLink}
            to="/login"
            color="inherit"
            sx={{ display: { xs: "none", sm: "inline-flex" } }}
          >
            Sign in
          </Button>
          <Button component={RouterLink} to="/register" variant="contained">
            Start free trial
          </Button>
        </Container>
      </Box>
      <Box component="main">{children}</Box>
      <Box
        component="footer"
        sx={{ borderTop: "1px solid", borderColor: "divider", py: 4, mt: 8 }}
      >
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ justifyContent: "space-between" }}
          >
            <Typography variant="body2" color="text.secondary">
              © {new Date().getFullYear()} BuildEase. Building operations,
              simplified.
            </Typography>
            <Stack direction="row" spacing={2}>
              <Typography
                component={RouterLink}
                to="/pricing"
                variant="body2"
                color="text.secondary"
              >
                Pricing
              </Typography>
              <Typography
                component={RouterLink}
                to="/login"
                variant="body2"
                color="text.secondary"
              >
                Sign in
              </Typography>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
