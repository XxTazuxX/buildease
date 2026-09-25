import { useState } from "react";
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
import { useRequestDetail } from "../viewmodel/useMaintenance";

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
  const [commentBody, setCommentBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [logNotes, setLogNotes] = useState<Record<string, string>>({});
  const [logMinutes, setLogMinutes] = useState<Record<string, string>>({});
  const [actualCosts, setActualCosts] = useState<Record<string, string>>({});
  const data = detail.query.data;

  return (
    <AdaptiveDialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{data?.title ?? "Request detail"}</DialogTitle>
      <DialogContent>
        {detail.query.isLoading && (
          <Typography color="text.secondary">Loading…</Typography>
        )}
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

            <Divider />
            <Typography variant="overline" color="text.secondary">
              Work orders
            </Typography>
            {data.work_orders.length === 0 && (
              <Typography color="text.secondary">Not yet assigned.</Typography>
            )}
            {data.work_orders.map((order) => (
              <Box
                key={order.id}
                sx={{ pl: 1, borderLeft: "2px solid", borderColor: "divider" }}
              >
                <Typography variant="body2">
                  {order.status.replaceAll("_", " ")} · Estimated{" "}
                  {order.estimated_cost ?? "—"} {order.currency}
                  {order.actual_cost ? ` · Actual ${order.actual_cost}` : ""}
                </Typography>
                {canManage && (
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5, mb: 1 }}>
                    <TextField
                      size="small"
                      label="Actual cost"
                      type="number"
                      value={actualCosts[order.id] ?? ""}
                      onChange={(e) =>
                        setActualCosts({
                          ...actualCosts,
                          [order.id]: e.target.value,
                        })
                      }
                    />
                    <Button
                      size="small"
                      disabled={detail.busy || !actualCosts[order.id]}
                      onClick={() =>
                        void detail.updateWorkCosts(order.id, {
                          actualCost: Number(actualCosts[order.id]),
                        })
                      }
                    >
                      Save cost
                    </Button>
                  </Stack>
                )}
                {data.work_logs
                  .filter((log) => log.work_order_id === order.id)
                  .map((log) => (
                    <Typography
                      key={log.id}
                      variant="body2"
                      color="text.secondary"
                    >
                      {log.note}
                      {log.minutes ? ` (${log.minutes} min)` : ""}
                    </Typography>
                  ))}
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  <TextField
                    size="small"
                    label="Add work note"
                    value={logNotes[order.id] ?? ""}
                    onChange={(e) =>
                      setLogNotes({ ...logNotes, [order.id]: e.target.value })
                    }
                    sx={{ flexGrow: 1 }}
                  />
                  <TextField
                    size="small"
                    label="Minutes"
                    type="number"
                    value={logMinutes[order.id] ?? ""}
                    onChange={(e) =>
                      setLogMinutes({
                        ...logMinutes,
                        [order.id]: e.target.value,
                      })
                    }
                    sx={{ width: 100 }}
                  />
                  <Button
                    size="small"
                    disabled={detail.busy || !logNotes[order.id]?.trim()}
                    onClick={() =>
                      void detail
                        .addWorkLog(
                          order.id,
                          logNotes[order.id],
                          logMinutes[order.id]
                            ? Number(logMinutes[order.id])
                            : undefined,
                        )
                        .then((ok) => {
                          if (ok) {
                            setLogNotes({ ...logNotes, [order.id]: "" });
                            setLogMinutes({ ...logMinutes, [order.id]: "" });
                          }
                        })
                    }
                  >
                    Log
                  </Button>
                </Stack>
              </Box>
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
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
              />
              {canManage && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={internal}
                      onChange={(_, checked) => setInternal(checked)}
                    />
                  }
                  label="Internal note (not visible to the resident)"
                />
              )}
              <Button
                variant="outlined"
                disabled={detail.busy || !commentBody.trim()}
                onClick={() =>
                  void detail.comment(commentBody, internal).then((ok) => {
                    if (ok) setCommentBody("");
                  })
                }
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
