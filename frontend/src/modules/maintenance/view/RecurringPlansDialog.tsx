import {
  Alert,
  Button,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { Space } from "@/modules/buildings/model/buildings";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { useZodForm } from "@/shared/forms/useZodForm";
import { formatDate, todayIso } from "@/shared/utils/dates";
import {
  recurringPlanFormSchema,
  type MaintenanceCategory,
} from "../model/maintenance";
import { useRecurringPlans } from "../viewmodel/useMaintenance";

const emptyPlan = () => ({
  spaceId: "",
  categoryId: "",
  title: "",
  description: "",
  intervalDays: "30",
  nextRunOn: todayIso(),
});

export function RecurringPlansDialog({
  org,
  building,
  categories,
  spaces,
  onClose,
}: {
  org: string;
  building: string;
  categories: MaintenanceCategory[];
  spaces: Space[];
  onClose: () => void;
}) {
  const vm = useRecurringPlans(org, building);
  const plan = useZodForm(recurringPlanFormSchema, emptyPlan());
  const spaceName = (id: string) =>
    spaces.find((space) => space.id === id)?.name ?? "Unknown space";
  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? "";
  return (
    <AdaptiveDialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Recurring maintenance</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Preventive work is opened as a new request automatically on each run
            date.
          </Typography>
          {(vm.error || vm.plans.error) && (
            <Alert severity="error">
              {vm.error || vm.plans.error?.message}
            </Alert>
          )}
          {vm.plans.data?.length === 0 && (
            <Typography color="text.secondary">
              No recurring plans yet.
            </Typography>
          )}
          {vm.plans.data?.map((item) => (
            <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
              <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {spaceName(item.space_id)} · {categoryName(item.category_id)} ·
                every {item.interval_days} days · next{" "}
                {formatDate(item.next_run_on)}
              </Typography>
            </Paper>
          ))}
          <Divider />
          <Typography variant="subtitle2">Add a plan</Typography>
          <TextField select label="Space" {...plan.field("spaceId")}>
            {spaces.map((space) => (
              <MenuItem key={space.id} value={space.id}>
                {space.name} · {space.code}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Category" {...plan.field("categoryId")}>
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Title" {...plan.field("title")} />
          <TextField
            label="Work to perform"
            multiline
            minRows={2}
            {...plan.field("description")}
          />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ alignItems: { sm: "flex-start" } }}
          >
            <TextField
              label="Repeat every (days)"
              type="number"
              fullWidth
              {...plan.field("intervalDays")}
            />
            <TextField
              label="First run"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
              {...plan.field("nextRunOn")}
            />
          </Stack>
          <Button
            variant="contained"
            disabled={vm.busy}
            onClick={plan.submit(async (values) => {
              if (await vm.create(values)) plan.reset(emptyPlan());
            })}
          >
            Save plan
          </Button>
        </Stack>
      </DialogContent>
    </AdaptiveDialog>
  );
}
