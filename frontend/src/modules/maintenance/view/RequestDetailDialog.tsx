import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { useZodForm } from "@/shared/forms/useZodForm";
import {
  commentFormSchema,
  workCostFormSchema,
  workLogFormSchema,
  type WorkLog,
  type WorkOrder,
} from "../model/maintenance";
import { useRequestDetail } from "../viewmodel/useMaintenance";
import { DetailSkeleton } from "@/shared/components/Skeletons";

function WorkOrderSection({
  order,
  logs,
  canManage,
  detail,
}: {
  order: WorkOrder;
  logs: WorkLog[];
  canManage: boolean;
  detail: ReturnType<typeof useRequestDetail>;
}) {
  const cost = useZodForm(workCostFormSchema, { actualCost: "" });
  const log = useZodForm(workLogFormSchema, { note: "", minutes: "" });
  return (
    <Box sx={{ pl: 1, borderLeft: "2px solid", borderColor: "divider" }}>
      <Typography variant="body2">
        {order.status.replaceAll("_", " ")} · Estimated{" "}
        {order.estimated_cost ?? "—"} {order.currency}
        {order.actual_cost ? ` · Actual ${order.actual_cost}` : ""}
      </Typography>
      {canManage && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 0.5, mb: 1, alignItems: "flex-start" }}
        >
          <TextField
            size="small"
            label="Actual cost"
            type="number"
            {...cost.field("actualCost")}
          />
          <Button
            size="small"
            disabled={detail.busy}
            onClick={cost.submit((values) =>
              detail.updateWorkCosts(order.id, {
                actualCost: values.actualCost,
              }),
            )}
          >
            Save cost
          </Button>
        </Stack>
      )}
      {logs.map((entry) => (
        <Typography key={entry.id} variant="body2" color="text.secondary">
          {entry.note}
          {entry.minutes ? ` (${entry.minutes} min)` : ""}
        </Typography>
      ))}
      <Stack
        direction="row"
        spacing={1}
        sx={{ mt: 0.5, alignItems: "flex-start" }}
      >
        <TextField
          size="small"
          label="Add work note"
          {...log.field("note")}
          sx={{ flexGrow: 1 }}
        />
        <TextField
          size="small"
          label="Minutes"
          type="number"
          {...log.field("minutes")}
          sx={{ width: 100 }}
        />
        <Button
          size="small"
          disabled={detail.busy}
          onClick={log.submit(async (values) => {
            const ok = await detail.addWorkLog(
              order.id,
              values.note,
              values.minutes,
            );
            if (ok) log.reset({ note: "", minutes: "" });
          })}
        >
          Log
        </Button>
      </Stack>
    </Box>
  );
}

export function RequestDetailDialog({
  org,
  building,
  request,
  canManage,
  onClose,
}: {
  org: string;
  building: string;
  request: string;
  canManage: boolean;
  onClose: () => void;
}) {
  const detail = useRequestDetail(org, building, request);
  const comment = useZodForm(commentFormSchema, { body: "", internal: false });
  const data = detail.query.data;

  return (
    <AdaptiveDialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{data?.title ?? "Request detail"}</DialogTitle>
      <DialogContent>
        {detail.query.isLoading && <DetailSkeleton label="Loading details" />}
        {(detail.error || detail.query.error) && (
          <Alert severity="error">
            {detail.error || detail.query.error?.message}
          </Alert>
        )}
        {data && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              <Chip size="small" label={data.status.replaceAll("_", " ")} />
              <Chip
                size="small"
                label={data.priority ?? data.suggested_priority}
              />
            </Stack>
            <Typography sx={{ whiteSpace: "pre-wrap" }}>
              {data.description}
            </Typography>
            {data.resolution_summary && (
              <Alert severity="success">
                Resolution: {data.resolution_summary}
              </Alert>
            )}

            <Divider />
            <Typography variant="overline" color="text.secondary">
              Work orders
            </Typography>
            {data.work_orders.length === 0 && (
              <Typography color="text.secondary">Not yet assigned.</Typography>
            )}
            {data.work_orders.map((order) => (
              <WorkOrderSection
                key={order.id}
                order={order}
                logs={data.work_logs.filter(
                  (entry) => entry.work_order_id === order.id,
                )}
                canManage={canManage}
                detail={detail}
              />
            ))}

            <Divider />
            <Typography variant="overline" color="text.secondary">
              Comments
            </Typography>
            {data.comments.length === 0 && (
              <Typography color="text.secondary">No comments yet.</Typography>
            )}
            {data.comments.map((item) => (
              <Typography key={item.id} variant="body2">
                {item.internal && (
                  <Chip size="small" label="Internal" sx={{ mr: 1 }} />
                )}
                {item.body}
              </Typography>
            ))}
            <Stack spacing={1}>
              <TextField
                label="Add a comment"
                multiline
                minRows={2}
                {...comment.field("body")}
              />
              {canManage && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={comment.values.internal}
                      onChange={(_, checked) =>
                        comment.setValue("internal", checked)
                      }
                    />
                  }
                  label="Internal note (not visible to the resident)"
                />
              )}
              <Button
                variant="outlined"
                disabled={detail.busy}
                onClick={comment.submit(async (values) => {
                  const ok = await detail.comment(
                    values.body,
                    canManage && values.internal,
                  );
                  if (ok)
                    comment.reset({ body: "", internal: values.internal });
                })}
              >
                Add comment
              </Button>
            </Stack>

            <Divider />
            <Typography variant="overline" color="text.secondary">
              Photos
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {data.photos.length} photo{data.photos.length === 1 ? "" : "s"}{" "}
              attached
            </Typography>
            {data.photos.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                {data.photos.map((photo, index) => (
                  <Button
                    key={photo.id}
                    size="small"
                    variant="outlined"
                    onClick={() => void detail.openPhoto(photo.id)}
                  >
                    View photo {index + 1}
                  </Button>
                ))}
              </Stack>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void detail.uploadPhoto(file);
                event.target.value = "";
              }}
            />
          </Stack>
        )}
      </DialogContent>
    </AdaptiveDialog>
  );
}
