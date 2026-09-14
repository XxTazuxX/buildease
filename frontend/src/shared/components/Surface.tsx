import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{
        mb: 3.5,
        justifyContent: "space-between",
        alignItems: { xs: "stretch", sm: "flex-end" },
        "& > .MuiButton-root": {
          width: { xs: "100%", sm: "auto" },
          flexShrink: 0,
          whiteSpace: "nowrap",
        },
      }}
    >
      <Box>
        <Typography variant="overline" color="primary.main">
          {eyebrow}
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.4 }}>
          {title}
        </Typography>
        {description && (
          <Typography color="text.secondary" sx={{ mt: 0.9, maxWidth: 650 }}>
            {description}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "green",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "green" | "gold" | "slate";
}) {
  const colors = {
    green: ["#E2F2EC", "#155E57"],
    gold: ["#FFF0D7", "#A75D0A"],
    slate: ["#EBF0EF", "#415653"],
  }[tone];
  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0, height: "100%" }}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontWeight: 650 }}
          >
            {label}
          </Typography>
          <Typography variant="h4" sx={{ mt: 1 }}>
            {value}
          </Typography>
        </Box>
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            bgcolor: colors[1],
            mt: 0.5,
          }}
        />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {detail}
      </Typography>
    </Paper>
  );
}

export function StatusChip({
  active,
  label,
}: {
  active: boolean;
  label?: string;
}) {
  return (
    <Chip
      size="small"
      label={label ?? (active ? "Active" : "Inactive")}
      sx={{
        bgcolor: active ? "#E4F3EC" : "#F2F3F2",
        color: active ? "#176548" : "#6B7472",
        border: active ? "1px solid #C5E6D8" : "1px solid #E0E4E2",
      }}
    />
  );
}
