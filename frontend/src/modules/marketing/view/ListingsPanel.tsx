import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormHelperText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { StatusChip } from "@/shared/components/Surface";
import { useZodForm } from "@/shared/forms/useZodForm";
import {
  listingChannels,
  listingFormSchema,
  type ListingChannel,
} from "../model/listings";
import {
  useListingDetail,
  useListingSpaces,
  useListings,
} from "../viewmodel/useListings";
import { reportError } from "@/shared/feedback/reportError";
import { ListSkeleton } from "@/shared/components/Skeletons";
import { DetailSkeleton } from "@/shared/components/Skeletons";

const emptyListing = {
  spaceId: "",
  headline: "",
  description: "",
  rentAmount: "",
};

export function ListingsPanel({
  org,
  building,
}: {
  org: string;
  building: string;
}) {
  const vm = useListings(org, building);
  const spaces = useListingSpaces(org, building);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{
    id: string;
    headline: string;
  } | null>(null);
  const [loadError, setLoadError] = useState("");
  const form = useZodForm(listingFormSchema, emptyListing);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [channels, setChannels] = useState<ListingChannel[]>([]);
  const [channelsTried, setChannelsTried] = useState(false);
  const error = vm.error || loadError || vm.list.error?.message;

  const startEdit = async (id: string) => {
    setLoadError("");
    try {
      const detail = await vm.loadDetail(id);
      form.reset({
        spaceId: detail.space_id,
        headline: detail.headline,
        description: detail.description,
        rentAmount: String(detail.rent_amount),
      });
      setEditing(id);
      setCreateOpen(true);
    } catch (cause) {
      setLoadError(reportError(cause, "Could not load listing"));
    }
  };

  const spaceName = (id: string) =>
    spaces.data?.find((item) => item.id === id)?.name ?? "Space";

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
            Marketing
          </Typography>
          <Typography variant="h5">Vacancy listings</Typography>
          <Typography color="text.secondary">
            Advertise vacant spaces and syndicate them to listing partners.
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => {
            form.reset(emptyListing);
            setEditing(null);
            setLoadError("");
            setCreateOpen(true);
          }}
        >
          New listing
        </Button>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      <Stack spacing={1} sx={{ mt: 2 }}>
        {vm.list.isLoading && <ListSkeleton label="Loading listings" />}
        {vm.list.data?.map((item) => (
          <Paper variant="outlined" key={item.id} sx={{ p: 1.75 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{ gap: 1, alignItems: { sm: "center" } }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 750 }}>
                  {item.headline}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {spaceName(item.space_id)} · {item.rent_amount}{" "}
                  {item.currency}/month
                </Typography>
              </Box>
              <StatusChip
                active={item.status === "PUBLISHED"}
                label={item.status}
              />
              <Button onClick={() => setViewing(item.id)}>View</Button>
              {item.status !== "PUBLISHED" && (
                <Button
                  onClick={() => {
                    setChannels([]);
                    setChannelsTried(false);
                    setPublishing(item.id);
                  }}
                >
                  Publish
                </Button>
              )}
              {item.status !== "PUBLISHED" && (
                <>
                  <Button
                    disabled={vm.busy}
                    onClick={() => void startEdit(item.id)}
                  >
                    Edit
                  </Button>
                  <Button
                    color="error"
                    disabled={vm.busy}
                    onClick={() =>
                      setDeleting({ id: item.id, headline: item.headline })
                    }
                  >
                    Delete
                  </Button>
                </>
              )}
              {item.status === "PUBLISHED" && (
                <Button
                  color="warning"
                  disabled={vm.busy}
                  onClick={() => void vm.unpublish(item.id)}
                >
                  Unpublish
                </Button>
              )}
            </Stack>
          </Paper>
        ))}
        {vm.list.data?.length === 0 && (
          <Typography color="text.secondary">No listings yet.</Typography>
        )}
      </Stack>

      <AdaptiveDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{editing ? "Edit listing" : "New listing"}</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Space"
              disabled={!!editing}
              {...form.field("spaceId")}
            >
              {spaces.data
                ?.filter(
                  (item) =>
                    !!editing ||
                    (item.rentable &&
                      ["VACANT", "RESERVED"].includes(item.status)),
                )
                .map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name} · {item.code}
                  </MenuItem>
                ))}
            </TextField>
            <TextField label="Headline" {...form.field("headline")} />
            <TextField
              label="Description"
              multiline
              minRows={3}
              {...form.field("description")}
            />
            <TextField
              label="Monthly rent"
              type="number"
              {...form.field("rentAmount")}
            />
            <Button
              variant="contained"
              disabled={vm.busy}
              onClick={form.submit(async (values) => {
                const ok = await (editing
                  ? vm.update(editing, values)
                  : vm.create(values));
                if (ok) setCreateOpen(false);
              })}
            >
              {editing ? "Save changes" : "Create listing"}
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>

      {deleting && (
        <ConfirmDialog
          title="Delete listing"
          confirmLabel="Delete listing"
          busy={vm.busy}
          error={vm.error}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            if (await vm.remove(deleting.id)) setDeleting(null);
          }}
        >
          Permanently delete &ldquo;{deleting.headline}&rdquo; and its
          publishing history? This cannot be undone.
        </ConfirmDialog>
      )}

      {publishing && (
        <AdaptiveDialog
          open
          onClose={() => setPublishing(null)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Publish listing</DialogTitle>
          <Divider />
          <DialogContent>
            <Stack spacing={1} sx={{ pt: 1 }}>
              {listingChannels.map((channel) => (
                <FormControlLabel
                  key={channel}
                  label={channel.replaceAll("_", " ")}
                  control={
                    <Checkbox
                      checked={channels.includes(channel)}
                      onChange={(_, checked) =>
                        setChannels(
                          checked
                            ? [...channels, channel]
                            : channels.filter((value) => value !== channel),
                        )
                      }
                    />
                  }
                />
              ))}
              {channelsTried && channels.length === 0 && (
                <FormHelperText error>
                  Select at least one channel
                </FormHelperText>
              )}
              <Button
                variant="contained"
                disabled={vm.busy}
                onClick={() => {
                  setChannelsTried(true);
                  if (channels.length === 0) return;
                  void vm
                    .publish(publishing, channels)
                    .then((ok) => ok && setPublishing(null));
                }}
              >
                Publish
              </Button>
            </Stack>
          </DialogContent>
        </AdaptiveDialog>
      )}

      {viewing && (
        <ListingDetailDialog
          org={org}
          building={building}
          listing={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </Paper>
  );
}

function ListingDetailDialog({
  org,
  building,
  listing,
  onClose,
}: {
  org: string;
  building: string;
  listing: string;
  onClose: () => void;
}) {
  const detail = useListingDetail(org, building, listing);
  return (
    <AdaptiveDialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{detail.data?.headline ?? "Listing detail"}</DialogTitle>
      <DialogContent>
        {detail.isLoading && <DetailSkeleton label="Loading details" />}
        {detail.data && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              {detail.data.description}
            </Typography>
            <Divider />
            <Typography variant="overline" color="text.secondary">
              Syndication
            </Typography>
            {detail.data.syndications.length === 0 && (
              <Typography color="text.secondary">Not published yet.</Typography>
            )}
            {detail.data.syndications.map((row) => (
              <Typography key={row.channel} variant="body2">
                {row.channel.replaceAll("_", " ")} · {row.status}
                {row.external_id ? ` (${row.external_id})` : ""}
              </Typography>
            ))}
          </Stack>
        )}
      </DialogContent>
    </AdaptiveDialog>
  );
}
