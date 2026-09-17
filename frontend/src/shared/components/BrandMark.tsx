import { Box, Stack, Typography } from "@mui/material";
import brandMark from "@/assets/buildease-mark.png";

export function BrandMark({
  inverse = false,
  compact = false,
}: {
  inverse?: boolean;
  compact?: boolean;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      aria-label={compact ? "BuildEase" : undefined}
      sx={{ alignItems: "center" }}
    >
      <Box
        component="span"
        sx={{
          width: 38,
          height: 38,
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <Box
          component="img"
          src={brandMark}
          alt=""
          aria-hidden="true"
          sx={{
            width: 58,
            height: 58,
            maxWidth: "none",
            display: "block",
          }}
        />
      </Box>
      {!compact && (
        <Typography
          component="span"
          sx={{
            color: inverse ? "white" : "text.primary",
            fontSize: 19,
            fontWeight: 760,
            lineHeight: 1,
            letterSpacing: "-0.045em",
          }}
        >
          BuildEase
        </Typography>
      )}
    </Stack>
  );
}
