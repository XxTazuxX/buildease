import { Button, Chip, Stack } from "@mui/material";
export function Pager({
  page,
  count,
  onChange,
}: {
  page: number;
  count: number;
  onChange: (page: number) => void;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ alignItems: "center", justifyContent: "flex-end", my: 2.5 }}
    >
      <Button
        variant="outlined"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        ← Previous
      </Button>
      <Chip label={`Page ${page + 1}`} variant="outlined" />
      <Button
        variant="outlined"
        disabled={count < 50}
        onClick={() => onChange(page + 1)}
      >
        Next →
      </Button>
    </Stack>
  );
}
