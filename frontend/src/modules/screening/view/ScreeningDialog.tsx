import {
  Alert,
  Button,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { StatusChip } from "@/shared/components/Surface";
import { useScreenings } from "../viewmodel/useScreenings";

export function ScreeningDialog({
  org,
  building,
  prospect,
  prospectName,
  onClose,
}: {
  org: string;
  building: string;
  prospect: string;
  prospectName: string;
  onClose: () => void;
}) {
  const vm = useScreenings(org, building, prospect);
  return (
    <AdaptiveDialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Screening · {prospectName}</DialogTitle>
      <Divider />
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {(vm.error || vm.list.error) && (
            <Alert severity="error">{vm.error || vm.list.error?.message}</Alert>
          )}
          <Button
            variant="contained"
            disabled={vm.busy}
            onClick={() => void vm.request()}
          >
            Request screening
          </Button>
          <Divider />
          <Typography variant="overline" color="text.secondary">
            Reports
          </Typography>
          {vm.list.data?.length === 0 && (
            <Typography color="text.secondary">
              No screenings requested yet.
            </Typography>
          )}
          {vm.list.data?.map((item) => (
            <Stack key={item.id} spacing={0.5}>
              <StatusChip active={item.status === "PASS"} label={item.status} />
              {item.report && (
                <Typography variant="body2" color="text.secondary">
                  {item.report}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                Requested {new Date(item.requested_at).toLocaleString()}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
    </AdaptiveDialog>
  );
}
