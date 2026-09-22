import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { impacts, type Impact } from "../model/maintenance";
import { useMaintenance } from "../viewmodel/useMaintenance";

export function MaintenancePanel({
  org,
  building,
  canManage,
}: {
  org: string;
  building: string;
  canManage: boolean;
}) {
  const vm = useMaintenance(org, building);
  const [createOpen, setCreateOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [photo, setPhoto] = useState<File>();
  const [request, setRequest] = useState({
    spaceId: "",
    categoryId: "",
    title: "",
    description: "",
    impact: "MEDIUM" as Impact,
    danger: false,
  });
  const [category, setCategory] = useState({
    name: "",
    responseHours: 4,
    resolutionHours: 48,
  });
  const error =
    vm.error ||
    vm.categories.error?.message ||
    vm.requests.error?.message ||
    vm.spaces.error?.message;
  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 3 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          gap: 1.5,
          justifyContent: "space-between",
          alignItems: { sm: "center" },
        }}
      >
        <Box>
          <Typography variant="overline" color="primary.main">
            Maintenance desk
          </Typography>
          <Typography variant="h5">Requests and work</Typography>
          <Typography color="text.secondary">
            Report, triage, assign, and confirm building repairs.
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          {canManage && (
            <Button variant="outlined" onClick={() => setCategoryOpen(true)}>
              Add category
            </Button>
          )}
          <Button variant="contained" onClick={() => setCreateOpen(true)}>
            Report issue
          </Button>
        </Stack>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      {!vm.requests.isLoading && vm.requests.data?.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No maintenance requests in this building.
        </Alert>
      )}
      <Stack spacing={1.25} sx={{ mt: 2 }}>
        {vm.requests.data?.map((item) => {
          const priority = item.priority ?? item.suggested_priority;
          const overdue =
            !!item.resolution_due_at &&
            new Date(item.resolution_due_at).getTime() < Date.now() &&
            !["CLOSED", "CANCELLED"].includes(item.status);
          return (
            <Paper
              variant="outlined"
              key={item.id}
              sx={{ p: 2, borderColor: overdue ? "error.light" : undefined }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{ gap: 1.5, alignItems: { sm: "center" } }}
              >
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Typography sx={{ fontWeight: 800 }}>
                      {item.title}
                    </Typography>
                    <Chip
                      size="small"
                      label={item.status.replaceAll("_", " ")}
                    />
                    <Chip
                      size="small"
                      color={
                        priority === "URGENT"
                          ? "error"
                          : priority === "HIGH"
                            ? "warning"
                            : "default"
                      }
                      label={priority}
                    />
                    {item.danger && (
                      <Chip
                        size="small"
                        color="error"
                        label="Danger reported"
                      />
                    )}
                    {overdue && (
                      <Chip
                        size="small"
                        color="error"
                        variant="outlined"
                        label="Overdue"
                      />
                    )}
                  </Stack>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    Impact {item.impact.toLowerCase()} · Opened{" "}
                    {new Date(item.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  {canManage && item.status === "SUBMITTED" && (
                    <Button
                      disabled={vm.busy}
                      onClick={() =>
                        void vm.triage(item.id, item.suggested_priority)
                      }
                    >
                      Confirm priority
                    </Button>
                  )}
                  {item.status === "ASSIGNED" && (
                    <Button
                      disabled={vm.busy}
                      onClick={() => void vm.start(item.id)}
                    >
                      Start work
                    </Button>
                  )}
                  {item.status === "IN_PROGRESS" && (
                    <Button
                      disabled={vm.busy}
                      onClick={() => {
                        const summary = window.prompt("Resolution summary");
                        if (summary) void vm.resolve(item.id, summary);
                      }}
                    >
                      Resolve
                    </Button>
                  )}
                  {item.status === "RESOLVED" && (
                    <Button
                      disabled={vm.busy}
                      onClick={() => void vm.close(item.id, true)}
                    >
                      Confirm resolved
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
      <AdaptiveDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="sm"
      >
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
              {vm.spaces.data?.map((space) => (
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
            <TextField
              label="Short title"
              value={request.title}
              onChange={(e) =>
                setRequest({ ...request, title: e.target.value })
              }
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
                    setCreateOpen(false);
                  }
                })
              }
            >
              Submit request
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>
      <AdaptiveDialog
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add maintenance category</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Category name"
              value={category.name}
              onChange={(e) =>
                setCategory({ ...category, name: e.target.value })
              }
            />
            <TextField
              label="Response target (hours)"
              type="number"
              value={category.responseHours}
              onChange={(e) =>
                setCategory({
                  ...category,
                  responseHours: Number(e.target.value),
                })
              }
            />
            <TextField
              label="Resolution target (hours)"
              type="number"
              value={category.resolutionHours}
              onChange={(e) =>
                setCategory({
                  ...category,
                  resolutionHours: Number(e.target.value),
                })
              }
            />
            <Button
              variant="contained"
              disabled={vm.busy || !category.name.trim()}
              onClick={() =>
                void vm
                  .createCategory(category)
                  .then((ok) => ok && setCategoryOpen(false))
              }
            >
              Create category
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>
    </Paper>
  );
}
