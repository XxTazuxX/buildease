import { useState } from "react";
import {
  Alert,
  Box,
  Button,
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
import { StatusChip } from "@/shared/components/Surface";
import { assetCategories, type AssetCategory } from "../model/assets";
import {
  useAssetDetail,
  useAssets,
  useAssetSpaces,
} from "../viewmodel/useAssets";

const emptyAsset = {
  spaceId: "",
  name: "",
  category: "OTHER" as AssetCategory,
  manufacturer: "",
  model: "",
  serialNumber: "",
  installDate: "",
  warrantyExpiresOn: "",
  notes: "",
};

export function AssetsPanel({
  org,
  building,
}: {
  org: string;
  building: string;
}) {
  const vm = useAssets(org, building);
  const spaces = useAssetSpaces(org, building);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyAsset);
  const [viewing, setViewing] = useState<string | null>(null);
  const error = vm.error || vm.list.error?.message;

  const spaceName = (id: string | null) =>
    id
      ? (spaces.data?.find((item) => item.id === id)?.name ?? "Space")
      : "Building-wide";

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
            Asset registry
          </Typography>
          <Typography variant="h5">Equipment and assets</Typography>
          <Typography color="text.secondary">
            Track equipment, warranties, and meter readings across the building.
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => {
            setForm(emptyAsset);
            setCreateOpen(true);
          }}
        >
          Add asset
        </Button>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      <Stack spacing={1} sx={{ mt: 2 }}>
        {vm.list.data?.map((item) => (
          <Paper variant="outlined" key={item.id} sx={{ p: 1.75 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{ gap: 1.5, alignItems: { sm: "center" } }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 750 }}>{item.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.category.replaceAll("_", " ")} ·{" "}
                  {spaceName(item.space_id)}
                  {item.warranty_expires_on
                    ? ` · Warranty until ${item.warranty_expires_on}`
                    : ""}
                </Typography>
              </Box>
              <StatusChip
                active={item.status === "ACTIVE"}
                label={item.status}
              />
              <Button onClick={() => setViewing(item.id)}>View</Button>
              {item.status === "ACTIVE" ? (
                <Button
                  color="warning"
                  disabled={vm.busy}
                  onClick={() => void vm.setStatus(item.id, "RETIRED")}
                >
                  Retire
                </Button>
              ) : (
                <Button
                  disabled={vm.busy}
                  onClick={() => void vm.setStatus(item.id, "ACTIVE")}
                >
                  Reactivate
                </Button>
              )}
            </Stack>
          </Paper>
        ))}
        {vm.list.data?.length === 0 && (
          <Typography color="text.secondary">
            No assets recorded yet.
          </Typography>
        )}
      </Stack>

      <AdaptiveDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add asset</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Space (optional, blank = building-wide)"
              value={form.spaceId}
              onChange={(e) => setForm({ ...form, spaceId: e.target.value })}
            >
              <MenuItem value="">Building-wide</MenuItem>
              {spaces.data?.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name} · {item.code}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              select
              label="Category"
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value as AssetCategory })
              }
            >
              {assetCategories.map((category) => (
                <MenuItem key={category} value={category}>
                  {category.replaceAll("_", " ")}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Manufacturer (optional)"
              value={form.manufacturer}
              onChange={(e) =>
                setForm({ ...form, manufacturer: e.target.value })
              }
            />
            <TextField
              label="Model (optional)"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
            <TextField
              label="Serial number (optional)"
              value={form.serialNumber}
              onChange={(e) =>
                setForm({ ...form, serialNumber: e.target.value })
              }
            />
            <TextField
              label="Install date (optional)"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              value={form.installDate}
              onChange={(e) =>
                setForm({ ...form, installDate: e.target.value })
              }
            />
            <TextField
              label="Warranty expires on (optional)"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              value={form.warrantyExpiresOn}
              onChange={(e) =>
                setForm({ ...form, warrantyExpiresOn: e.target.value })
              }
            />
            <TextField
              label="Notes (optional)"
              multiline
              minRows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <Button
              variant="contained"
              disabled={vm.busy || !form.name.trim()}
              onClick={() =>
                void vm.create(form).then((ok) => ok && setCreateOpen(false))
              }
            >
              Add asset
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>

      {viewing && (
        <AssetDetailDialog
          org={org}
          building={building}
          asset={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </Paper>
  );
}

function AssetDetailDialog({
  org,
  building,
  asset,
  onClose,
}: {
  org: string;
  building: string;
  asset: string;
  onClose: () => void;
}) {
  const vm = useAssetDetail(org, building, asset);
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("hours");

  return (
    <AdaptiveDialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{vm.detail.data?.name ?? "Asset detail"}</DialogTitle>
      <DialogContent>
        {vm.detail.isLoading && (
          <Typography color="text.secondary">Loading…</Typography>
        )}
        {(vm.error || vm.detail.error) && (
          <Alert severity="error">{vm.error || vm.detail.error?.message}</Alert>
        )}
        {vm.detail.data && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {vm.detail.data.manufacturer ?? "Unknown manufacturer"}
              {vm.detail.data.model ? ` · ${vm.detail.data.model}` : ""}
              {vm.detail.data.serial_number
                ? ` · SN ${vm.detail.data.serial_number}`
                : ""}
            </Typography>
            {vm.detail.data.notes && (
              <Typography variant="body2">{vm.detail.data.notes}</Typography>
            )}
            <Divider />
            <Typography variant="overline" color="text.secondary">
              Meter readings
            </Typography>
            {vm.detail.data.meterReadings.length === 0 && (
              <Typography color="text.secondary">
                No readings logged yet.
              </Typography>
            )}
            {vm.detail.data.meterReadings.map((reading) => (
              <Typography key={reading.id} variant="body2">
                {reading.reading_value} {reading.unit} ·{" "}
                {new Date(reading.recorded_at).toLocaleString()}
              </Typography>
            ))}
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Value"
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <TextField
                size="small"
                label="Unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
              <Button
                disabled={vm.busy || !value}
                onClick={() =>
                  void vm
                    .recordMeterReading(Number(value), unit)
                    .then((ok) => ok && setValue(""))
                }
              >
                Log reading
              </Button>
            </Stack>
          </Stack>
        )}
      </DialogContent>
    </AdaptiveDialog>
  );
}
