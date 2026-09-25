import { useEffect, useState } from "react";
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
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import {
  spaceStatuses,
  spaceTypes,
  type BuildingConfiguration,
  type SpaceType,
} from "../model/buildings";
import { useBuildingConfiguration } from "../viewmodel/useBuildingConfiguration";

type ConfigurationForm = Omit<
  BuildingConfiguration,
  "lateFeeAmount" | "lateFeeGraceDays"
> & {
  lateFeeAmount: string;
  lateFeeGraceDays: string;
};

const emptyConfiguration: ConfigurationForm = {
  name: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "",
  timezone: "UTC",
  currency: "USD",
  emergencyContact: "",
  lateFeeAmount: "",
  lateFeeGraceDays: "5",
};

export function BuildingConfigurationPanel({
  org,
  building,
  owner,
}: {
  org: string;
  building: string;
  owner: boolean;
}) {
  const vm = useBuildingConfiguration(org, building);
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [spaceOpen, setSpaceOpen] = useState(false);
  const [configuration, setConfiguration] =
    useState<ConfigurationForm>(emptyConfiguration);
  const [level, setLevel] = useState({ name: "", code: "", sortOrder: 0 });
  const [space, setSpace] = useState({
    name: "",
    code: "",
    type: "FLAT" as SpaceType,
    levelId: "",
    parentSpaceId: "",
    rentable: true,
    area: "",
    capacity: "",
    notes: "",
  });

  useEffect(() => {
    if (!vm.profile.data) return;
    const p = vm.profile.data;
    setConfiguration({
      name: p.name,
      addressLine1: p.address_line1 ?? "",
      addressLine2: p.address_line2 ?? "",
      city: p.city ?? "",
      region: p.region ?? "",
      postalCode: p.postal_code ?? "",
      countryCode: p.country_code ?? "",
      timezone: p.timezone,
      currency: p.currency,
      emergencyContact: p.emergency_contact ?? "",
      lateFeeAmount: p.late_fee_amount ?? "",
      lateFeeGraceDays: String(p.late_fee_grace_days),
    });
  }, [vm.profile.data]);

  const errors =
    vm.error ||
    vm.profile.error?.message ||
    vm.levels.error?.message ||
    vm.spaces.error?.message;
  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 3 }}>
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{
            gap: 1.5,
            justifyContent: "space-between",
            alignItems: { sm: "center" },
          }}
        >
          <Box>
            <Typography variant="h5">Building configuration</Typography>
            <Typography color="text.secondary">
              {vm.profile.data
                ? [vm.profile.data.address_line1, vm.profile.data.city]
                    .filter(Boolean)
                    .join(", ") ||
                  "Add the property address and operating details."
                : "Loading building details…"}
            </Typography>
          </Box>
          {owner && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="outlined"
                onClick={() => setConfigurationOpen(true)}
              >
                Building settings
              </Button>
              <Button variant="outlined" onClick={() => setLevelOpen(true)}>
                Add level
              </Button>
              <Button variant="contained" onClick={() => setSpaceOpen(true)}>
                Add space
              </Button>
            </Stack>
          )}
        </Stack>
        {errors && <Alert severity="error">{errors}</Alert>}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "280px 1fr" },
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="overline" color="text.secondary">
              Levels and zones
            </Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {vm.levels.data?.map((item) => (
                <Paper variant="outlined" key={item.id} sx={{ p: 1.5 }}>
                  <Typography sx={{ fontWeight: 750 }}>{item.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.code} · Order {item.sort_order}
                  </Typography>
                </Paper>
              ))}
              {!vm.levels.isLoading && vm.levels.data?.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No levels configured. Spaces may still belong directly to the
                  building.
                </Typography>
              )}
            </Stack>
          </Box>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Spaces
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                },
                gap: 1,
                mt: 1,
              }}
            >
              {vm.spaces.data?.map((item) => (
                <Paper
                  variant="outlined"
                  key={item.id}
                  sx={{ p: 1.75, minWidth: 0 }}
                >
                  <Stack
                    direction="row"
                    sx={{ justifyContent: "space-between", gap: 1 }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 750 }} noWrap>
                        {item.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.code} · {item.type.replaceAll("_", " ")}
                      </Typography>
                    </Box>
                    <Chip
                      label={item.status}
                      size="small"
                      color={item.status === "VACANT" ? "success" : "default"}
                    />
                  </Stack>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    {item.area ? `${item.area} m²` : "Area not set"}
                    {item.capacity ? ` · Capacity ${item.capacity}` : ""}
                  </Typography>
                  {owner && item.status !== "OCCUPIED" && (
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label={`Status for ${item.name}`}
                      value={item.status}
                      onChange={(event) =>
                        void vm.setStatus(
                          item.id,
                          event.target.value as (typeof spaceStatuses)[number],
                        )
                      }
                      sx={{ mt: 1.5 }}
                    >
                      {spaceStatuses.map((status) => (
                        <MenuItem key={status} value={status}>
                          {status}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                </Paper>
              ))}
            </Box>
          </Box>
        </Box>
      </Stack>

      <AdaptiveDialog
        open={configurationOpen}
        onClose={() => setConfigurationOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Building settings</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {Object.entries({
              name: "Building name",
              addressLine1: "Address line 1",
              addressLine2: "Address line 2",
              city: "City",
              region: "Region",
              postalCode: "Postal code",
              countryCode: "Country code",
              timezone: "Timezone",
              currency: "Currency",
              emergencyContact: "Emergency contact",
            }).map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                value={configuration[key as keyof ConfigurationForm]}
                onChange={(event) =>
                  setConfiguration((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            ))}
            <Divider />
            <Typography variant="overline" color="text.secondary">
              Late fees
            </Typography>
            <TextField
              label="Late fee amount (blank disables late fees)"
              type="number"
              value={configuration.lateFeeAmount}
              onChange={(e) =>
                setConfiguration({
                  ...configuration,
                  lateFeeAmount: e.target.value,
                })
              }
            />
            <TextField
              label="Grace period before a late fee applies (days)"
              type="number"
              value={configuration.lateFeeGraceDays}
              onChange={(e) =>
                setConfiguration({
                  ...configuration,
                  lateFeeGraceDays: e.target.value,
                })
              }
            />
            <Button
              variant="contained"
              disabled={vm.busy}
              onClick={() =>
                void vm
                  .configure({
                    ...configuration,
                    lateFeeAmount:
                      configuration.lateFeeAmount === ""
                        ? null
                        : Number(configuration.lateFeeAmount),
                    lateFeeGraceDays: Number(
                      configuration.lateFeeGraceDays || 0,
                    ),
                  })
                  .then((ok) => {
                    if (ok) setConfigurationOpen(false);
                  })
              }
            >
              Save building settings
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>

      <AdaptiveDialog
        open={levelOpen}
        onClose={() => setLevelOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Add level or zone</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Level name"
              value={level.name}
              onChange={(e) => setLevel({ ...level, name: e.target.value })}
            />
            <TextField
              label="Level code"
              value={level.code}
              onChange={(e) => setLevel({ ...level, code: e.target.value })}
            />
            <TextField
              type="number"
              label="Display order"
              value={level.sortOrder}
              onChange={(e) =>
                setLevel({ ...level, sortOrder: Number(e.target.value) })
              }
            />
            <Button
              variant="contained"
              disabled={vm.busy || !level.name || !level.code}
              onClick={() =>
                void vm.createLevel(level).then((ok) => {
                  if (ok) {
                    setLevelOpen(false);
                    setLevel({ name: "", code: "", sortOrder: 0 });
                  }
                })
              }
            >
              Add level
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>

      <AdaptiveDialog
        open={spaceOpen}
        onClose={() => setSpaceOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add flat, room, or space</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Space name"
              value={space.name}
              onChange={(e) => setSpace({ ...space, name: e.target.value })}
            />
            <TextField
              label="Space code"
              value={space.code}
              onChange={(e) => setSpace({ ...space, code: e.target.value })}
            />
            <TextField
              select
              label="Space type"
              value={space.type}
              onChange={(e) =>
                setSpace({ ...space, type: e.target.value as SpaceType })
              }
            >
              {spaceTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Level or zone"
              value={space.levelId}
              onChange={(e) => setSpace({ ...space, levelId: e.target.value })}
            >
              <MenuItem value="">Directly in building</MenuItem>
              {vm.levels.data?.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Parent space"
              value={space.parentSpaceId}
              onChange={(e) =>
                setSpace({ ...space, parentSpaceId: e.target.value })
              }
            >
              <MenuItem value="">No parent</MenuItem>
              {vm.spaces.data?.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth
                type="number"
                label="Area (m²)"
                value={space.area}
                onChange={(e) => setSpace({ ...space, area: e.target.value })}
              />
              <TextField
                fullWidth
                type="number"
                label="Capacity"
                value={space.capacity}
                onChange={(e) =>
                  setSpace({ ...space, capacity: e.target.value })
                }
              />
            </Stack>
            <TextField
              multiline
              minRows={2}
              label="Notes"
              value={space.notes}
              onChange={(e) => setSpace({ ...space, notes: e.target.value })}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={space.rentable}
                  onChange={(_, checked) =>
                    setSpace({ ...space, rentable: checked })
                  }
                />
              }
              label="Rentable space"
            />
            <Button
              variant="contained"
              disabled={vm.busy || !space.name || !space.code}
              onClick={() =>
                void vm
                  .createSpace({
                    ...space,
                    levelId: space.levelId || null,
                    parentSpaceId: space.parentSpaceId || null,
                    area: space.area ? Number(space.area) : null,
                    capacity: space.capacity ? Number(space.capacity) : null,
                  })
                  .then((ok) => {
                    if (ok) setSpaceOpen(false);
                  })
              }
            >
              Add space
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>
    </Paper>
  );
}
