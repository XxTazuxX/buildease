import { Alert, Button } from "@mui/material";

/**
 * Shows a failed query instead of letting it read as "no data". Pass the queries a view depends
 * on; the first error wins and Retry refetches every failed query.
 */
export function QueryError({
  queries,
  what = "this information",
}: {
  queries: {
    error: Error | null;
    isError: boolean;
    refetch: () => unknown;
  }[];
  what?: string;
}) {
  const failed = queries.filter((query) => query.isError);
  if (failed.length === 0) return null;
  return (
    <Alert
      severity="error"
      sx={{ my: 2 }}
      action={
        <Button
          color="inherit"
          size="small"
          onClick={() => failed.forEach((query) => void query.refetch())}
        >
          Retry
        </Button>
      }
    >
      Could not load {what}
      {failed[0].error?.message ? `: ${failed[0].error.message}` : "."}
    </Alert>
  );
}
