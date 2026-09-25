import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { useMaintenance } from "../viewmodel/useMaintenance";
import { ReportIssueDialog } from "./ReportIssueDialog";
import { RequestDetailDialog } from "./RequestDetailDialog";

export function MaintenancePanel({
  org,
  building,
  canManage,
  canReport = true,
}: {
  org: string;
  building: string;
  canManage: boolean;
  canReport?: boolean;
}) {
  const vm = useMaintenance(org, building);
  const [createOpen, setCreateOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [viewingRequest, setViewingRequest] = useState<string | null>(null);
  const [assigningRequest, setAssigningRequest] = useState<string | null>(null);
  const [vendorsOpen, setVendorsOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<"staff" | "vendor">(
    "vendor",
  );
  const [assignAccountId, setAssignAccountId] = useState("");
  const [assignVendorId, setAssignVendorId] = useState("");
  const [assignEstimate, setAssignEstimate] = useState("");
  const [newVendor, setNewVendor] = useState({
    name: "",
    email: "",
    phone: "",
    accountId: "",
  });
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
          {canManage && (
            <Button variant="outlined" onClick={() => setVendorsOpen(true)}>
              Vendors
            </Button>
          )}
          {canReport && (
            <Button variant="contained" onClick={() => setCreateOpen(true)}>
              Report issue
            </Button>
          )}
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
                  <Button onClick={() => setViewingRequest(item.id)}>
                    View
                  </Button>
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
                  {canManage && item.status === "TRIAGED" && (
                    <Button
                      disabled={vm.busy}
                      onClick={() => {
                        setAssignTarget("vendor");
                        setAssignAccountId("");
                        setAssignVendorId("");
                        setAssignEstimate("");
                        setAssigningRequest(item.id);
                      }}
                    >
                      Assign
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
      {canReport && (
        <ReportIssueDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          vm={vm}
        />
      )}
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

      {viewingRequest && (
        <RequestDetailDialog
          org={org}
          building={building}
          request={viewingRequest}
          canManage={canManage}
          onClose={() => setViewingRequest(null)}
        />
      )}

      {assigningRequest && (
        <AdaptiveDialog
          open
          onClose={() => setAssigningRequest(null)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Assign work</DialogTitle>
          <Divider />
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {vm.error && <Alert severity="error">{vm.error}</Alert>}
              <TextField
                select
                label="Assign to"
                value={assignTarget}
                onChange={(e) =>
                  setAssignTarget(e.target.value as "staff" | "vendor")
                }
              >
                <MenuItem value="vendor">Vendor</MenuItem>
                <MenuItem value="staff">Staff account</MenuItem>
              </TextField>
              {assignTarget === "vendor" ? (
                <TextField
                  select
                  label="Vendor"
                  value={assignVendorId}
                  onChange={(e) => setAssignVendorId(e.target.value)}
                >
                  {vm.vendors.data?.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.name}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  label="Staff account ID"
                  helperText="Copy the account ID from the People page"
                  value={assignAccountId}
                  onChange={(e) => setAssignAccountId(e.target.value)}
                />
              )}
              <TextField
                label="Estimated cost (optional)"
                type="number"
                value={assignEstimate}
                onChange={(e) => setAssignEstimate(e.target.value)}
              />
              <Button
                variant="contained"
                disabled={
                  vm.busy ||
                  (assignTarget === "vendor"
                    ? !assignVendorId
                    : !assignAccountId)
                }
                onClick={() =>
                  void (
                    assignTarget === "vendor"
                      ? vm.assignVendor(
                          assigningRequest,
                          assignVendorId,
                          assignEstimate ? Number(assignEstimate) : undefined,
                        )
                      : vm.assignStaff(
                          assigningRequest,
                          assignAccountId,
                          assignEstimate ? Number(assignEstimate) : undefined,
                        )
                  ).then((ok) => ok && setAssigningRequest(null))
                }
              >
                Assign
              </Button>
            </Stack>
          </DialogContent>
        </AdaptiveDialog>
      )}

      <AdaptiveDialog
        open={vendorsOpen}
        onClose={() => setVendorsOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Vendors</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {vm.vendors.data?.length === 0 && (
              <Typography color="text.secondary">
                No vendors yet. Add the first one below.
              </Typography>
            )}
            <Stack spacing={1}>
              {vm.vendors.data?.map((item) => (
                <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Typography sx={{ fontWeight: 700 }}>{item.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {[item.email, item.phone].filter(Boolean).join(" · ") ||
                      "No contact details"}
                  </Typography>
                </Paper>
              ))}
            </Stack>
            <Divider />
            <Typography variant="subtitle2">Add a vendor</Typography>
            <TextField
              label="Vendor name"
              value={newVendor.name}
              onChange={(e) =>
                setNewVendor({ ...newVendor, name: e.target.value })
              }
            />
            <TextField
              label="Email (optional)"
              value={newVendor.email}
              onChange={(e) =>
                setNewVendor({ ...newVendor, email: e.target.value })
              }
            />
            <TextField
              label="Phone (optional)"
              value={newVendor.phone}
              onChange={(e) =>
                setNewVendor({ ...newVendor, phone: e.target.value })
              }
            />
            <TextField
              label="Link to account ID (optional)"
              helperText="The account must already have the Vendor role in this building"
              value={newVendor.accountId}
              onChange={(e) =>
                setNewVendor({ ...newVendor, accountId: e.target.value })
              }
            />
            <Button
              variant="contained"
              disabled={vm.busy || !newVendor.name.trim()}
              onClick={() =>
                void vm
                  .createVendor({
                    name: newVendor.name,
                    email: newVendor.email || undefined,
                    phone: newVendor.phone || undefined,
                    accountId: newVendor.accountId || undefined,
                  })
                  .then((ok) => {
                    if (ok)
                      setNewVendor({
                        name: "",
                        email: "",
                        phone: "",
                        accountId: "",
                      });
                  })
              }
            >
              Add vendor
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>
    </Paper>
  );
}
