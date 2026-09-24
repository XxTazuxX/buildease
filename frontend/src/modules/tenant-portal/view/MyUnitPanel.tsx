import { Paper, Stack, Typography } from "@mui/material";
import { StatusChip } from "@/shared/components/Surface";
import { useOccupancy } from "@/modules/occupancy/viewmodel/useOccupancy";

export function MyUnitPanel({
  org,
  building,
}: {
  org: string;
  building: string;
}) {
  const { residents, spaces } = useOccupancy(org, building);
  const resident = residents.data?.[0];
  const space = spaces.data?.find((s) => s.id === resident?.space_id);
  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 3 }}>
      <Typography variant="overline" color="primary.main">
        My unit
      </Typography>
      <Typography variant="h5">Your home</Typography>
      {!resident?.space_id ? (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          You don&apos;t have an active unit assignment yet.
        </Typography>
      ) : (
        <Stack spacing={1} sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Typography sx={{ fontWeight: 800 }}>
              {space ? `${space.name} · ${space.code}` : "Unit"}
            </Typography>
            <StatusChip active={resident.active} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Move-in{" "}
            {resident.starts_on
              ? new Date(resident.starts_on).toLocaleDateString()
              : "—"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Resident: {resident.display_name}
            {resident.phone ? ` · ${resident.phone}` : ""}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Household members aren&apos;t shown here yet — ask your property
            manager for details.
          </Typography>
        </Stack>
      )}
    </Paper>
  );
}
