import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Pager } from "@/shared/components/Pager";
import { audiences, type Audience } from "../model/announcements";
import { useAnnouncements } from "../viewmodel/useAnnouncements";

const audienceLabels: Record<Audience, string> = {
  ALL_RESIDENTS: "All residents",
  ALL_STAFF: "All staff (owner, managers, accountants, maintenance)",
};

export function AnnouncementsPanel({
  org,
  building,
}: {
  org: string;
  building: string;
}) {
  const [page, setPage] = useState(0);
  const vm = useAnnouncements(org, building, page);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("ALL_RESIDENTS");
  const error = vm.error || vm.history.error?.message;

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography variant="overline" color="primary.main">
          Announcements
        </Typography>
        <Typography variant="h5">Send a building-wide message</Typography>
        <Typography color="text.secondary">
          Delivered instantly to the recipients&apos; notification inbox.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        <Stack spacing={2} sx={{ mt: 2, maxWidth: 480 }}>
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 160 } }}
          />
          <TextField
            label="Message"
            multiline
            minRows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 4000 } }}
          />
          <TextField
            select
            label="Audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value as Audience)}
          >
            {audiences.map((value) => (
              <MenuItem key={value} value={value}>
                {audienceLabels[value]}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            disabled={vm.busy || !title.trim() || !body.trim()}
            onClick={() =>
              void vm.send({ title, body, audience }).then((ok) => {
                if (ok) {
                  setTitle("");
                  setBody("");
                }
              })
            }
          >
            Send announcement
          </Button>
        </Stack>
      </Paper>
      <Stack spacing={1}>
        {vm.history.data?.map((item) => (
          <Paper key={item.id} variant="outlined" sx={{ p: 1.75 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{ justifyContent: "space-between", gap: 1 }}
            >
              <Box>
                <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {audienceLabels[item.audience]} ·{" "}
                  {new Date(item.created_at).toLocaleString()}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {item.recipient_count} recipient
                {item.recipient_count === 1 ? "" : "s"}
              </Typography>
            </Stack>
          </Paper>
        ))}
        {vm.history.data?.length === 0 && (
          <Typography color="text.secondary">
            No announcements sent yet.
          </Typography>
        )}
      </Stack>
      <Pager
        page={page}
        count={vm.history.data?.length ?? 0}
        onChange={setPage}
      />
    </Stack>
  );
}
