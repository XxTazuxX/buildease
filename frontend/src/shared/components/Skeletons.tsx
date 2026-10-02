import { Box, Paper, Skeleton, Stack } from "@mui/material";

/** Marks a placeholder region so assistive tech announces a single "loading" state. */
function Busy({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box role="status" aria-busy="true" aria-label={label}>
      {children}
    </Box>
  );
}

/** Placeholder rows shaped like the bordered list rows used across the app. */
export function ListSkeleton({
  rows = 3,
  label = "Loading",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <Busy label={label}>
      <Stack spacing={1}>
        {Array.from({ length: rows }, (_, index) => (
          <Paper key={index} variant="outlined" sx={{ p: 1.75 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{ gap: 1.5, alignItems: { sm: "center" } }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Skeleton variant="text" width="38%" height={28} />
                <Skeleton variant="text" width="62%" />
              </Box>
              <Skeleton variant="rounded" width={86} height={26} />
              <Skeleton variant="rounded" width={72} height={32} />
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Busy>
  );
}

/** Placeholder tiles for card grids (spaces, plans). */
export function CardGridSkeleton({
  count = 4,
  label = "Loading",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <Busy label={label}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
          },
          gap: 1,
        }}
      >
        {Array.from({ length: count }, (_, index) => (
          <Paper key={index} variant="outlined" sx={{ p: 1.75 }}>
            <Skeleton variant="text" width="55%" height={26} />
            <Skeleton variant="text" width="35%" />
            <Skeleton variant="text" width="70%" sx={{ mt: 1 }} />
          </Paper>
        ))}
      </Box>
    </Busy>
  );
}

/** Placeholder table body rows. */
export function TableSkeleton({
  rows = 4,
  columns = 5,
  label = "Loading",
}: {
  rows?: number;
  columns?: number;
  label?: string;
}) {
  return (
    <Busy label={label}>
      <Stack spacing={1.25}>
        {Array.from({ length: rows }, (_, row) => (
          <Stack key={row} direction="row" spacing={2}>
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton
                key={column}
                variant="text"
                sx={{ flex: 1 }}
                height={26}
              />
            ))}
          </Stack>
        ))}
      </Stack>
    </Busy>
  );
}

/** Placeholder for the body of a detail dialog while its record loads. */
export function DetailSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <Busy label={label}>
      <Stack spacing={1.25} sx={{ pt: 1 }}>
        <Skeleton variant="rounded" width={96} height={26} />
        <Skeleton variant="text" width="70%" height={28} />
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="rounded" height={64} />
      </Stack>
    </Busy>
  );
}

/** Placeholder for a whole page while a route or session loads. */
export function PageSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <Busy label={label}>
      <Stack spacing={2} sx={{ p: { xs: 2, sm: 3 } }}>
        <Skeleton variant="text" width={120} height={18} />
        <Skeleton variant="text" width="42%" height={44} />
        <Skeleton variant="text" width="60%" />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
            gap: 2,
          }}
        >
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} variant="rounded" height={92} />
          ))}
        </Box>
        <ListSkeleton rows={3} label={label} />
      </Stack>
    </Busy>
  );
}
