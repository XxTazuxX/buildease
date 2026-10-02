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
import { Pager } from "@/shared/components/Pager";
import { PromptDialog } from "@/shared/components/PromptDialog";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { useZodForm } from "@/shared/forms/useZodForm";
import {
  assignmentFormSchema,
  categoryFormSchema,
  vendorFormSchema,
} from "../model/maintenance";
import { useMaintenance } from "../viewmodel/useMaintenance";
import { RecurringPlansDialog } from "./RecurringPlansDialog";
import { ReportIssueDialog } from "./ReportIssueDialog";
import { RequestDetailDialog } from "./RequestDetailDialog";
import { ListSkeleton } from "@/shared/components/Skeletons";

const emptyCategory = { name: "", responseHours: "4", resolutionHours: "48" };
const emptyVendor = { name: "", email: "", phone: "", accountId: "" };

function AssignWorkDialog({
  vm,
  request,
  close,
}: {
  vm: ReturnType<typeof useMaintenance>;
  request: string;
  close: () => void;
}) {
  const form = useZodForm(assignmentFormSchema, {
    target: "vendor" as "vendor" | "staff",
    vendorId: "",
    accountId: "",
    estimate: "",
  });
  return (
    <AdaptiveDialog open onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>Assign work</DialogTitle>
      <Divider />
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {vm.error && <Alert severity="error">{vm.error}</Alert>}
          <TextField select label="Assign to" {...form.field("target")}>
            <MenuItem value="vendor">Vendor</MenuItem>
            <MenuItem value="staff">Staff account</MenuItem>
          </TextField>
          {form.values.target === "vendor" ? (
            <TextField select label="Vendor" {...form.field("vendorId")}>
              {vm.vendors.data?.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              select
              label="Staff member"
              {...form.field("accountId")}
              helperText={
                form.error("accountId") ??
                "Must hold the Maintenance staff or Property manager role here"
              }
            >
              {(vm.members?.data ?? [])
                .filter((member) => member.status === "ACTIVE")
                .map((member) => (
                  <MenuItem key={member.account_id} value={member.account_id}>
                    {member.display_name} · {member.email}
                  </MenuItem>
                ))}
            </TextField>
          )}
          <TextField
            label="Estimated cost (optional)"
            type="number"
            {...form.field("estimate")}
          />
          <Button
            variant="contained"
            disabled={vm.busy}
            onClick={form.submit(async (values) => {
              const ok = await (values.target === "vendor"
                ? vm.assignVendor(request, values.vendorId, values.estimate)
                : vm.assignStaff(request, values.accountId, values.estimate));
              if (ok) close();
            })}
          >
            Assign
          </Button>
        </Stack>
      </DialogContent>
    </AdaptiveDialog>
  );
}

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
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [editingVendor, setEditingVendor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{
    kind: "category" | "vendor";
    id: string;
    name: string;
  } | null>(null);
  const newVendor = useZodForm(vendorFormSchema, emptyVendor);
  const category = useZodForm(categoryFormSchema, emptyCategory);
  const resetCategoryForm = () => {
    setEditingCategory(null);
    category.reset(emptyCategory);
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
          {canManage && (
            <Button variant="outlined" onClick={() => setRecurringOpen(true)}>
              Recurring
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
        {vm.requests.isLoading && <ListSkeleton label="Loading requests" />}
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
                        void vm.members?.refetch();
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
                      onClick={() => setResolving(item.id)}
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
                  {canManage && item.status === "RESOLVED" && (
                    <Button
                      disabled={vm.busy}
                      onClick={() => void vm.close(item.id, false)}
                    >
                      Reopen
                    </Button>
                  )}
                  {canManage &&
                    !["CLOSED", "CANCELLED"].includes(item.status) && (
                      <Button
                        color="error"
                        disabled={vm.busy}
                        onClick={() => setCancelling(item.id)}
                      >
                        Cancel
                      </Button>
                    )}
                </Stack>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
      {(vm.page > 0 || (vm.requests.data?.length ?? 0) >= 50) && (
        <Pager
          page={vm.page}
          count={vm.requests.data?.length ?? 0}
          onChange={vm.setPage}
        />
      )}
      {canManage && recurringOpen && (
        <RecurringPlansDialog
          org={org}
          building={building}
          categories={vm.categories.data ?? []}
          spaces={vm.spaces.data ?? []}
          onClose={() => setRecurringOpen(false)}
        />
      )}
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
                      <Stack direction="row" spacing={0.5}>
                        <Button
                          size="small"
                          onClick={() => {
                            setEditingCategory(item.id);
                            category.reset({
                              name: item.name,
                              responseHours: String(
                                Math.round(item.response_minutes / 60),
                              ),
                              resolutionHours: String(
                                Math.round(item.resolution_minutes / 60),
                              ),
                            });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          disabled={vm.busy}
                          aria-label={`Delete category ${item.name}`}
                          onClick={() =>
                            setDeleting({
                              kind: "category",
                              id: item.id,
                              name: item.name,
                            })
                          }
                        >
                          Delete
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
            <Divider />
            <Typography variant="subtitle2">
              {editingCategory ? "Edit category" : "Add a category"}
            </Typography>
            <TextField label="Category name" {...category.field("name")} />
            <TextField
              label="Response target (hours)"
              type="number"
              {...category.field("responseHours")}
            />
            <TextField
              label="Resolution target (hours)"
              type="number"
              {...category.field("resolutionHours")}
            />
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                disabled={vm.busy}
                onClick={category.submit(async (values) => {
                  const ok = await (editingCategory
                    ? vm.updateCategory(editingCategory, values)
                    : vm.createCategory(values));
                  if (ok) resetCategoryForm();
                })}
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
        <AssignWorkDialog
          vm={vm}
          request={assigningRequest}
          close={() => setAssigningRequest(null)}
        />
      )}

      {resolving && (
        <PromptDialog
          title="Resolve request"
          fields={[
            {
              name: "summary",
              label: "Resolution summary",
              max: 2000,
              multiline: true,
            },
          ]}
          label="Resolve"
          error={vm.error}
          onClose={() => setResolving(null)}
          onSubmit={async (values) => {
            if (await vm.resolve(resolving, values.summary)) setResolving(null);
          }}
        />
      )}

      {cancelling && (
        <PromptDialog
          title="Cancel request"
          fields={[
            {
              name: "reason",
              label: "Reason for cancelling",
              max: 500,
              multiline: true,
            },
          ]}
          label="Cancel request"
          error={vm.error}
          onClose={() => setCancelling(null)}
          onSubmit={async (values) => {
            if (await vm.cancel(cancelling, values.reason)) setCancelling(null);
          }}
        />
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
                        {[item.email, item.phone].filter(Boolean).join(" · ") ||
                          "No contact details"}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <Button
                        size="small"
                        disabled={vm.busy}
                        aria-label={`Edit vendor ${item.name}`}
                        onClick={() => {
                          setEditingVendor(item.id);
                          newVendor.reset({
                            name: item.name,
                            email: item.email ?? "",
                            phone: item.phone ?? "",
                            accountId: item.account_id ?? "",
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        disabled={vm.busy}
                        aria-label={`Delete vendor ${item.name}`}
                        onClick={() =>
                          setDeleting({
                            kind: "vendor",
                            id: item.id,
                            name: item.name,
                          })
                        }
                      >
                        Delete
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
            <Divider />
            <Typography variant="subtitle2">
              {editingVendor ? "Edit vendor" : "Add a vendor"}
            </Typography>
            <TextField label="Vendor name" {...newVendor.field("name")} />
            <TextField label="Email (optional)" {...newVendor.field("email")} />
            <TextField label="Phone (optional)" {...newVendor.field("phone")} />
            <TextField
              label="Link to account ID (optional)"
              {...newVendor.field("accountId")}
              helperText={
                newVendor.error("accountId") ??
                "The account must already have the Vendor role in this building"
              }
            />
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                disabled={vm.busy}
                onClick={newVendor.submit(async (values) => {
                  const body = {
                    name: values.name,
                    email: values.email || undefined,
                    phone: values.phone || undefined,
                    accountId: values.accountId || undefined,
                  };
                  const ok = await (editingVendor
                    ? vm.updateVendor(editingVendor, body)
                    : vm.createVendor(body));
                  if (ok) {
                    setEditingVendor(null);
                    newVendor.reset(emptyVendor);
                  }
                })}
              >
                {editingVendor ? "Save vendor" : "Add vendor"}
              </Button>
              {editingVendor && (
                <Button
                  onClick={() => {
                    setEditingVendor(null);
                    newVendor.reset(emptyVendor);
                  }}
                >
                  Cancel edit
                </Button>
              )}
            </Stack>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.kind}`}
          confirmLabel={`Delete ${deleting.kind}`}
          busy={vm.busy}
          error={vm.error}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const ok = await (deleting.kind === "category"
              ? vm.deleteCategory(deleting.id)
              : vm.deleteVendor(deleting.id));
            if (ok) setDeleting(null);
          }}
        >
          Permanently delete &ldquo;{deleting.name}&rdquo;? This cannot be
          undone.{" "}
          {deleting.kind === "category"
            ? "A category that has requests or recurring plans can't be deleted; rename it instead."
            : "A vendor that has been assigned work can't be deleted."}
        </ConfirmDialog>
      )}
    </Paper>
  );
}
