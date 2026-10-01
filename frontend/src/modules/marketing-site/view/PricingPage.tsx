import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import {
  CycleToggle,
  PlanCards,
  usePublicPlans,
  type BillingCycle,
} from "@/modules/billing";
import { PublicLayout } from "./PublicLayout";

export const faqs = [
  {
    question: "How does the free trial work?",
    answer:
      "Every new workspace starts with a 14-day trial of the full product for one building. No card is required. When the trial ends your data stays safe and read-only until you choose a plan.",
  },
  {
    question: "How am I billed?",
    answer:
      "Choose a plan from Billing inside your workspace. Our team confirms it and sends an invoice each month or year, payable by bank transfer.",
  },
  {
    question: "Do tenants count toward my staff seats?",
    answer:
      "No. Residents and vendors are always free. Seats are only used by owners and staff roles such as property managers, accountants and maintenance staff.",
  },
  {
    question: "Can I change plans later?",
    answer:
      "Yes. Request an upgrade or downgrade from Billing at any time; changes take effect once confirmed.",
  },
];

export function PricingSection() {
  const plans = usePublicPlans();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  return (
    <Stack spacing={3} sx={{ alignItems: "center" }}>
      <CycleToggle cycle={cycle} onChange={setCycle} />
      {plans.isLoading && <CircularProgress aria-label="Loading plans" />}
      {plans.isError && (
        <Alert severity="error">Pricing is unavailable right now.</Alert>
      )}
      {plans.data && (
        <Box sx={{ width: "100%" }}>
          <PlanCards
            plans={plans.data}
            cycle={cycle}
            actionLabel={() => "Start free trial"}
            onSelect={() => navigate("/register")}
          />
        </Box>
      )}
    </Stack>
  );
}

export function PricingPage() {
  return (
    <PublicLayout>
      <Container
        maxWidth="lg"
        sx={{ py: { xs: 5, md: 8 }, px: { xs: 2, sm: 3 } }}
      >
        <Box sx={{ textAlign: "center", mb: 5 }}>
          <Typography variant="overline" color="primary.main">
            Pricing
          </Typography>
          <Typography variant="h3" sx={{ mt: 1 }}>
            Simple plans that grow with your portfolio
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1.5 }}>
            Start free for 14 days. Tenants and vendors are always free.
          </Typography>
        </Box>
        <PricingSection />
        <Box sx={{ maxWidth: 760, mx: "auto", mt: 8 }}>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Frequently asked questions
          </Typography>
          {faqs.map((faq) => (
            <Accordion key={faq.question} disableGutters>
              <AccordionSummary>
                <Typography sx={{ fontWeight: 700 }}>{faq.question}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography color="text.secondary">{faq.answer}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Container>
    </PublicLayout>
  );
}
