import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import {
  useMaintenance,
  useRequestDetail,
} from "@/modules/maintenance/viewmodel/useMaintenance";
import { ReportIssueDialog } from "@/modules/maintenance/view/ReportIssueDialog";
import { useOccupancy } from "@/modules/occupancy/viewmodel/useOccupancy";

export function MyMaintenancePanel({
  org,
  building,
}: {
  org: string;
  building: string;
}) {
  const vm = useMaintenance(org, building);
  const occupancy = useOccupancy(org, building);
  const mySpaceId = occupancy.residents.data?.[0]?.space_id ?? undefined;
  const mySpace = vm.spaces.data?.filter((s) => s.id === mySpaceId);
  const [createOpen, setCreateOpen] = useState(false);
  const [openRequest, setOpenRequest] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const detail = useRequestDetail(org, building, openRequest ?? "");
  const error = vm.error || vm.requests.error?.message;
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
            My maintenance
          </Typography>
          <Typography variant="h5">Requests</Typography>
          <Typography color="text.secondary">
            Report an issue and track its progress.
          </Typography>
        </Box>
        <Button
          variant="contained"
          disabled={!mySpaceId}
          onClick={() => setCreateOpen(true)}
        >
          Report issue
        </Button>
      </Stack>
      {!mySpaceId && (
        <Alert severity="info" sx={{ mt: 2 }}>
          You don&apos;t have an active unit assignment, so you can&apos;t
          submit a request yet.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      {!vm.requests.isLoading && vm.requests.data?.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          You haven&apos;t reported any issues yet.
        </Alert>
      )}
      <Stack spacing={1.25} sx={{ mt: 2 }}>
        {vm.requests.data?.map((item) => {
          const priority = item.priority ?? item.suggested_priority;
          return (
            <Paper variant="outlined" key={item.id} sx={{ p: 2 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{ gap: 1.5, alignItems: { sm: "center" } }}
              >
                <Box
                  sx={{ flexGrow: 1, minWidth: 0, cursor: "pointer" }}
                  onClick={() => setOpenRequest(item.id)}
                >
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
                  </Stack>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    Opened {new Date(item.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
                {item.status === "RESOLVED" && (
                  <Stack direction="row" spacing={1}>
                    <Button
                      disabled={vm.busy}
                      onClick={() => void vm.close(item.id, true)}
                    >
                      Confirm resolved
                    </Button>
                    <Button
                      disabled={vm.busy}
                      color="inherit"
                      onClick={() => void vm.close(item.id, false)}
                    >
                      Needs more work
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Paper>
          );
        })}
      </Stack>
      <ReportIssueDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        vm={vm}
        spaceOptions={mySpace}
      />
      <AdaptiveDialog
        open={!!openRequest}
        onClose={() => {
          setOpenRequest(null);
          setCommentText("");
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Request details</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {detail.query.data?.comments.length === 0 && (
              <Typography color="text.secondary">No comments yet.</Typography>
            )}
            {detail.query.data?.comments.map((c) => (
              <Paper key={c.id} variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="body2">{c.body}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(c.created_at).toLocaleString()}
                </Typography>
              </Paper>
            ))}
            <TextField
              label="Add a comment"
              multiline
              minRows={2}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <Button
              variant="contained"
              disabled={!commentText.trim()}
              onClick={() =>
                void detail.comment(commentText).then(() => setCommentText(""))
              }
            >
              Post comment
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>
    </Paper>
  );
}
