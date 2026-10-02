import { Paper, Stack, Typography } from "@mui/material";
import { StatusChip } from "@/shared/components/Surface";
import { useOccupancy } from "@/modules/occupancy/viewmodel/useOccupancy";
import { QueryError } from "@/shared/components/QueryError";
import { formatDate } from "@/shared/utils/dates";
import { DetailSkeleton } from "@/shared/components/Skeletons";

export function MyUnitPanel({
  org,
  building,
}: {
  org: string;
  building: string;
}) {
  const { residents, spaces } = useOccupancy(org, building);
  const failed = [residents, spaces];
  const resident = residents.data?.[0];
  const space = spaces.data?.find((s) => s.id === resident?.space_id);
  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 3 }}>
      <Typography variant="overline" color="primary.main">
        My unit
      </Typography>
      <Typography variant="h5">Your home</Typography>
      <QueryError queries={failed} what="your unit" />
      {residents.isLoading ? (
        <DetailSkeleton label="Loading your unit" />
      ) : residents.isError ? null : !resident?.space_id ? (
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
            Move-in {resident.starts_on ? formatDate(resident.starts_on) : "—"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Resident: {resident.display_name}
            {resident.phone ? ` · ${resident.phone}` : ""}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Household:{" "}
            {resident.household && resident.household.length > 0
              ? resident.household
                  .map((member) =>
                    member.relationship
                      ? `${member.name} (${member.relationship})`
                      : member.name,
                  )
                  .join(", ")
              : "No other household members on file. Ask your property manager to add them."}
          </Typography>
        </Stack>
      )}
    </Paper>
  );
}
