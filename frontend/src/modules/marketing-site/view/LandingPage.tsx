import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { PublicLayout } from "./PublicLayout";
import { PricingSection } from "./PricingPage";

export const features = [
  {
    title: "Maintenance that closes the loop",
    body: "Residents report issues with photos, managers triage against SLAs, staff and vendors log work, and residents confirm the fix.",
  },
  {
    title: "Leases, rent and deposits",
    body: "Draft and e-sign leases, generate rent automatically, apply late fees, record payments and track every balance.",
  },
  {
    title: "Occupancy you can trust",
    body: "Buildings, floors and units with a full history of who lived where and when, including households.",
  },
  {
    title: "Leasing pipeline",
    body: "Publish listings, capture prospects, record screening and convert approved applicants straight into leases.",
  },
  {
    title: "Inspections & assets",
    body: "Move-in and move-out inspections with photo evidence, plus an equipment register with meter readings.",
  },
  {
    title: "Reports & integrations",
    body: "Rent roll, income statement and occupancy reports with CSV export, API keys and accounting sync.",
  },
];

const steps = [
  [
    "Create your workspace",
    "Sign up and verify your email — it takes a minute.",
  ],
  [
    "Add buildings and units",
    "Model floors, units and common areas, then invite your team.",
  ],
  [
    "Invite residents",
    "Tenants get a portal for their lease, balance and repair requests.",
  ],
];

export function LandingPage() {
  return (
    <PublicLayout>
      <Box
        sx={{
          background:
            "linear-gradient(135deg, #102E2D 0%, #155E57 60%, #72B5A2 100%)",
          color: "white",
        }}
      >
        <Container
          maxWidth="lg"
          sx={{ py: { xs: 8, md: 12 }, px: { xs: 2, sm: 3 } }}
        >
          <Box sx={{ maxWidth: 720 }}>
            <Typography variant="overline" sx={{ color: "#B6E3D8" }}>
              Property operations platform
            </Typography>
            <Typography
              variant="h2"
              sx={{ mt: 1, fontSize: { xs: 36, md: 56 }, lineHeight: 1.1 }}
            >
              Run every building from one calm workspace.
            </Typography>
            <Typography sx={{ mt: 2.5, fontSize: 18, color: "#D5ECE6" }}>
              BuildEase brings maintenance, leases, rent, occupancy and your
              residents together — so nothing falls through the cracks.
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ mt: 4 }}
            >
              <Button
                component={RouterLink}
                to="/register"
                variant="contained"
                color="secondary"
                size="large"
              >
                Start your 14-day free trial
              </Button>
              <Button
                component={RouterLink}
                to="/pricing"
                size="large"
                sx={{ color: "white", borderColor: "rgba(255,255,255,.5)" }}
                variant="outlined"
              >
                See pricing
              </Button>
            </Stack>
            <Typography variant="body2" sx={{ mt: 2, color: "#B6E3D8" }}>
              No card required · tenants are always free
            </Typography>
          </Box>
        </Container>
      </Box>

      <Container
        maxWidth="lg"
        sx={{ py: { xs: 6, md: 9 }, px: { xs: 2, sm: 3 } }}
      >
        <Typography variant="h4" sx={{ textAlign: "center", mb: 5 }}>
          Everything your operations team needs
        </Typography>
        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              md: "repeat(3, 1fr)",
            },
          }}
        >
          {features.map((feature) => (
            <Paper key={feature.title} variant="outlined" sx={{ p: 3 }}>
              <Typography variant="h6">{feature.title}</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {feature.body}
              </Typography>
            </Paper>
          ))}
        </Box>

        <Typography variant="h4" sx={{ textAlign: "center", mt: 10, mb: 5 }}>
          Up and running in an afternoon
        </Typography>
        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          }}
        >
          {steps.map(([title, body], index) => (
            <Box key={title}>
              <Typography variant="h3" color="primary.main">
                {index + 1}
              </Typography>
              <Typography variant="h6">{title}</Typography>
              <Typography color="text.secondary">{body}</Typography>
            </Box>
          ))}
        </Box>

        <Box id="pricing" sx={{ mt: 10 }}>
          <Typography variant="h4" sx={{ textAlign: "center", mb: 1 }}>
            Plans for every portfolio
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ textAlign: "center", mb: 4 }}
          >
            Start free, upgrade when you are ready.
          </Typography>
          <PricingSection />
        </Box>
      </Container>
    </PublicLayout>
  );
}
