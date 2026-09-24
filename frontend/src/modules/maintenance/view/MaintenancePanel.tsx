import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { useMaintenance } from "../viewmodel/useMaintenance";
import { ReportIssueDialog } from "./ReportIssueDialog";

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
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [category, setCategory] = useState({
    name: "",
    responseHours: 4,
    resolutionHours: 48,
  });
  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategory({ name: "", responseHours: 4, resolutionHours: 48 });
  };
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
              Categories
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
      <ReportIssueDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        vm={vm}
      />
      <AdaptiveDialog
        open={categoryOpen}
        onClose={() => {
          setCategoryOpen(false);
          resetCategoryForm();
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Maintenance categories</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {!vm.categories.isLoading && vm.categories.data?.length === 0 ? (
              <Typography color="text.secondary">
                No categories yet. Add the first one below.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {vm.categories.data?.map((item) => (
                  <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack
                      direction="row"
                      sx={{
                        gap: 1.5,
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>
                          {item.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Respond within{" "}
                          {Math.round(item.response_minutes / 60)}h · resolve
                          within {Math.round(item.resolution_minutes / 60)}h ·
                          default priority {item.default_priority}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        onClick={() => {
                          setEditingCategory(item.id);
                          setCategory({
                            name: item.name,
                            responseHours: Math.round(
                              item.response_minutes / 60,
                            ),
                            resolutionHours: Math.round(
                              item.resolution_minutes / 60,
                            ),
                          });
                        }}
                      >
                        Edit
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
            <Divider />
            <Typography variant="subtitle2">
              {editingCategory ? "Edit category" : "Add a category"}
            </Typography>
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
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                disabled={vm.busy || !category.name.trim()}
                onClick={() =>
                  void (
                    editingCategory
                      ? vm.updateCategory(editingCategory, category)
                      : vm.createCategory(category)
                  ).then((ok) => ok && resetCategoryForm())
                }
              >
                {editingCategory ? "Save changes" : "Create category"}
              </Button>
              {editingCategory && (
                <Button onClick={resetCategoryForm}>Cancel</Button>
              )}
            </Stack>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>
    </Paper>
  );
}
