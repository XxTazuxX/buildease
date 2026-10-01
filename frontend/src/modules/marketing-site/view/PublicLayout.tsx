import { useState, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Container,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import { BrandMark } from "@/shared/components/BrandMark";

const navigation = [
  ["Platform", "/#platform"],
  ["Workflow", "/#workflow"],
  ["Pricing", "/#pricing"],
  ["Questions", "/#questions"],
];

/** Chrome for the signed-out marketing pages. */
export function PublicLayout({ children }: { children: ReactNode }) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F3F0E6" }}>
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "rgba(243,240,230,.94)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(37,58,54,.12)",
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            height: { xs: 64, md: 76 },
            display: "flex",
            alignItems: "center",
            gap: { xs: 0.5, md: 2 },
            px: { xs: 2, sm: 3 },
          }}
        >
          <Box
            component={RouterLink}
            to="/"
            aria-label="BuildEase home"
            sx={{ display: "flex", flexGrow: 1, textDecoration: "none" }}
          >
            <BrandMark />
          </Box>
          <Stack
            component="nav"
            aria-label="Main navigation"
            direction="row"
            spacing={0.25}
            sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}
          >
            {navigation.map(([label, to]) => (
              <Button
                key={label}
                component="a"
                href={to}
                color="inherit"
                sx={{ color: "#52645B", fontSize: 13, px: 1.1, minWidth: 0 }}
              >
                {label}
              </Button>
            ))}
          </Stack>
          <Button
            component={RouterLink}
            to="/login"
            color="inherit"
            sx={{
              display: { xs: "none", sm: "inline-flex" },
              color: "#52645B",
            }}
          >
            Sign in
          </Button>
          <Button
            component={RouterLink}
            to="/register"
            variant="contained"
            sx={{
              bgcolor: "#244641",
              color: "#F3F0E6",
              px: { xs: 1.4, sm: 2 },
              fontSize: { xs: 12, sm: 14 },
              whiteSpace: "nowrap",
              "&:hover": { bgcolor: "#315953" },
            }}
          >
            Start free
          </Button>
          <IconButton
            aria-label="Open navigation menu"
            aria-controls={menuAnchor ? "public-navigation-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={menuAnchor ? "true" : undefined}
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            sx={{
              display: { xs: "inline-flex", md: "none" },
              color: "#244641",
            }}
          >
            <Box component="span" sx={{ fontSize: 22, lineHeight: 1 }}>
              ☰
            </Box>
          </IconButton>
          <Menu
            id="public-navigation-menu"
            anchorEl={menuAnchor}
            open={!!menuAnchor}
            onClose={() => setMenuAnchor(null)}
            slotProps={{ paper: { sx: { mt: 1.5, borderRadius: 2 } } }}
          >
            {navigation.map(([label, to]) => (
              <MenuItem
                key={label}
                component="a"
                href={to}
                onClick={() => setMenuAnchor(null)}
              >
                {label}
              </MenuItem>
            ))}
            <MenuItem
              component={RouterLink}
              to="/login"
              onClick={() => setMenuAnchor(null)}
            >
              Sign in
            </MenuItem>
          </Menu>
        </Container>
      </Box>
      <Box component="main">{children}</Box>
      <Box
        component="footer"
        sx={{
          position: "relative",
          overflow: "hidden",
          bgcolor: "#143534",
          color: "#F4F1E6",
          "&::before": {
            content: '""',
            position: "absolute",
            width: 520,
            height: 520,
            border: "1px solid rgba(221,235,218,.12)",
            borderRadius: "50%",
            right: { xs: -300, md: -120 },
            top: -270,
            boxShadow:
              "0 0 0 32px rgba(0,0,0,0), 0 0 0 33px rgba(221,235,218,.08), 0 0 0 76px rgba(0,0,0,0), 0 0 0 77px rgba(221,235,218,.06)",
          },
        }}
      >
        <Box sx={{ height: 5, bgcolor: "#E9A16E" }} />
        <Container
          maxWidth="lg"
          sx={{ position: "relative", px: { xs: 2, sm: 3 } }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={{ xs: 3, md: 6 }}
            sx={{ py: { xs: 6, md: 8 }, alignItems: { md: "end" } }}
          >
            <Box sx={{ maxWidth: 700, flexGrow: 1 }}>
              <Typography
                variant="overline"
                sx={{ color: "#E9A16E", letterSpacing: ".17em" }}
              >
                A BETTER DAY STARTS WITH A CLEARER VIEW
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  mt: 1.5,
                  maxWidth: 680,
                  color: "#F4F1E6",
                  fontSize: { xs: 38, md: 56 },
                  lineHeight: 1.03,
                  letterSpacing: "-.055em",
                }}
              >
                Let your team focus on the places they care for.
              </Typography>
              <Typography
                sx={{
                  mt: 1.5,
                  maxWidth: 540,
                  color: "#B9CCC0",
                  lineHeight: 1.75,
                }}
              >
                Bring the details together, and make room for better work.
              </Typography>
            </Box>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.25}
              sx={{ flexShrink: 0 }}
            >
              <Button
                component={RouterLink}
                to="/register"
                variant="contained"
                size="large"
                sx={{
                  bgcolor: "#E9A16E",
                  color: "#1D3937",
                  px: 2.5,
                  "&:hover": {
                    bgcolor: "#F1B384",
                    transform: "translateY(-2px)",
                  },
                  transition: "transform .2s, background-color .2s",
                }}
              >
                Start your free trial
              </Button>
              <Button
                component={RouterLink}
                to="/login"
                variant="outlined"
                size="large"
                sx={{
                  color: "#E5EBDD",
                  borderColor: "rgba(229,235,221,.35)",
                  "&:hover": {
                    borderColor: "#E5EBDD",
                    bgcolor: "rgba(255,255,255,.05)",
                  },
                }}
              >
                Sign in
              </Button>
            </Stack>
          </Stack>
          <Divider sx={{ borderColor: "rgba(229,235,221,.18)" }} />
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={{ xs: 3, md: 5 }}
            sx={{ py: 4, alignItems: { md: "center" } }}
          >
            <Box
              component={RouterLink}
              to="/"
              aria-label="BuildEase home"
              sx={{
                display: "flex",
                textDecoration: "none",
                mr: { md: "auto" },
              }}
            >
              <BrandMark inverse />
            </Box>
            <Stack
              direction="row"
              spacing={{ xs: 2, sm: 3 }}
              sx={{ flexWrap: "wrap", rowGap: 1 }}
            >
              {navigation.map(([label, to]) => (
                <Box
                  key={label}
                  component="a"
                  href={to}
                  sx={{
                    color: "#C3D1C5",
                    fontSize: 13,
                    fontWeight: 650,
                    textDecoration: "none",
                    transition: "color .2s",
                    "&:hover": { color: "#E9A16E" },
                  }}
                >
                  {label}
                </Box>
              ))}
            </Stack>
          </Stack>
          <Divider sx={{ borderColor: "rgba(229,235,221,.12)" }} />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ py: 2.5, justifyContent: "space-between" }}
          >
            <Typography variant="caption" sx={{ color: "#9DB4A6" }}>
              Copyright {new Date().getFullYear()} BuildEase. Building
              operations, connected.
            </Typography>
            <Typography variant="caption" sx={{ color: "#9DB4A6" }}>
              Made for the people who keep places running.
            </Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
