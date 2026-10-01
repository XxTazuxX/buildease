import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  limitLabel,
  money,
  type BillingCycle,
  type Plan,
} from "../model/billing";

export function CycleToggle({
  cycle,
  onChange,
}: {
  cycle: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={cycle}
      onChange={(_, value: BillingCycle | null) => value && onChange(value)}
      aria-label="Billing cycle"
    >
      <ToggleButton value="MONTHLY">Monthly</ToggleButton>
      <ToggleButton value="ANNUAL">Annual · 2 months free</ToggleButton>
    </ToggleButtonGroup>
  );
}

export function PlanCards({
  plans,
  cycle,
  currentPlanId,
  highlightCode = "PROFESSIONAL",
  actionLabel,
  onSelect,
  disabled,
}: {
  plans: Plan[];
  cycle: BillingCycle;
  currentPlanId?: string;
  highlightCode?: string;
  actionLabel: (plan: Plan) => string;
  onSelect: (plan: Plan) => void;
  disabled?: boolean;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: {
          xs: "1fr",
          md: `repeat(${Math.min(Math.max(plans.length, 1), 3)}, 1fr)`,
        },
      }}
    >
      {plans.map((plan) => {
        const featured = plan.code === highlightCode;
        const current = plan.id === currentPlanId;
        const price =
          cycle === "ANNUAL" ? plan.annual_price : plan.monthly_price;
        return (
          <Paper
            key={plan.id}
            variant="outlined"
            sx={{
              p: 3,
              display: "flex",
              flexDirection: "column",
              borderWidth: featured ? 2 : 1,
              borderColor: featured ? "primary.main" : "divider",
            }}
          >
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <Typography variant="h6">{plan.name}</Typography>
              {current ? (
                <Chip size="small" color="success" label="Current plan" />
              ) : (
                featured && (
                  <Chip size="small" color="primary" label="Most popular" />
                )
              )}
            </Stack>
            {plan.description && (
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                {plan.description}
              </Typography>
            )}
            <Typography variant="h4" sx={{ mt: 2 }}>
              {money(price, plan.currency)}
              <Typography
                component="span"
                color="text.secondary"
                sx={{ fontSize: 15, ml: 0.75 }}
              >
                / {cycle === "ANNUAL" ? "year" : "month"}
              </Typography>
            </Typography>
            <Stack component="ul" spacing={0.75} sx={{ pl: 2.5, my: 2 }}>
              <Typography component="li" variant="body2">
                {limitLabel(plan.max_buildings, "building")}
              </Typography>
              <Typography component="li" variant="body2">
                {limitLabel(plan.max_spaces, "unit")}
              </Typography>
              <Typography component="li" variant="body2">
                {limitLabel(plan.max_staff, "staff seat")} · unlimited tenants
              </Typography>
              {plan.features.map((feature) => (
                <Typography key={feature} component="li" variant="body2">
                  {feature}
                </Typography>
              ))}
            </Stack>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant={featured ? "contained" : "outlined"}
              disabled={disabled}
              onClick={() => onSelect(plan)}
            >
              {actionLabel(plan)}
            </Button>
          </Paper>
        );
      })}
    </Box>
  );
}
