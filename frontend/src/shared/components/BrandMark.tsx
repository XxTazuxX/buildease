import { Box, Stack, Typography } from "@mui/material";

export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
      <Box
        aria-hidden
        sx={{
          width: 36,
          height: 36,
          display: "grid",
          placeItems: "center",
          borderRadius: "11px 11px 11px 3px",
          bgcolor: inverse ? "#79C8B7" : "primary.main",
          color: inverse ? "#0D3432" : "white",
          fontWeight: 900,
          fontSize: 19,
          boxShadow: inverse ? "none" : "0 8px 18px rgba(21,94,87,.2)",
        }}
      >
        B
      </Box>
      <Typography
        variant="h6"
        sx={{
          color: inverse ? "white" : "text.primary",
          letterSpacing: "-0.03em",
        }}
      >
        BuildEase
      </Typography>
    </Stack>
  );
}
