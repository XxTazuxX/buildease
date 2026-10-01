import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormHelperText,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { useZodForm } from "@/shared/forms/useZodForm";
import {
  impacts,
  photoProblem,
  requestSchema,
  type Impact,
} from "../model/maintenance";
import type { useMaintenance } from "../viewmodel/useMaintenance";
import type { Space } from "@/modules/buildings/model/buildings";

export function ReportIssueDialog({
  open,
  onClose,
  vm,
  spaceOptions,
}: {
  open: boolean;
  onClose: () => void;
  vm: ReturnType<typeof useMaintenance>;
  spaceOptions?: Space[];
}) {
  const [photo, setPhoto] = useState<File>();
  const [photoError, setPhotoError] = useState<string | null>(null);
  const request = useZodForm(requestSchema, {
    spaceId: "",
    categoryId: "",
    title: "",
    description: "",
    impact: "MEDIUM" as Impact,
    danger: false,
  });
  const spaces = spaceOptions ?? vm.spaces.data;
  return (
    <AdaptiveDialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Report maintenance issue</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField select label="Space" {...request.field("spaceId")}>
            {spaces?.map((space) => (
              <MenuItem key={space.id} value={space.id}>
                {space.name} · {space.code}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Category" {...request.field("categoryId")}>
            {vm.categories.data?.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.name}
              </MenuItem>
            ))}
          </TextField>
          {!vm.categories.isLoading && vm.categories.data?.length === 0 && (
            <Alert severity="warning">
              No maintenance categories exist yet for this building. Ask a
              property manager to add one before a request can be submitted.
            </Alert>
          )}
          <TextField label="Short title" {...request.field("title")} />
          <TextField
            label="What happened?"
            multiline
            minRows={4}
            {...request.field("description")}
          />
          <TextField select label="Impact" {...request.field("impact")}>
            {impacts.map((impact) => (
              <MenuItem key={impact} value={impact}>
                {impact}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Checkbox
                checked={request.values.danger}
                onChange={(_, checked) => request.setValue("danger", checked)}
              />
            }
            label="This may be dangerous or cause immediate damage"
          />
          <Button component="label" variant="outlined">
            {photo ? `Photo: ${photo.name}` : "Add a photo (optional)"}
            <input
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setPhotoError(file ? photoProblem(file) : null);
                setPhoto(file);
              }}
            />
          </Button>
          {photoError && <FormHelperText error>{photoError}</FormHelperText>}
          <Button
            variant="contained"
            disabled={vm.busy}
            onClick={request.submit(async (values) => {
              if (photoError) return;
              if (await vm.submit(values, photo)) {
                setPhoto(undefined);
                request.reset();
                onClose();
              }
            })}
          >
            Submit request
          </Button>
        </Stack>
      </DialogContent>
    </AdaptiveDialog>
  );
}
