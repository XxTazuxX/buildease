import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { impacts, type Impact } from "../model/maintenance";
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
  const [request, setRequest] = useState({
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
          <TextField
            select
            label="Space"
            value={request.spaceId}
            onChange={(e) =>
              setRequest({ ...request, spaceId: e.target.value })
            }
          >
            {spaces?.map((space) => (
              <MenuItem key={space.id} value={space.id}>
                {space.name} · {space.code}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Category"
            value={request.categoryId}
            onChange={(e) =>
              setRequest({ ...request, categoryId: e.target.value })
            }
          >
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
          <TextField
            label="Short title"
            value={request.title}
            onChange={(e) => setRequest({ ...request, title: e.target.value })}
            slotProps={{ htmlInput: { maxLength: 160 } }}
          />
          <TextField
            label="What happened?"
            multiline
            minRows={4}
            value={request.description}
            onChange={(e) =>
              setRequest({ ...request, description: e.target.value })
            }
            slotProps={{ htmlInput: { maxLength: 4000 } }}
          />
          <TextField
            select
            label="Impact"
            value={request.impact}
            onChange={(e) =>
              setRequest({ ...request, impact: e.target.value as Impact })
            }
          >
            {impacts.map((impact) => (
              <MenuItem key={impact} value={impact}>
                {impact}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Checkbox
                checked={request.danger}
                onChange={(_, checked) =>
                  setRequest({ ...request, danger: checked })
                }
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
              onChange={(event) => setPhoto(event.target.files?.[0])}
            />
          </Button>
          <Button
            variant="contained"
            disabled={vm.busy || !request.spaceId || !request.categoryId}
            onClick={() =>
              void vm.submit(request, photo).then((ok) => {
                if (ok) {
                  setPhoto(undefined);
                  onClose();
                }
              })
            }
          >
            Submit request
          </Button>
        </Stack>
      </DialogContent>
    </AdaptiveDialog>
  );
}
