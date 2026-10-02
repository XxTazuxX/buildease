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
import { useZodForm } from "@/shared/forms/useZodForm";
import {
  configurationFormSchema,
  levelFormSchema,
  spaceFormSchema,
  spaceStatuses,
  spaceTypes,
  type SpaceType,
} from "../model/buildings";
import { useBuildingConfiguration } from "../viewmodel/useBuildingConfiguration";

const configurationFields = {
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
} as const;

const emptyLevel = { name: "", code: "", sortOrder: "0" };
const emptySpace = {
  name: "",
  code: "",
  type: "FLAT" as SpaceType,
  levelId: "",
  parentSpaceId: "",
  rentable: true,
  area: "",
  capacity: "",
  notes: "",
};

const emptyConfiguration = {
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
  const [editingLevel, setEditingLevel] = useState<string | null>(null);
  const [editingSpace, setEditingSpace] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{
    kind: "level" | "space";
    id: string;
    name: string;
  } | null>(null);
  const configuration = useZodForm(configurationFormSchema, emptyConfiguration);
  const level = useZodForm(levelFormSchema, emptyLevel);
  const space = useZodForm(spaceFormSchema, emptySpace);
  const { reset: resetConfiguration } = configuration;

  useEffect(() => {
    if (!vm.profile.data) return;
    const p = vm.profile.data;
    resetConfiguration({
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
  }, [vm.profile.data, resetConfiguration]);

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
              <Button
                variant="outlined"
                onClick={() => {
                  level.reset(emptyLevel);
                  setEditingLevel(null);
                  setLevelOpen(true);
                }}
              >
                Add level
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  space.reset(emptySpace);
                  setEditingSpace(null);
                  setSpaceOpen(true);
                }}
              >
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
                  {owner && (
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <Button
                        size="small"
                        disabled={vm.busy}
                        aria-label={`Edit level ${item.name}`}
                        onClick={() => {
                          level.reset({
                            name: item.name,
                            code: item.code,
                            sortOrder: String(item.sort_order),
                          });
                          setEditingLevel(item.id);
                          setLevelOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        disabled={vm.busy}
                        aria-label={`Delete level ${item.name}`}
                        onClick={() =>
                          setDeleting({
                            kind: "level",
                            id: item.id,
                            name: item.name,
                          })
                        }
                      >
                        Delete
                      </Button>
                    </Stack>
                  )}
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
                  {owner && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Button
                        size="small"
                        disabled={vm.busy}
                        aria-label={`Edit space ${item.name}`}
                        onClick={() => {
                          space.reset({
                            name: item.name,
                            code: item.code,
                            type: item.type,
                            levelId: item.level_id ?? "",
                            parentSpaceId: item.parent_space_id ?? "",
                            rentable: item.rentable,
                            area: item.area == null ? "" : String(item.area),
                            capacity:
                              item.capacity == null
                                ? ""
                                : String(item.capacity),
                            notes: item.notes ?? "",
                          });
                          setEditingSpace(item.id);
                          setSpaceOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      {item.status !== "OCCUPIED" && (
                        <Button
                          size="small"
                          color="error"
                          disabled={vm.busy}
                          aria-label={`Delete space ${item.name}`}
                          onClick={() =>
                            setDeleting({
                              kind: "space",
                              id: item.id,
                              name: item.name,
                            })
                          }
                        >
                          Delete
                        </Button>
                      )}
                    </Stack>
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
            {(
              Object.entries(configurationFields) as [
                keyof typeof configurationFields,
                string,
              ][]
            ).map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                {...configuration.field(key)}
              />
            ))}
            <Divider />
            <Typography variant="overline" color="text.secondary">
              Late fees
            </Typography>
            <TextField
              label="Late fee amount (blank disables late fees)"
              type="number"
              {...configuration.field("lateFeeAmount")}
            />
            <TextField
              label="Grace period before a late fee applies (days)"
              type="number"
              {...configuration.field("lateFeeGraceDays")}
            />
            <Button
              variant="contained"
              disabled={vm.busy}
              onClick={configuration.submit(async (values) => {
                const ok = await vm.configure(values);
                if (ok) setConfigurationOpen(false);
              })}
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
        <DialogTitle>
          {editingLevel ? "Edit level or zone" : "Add level or zone"}
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Level name" {...level.field("name")} />
            <TextField label="Level code" {...level.field("code")} />
            <TextField
              type="number"
              label="Display order"
              {...level.field("sortOrder")}
            />
            <Button
              variant="contained"
              disabled={vm.busy}
              onClick={level.submit(async (values) => {
                const ok = await (editingLevel
                  ? vm.updateLevel(editingLevel, values)
                  : vm.createLevel(values));
                if (ok) {
                  setLevelOpen(false);
                  level.reset(emptyLevel);
                }
              })}
            >
              {editingLevel ? "Save level" : "Add level"}
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
        <DialogTitle>
          {editingSpace
            ? "Edit flat, room, or space"
            : "Add flat, room, or space"}
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Space name" {...space.field("name")} />
            <TextField label="Space code" {...space.field("code")} />
            <TextField select label="Space type" {...space.field("type")}>
              {spaceTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Level or zone" {...space.field("levelId")}>
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
              {...space.field("parentSpaceId")}
            >
              <MenuItem value="">No parent</MenuItem>
              {vm.spaces.data
                ?.filter((item) => item.id !== editingSpace)
                .map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
            </TextField>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ alignItems: { sm: "flex-start" } }}
            >
              <TextField
                fullWidth
                type="number"
                label="Area (m²)"
                {...space.field("area")}
              />
              <TextField
                fullWidth
                type="number"
                label="Capacity"
                {...space.field("capacity")}
              />
            </Stack>
            <TextField
              multiline
              minRows={2}
              label="Notes"
              {...space.field("notes")}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={space.values.rentable}
                  onChange={(_, checked) => space.setValue("rentable", checked)}
                />
              }
              label="Rentable space"
            />
            <Button
              variant="contained"
              disabled={vm.busy}
              onClick={space.submit(async (values) => {
                const ok = await (editingSpace
                  ? vm.updateSpace(editingSpace, values)
                  : vm.createSpace(values));
                if (ok) setSpaceOpen(false);
              })}
            >
              {editingSpace ? "Save space" : "Add space"}
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>

      {deleting && (
        <AdaptiveDialog
          open
          onClose={() => setDeleting(null)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Delete {deleting.kind}</DialogTitle>
          <Divider />
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {vm.error && <Alert severity="error">{vm.error}</Alert>}
              <Typography>
                Permanently delete &ldquo;{deleting.name}&rdquo;? This cannot be
                undone.{" "}
                {deleting.kind === "level"
                  ? "A level that still has spaces can't be deleted."
                  : "A space that has leases, residents, listings, requests or assets can't be deleted; mark it Inactive instead."}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ justifyContent: "flex-end" }}
              >
                <Button onClick={() => setDeleting(null)}>Cancel</Button>
                <Button
                  color="error"
                  variant="contained"
                  disabled={vm.busy}
                  onClick={async () => {
                    const ok = await (deleting.kind === "level"
                      ? vm.deleteLevel(deleting.id)
                      : vm.deleteSpace(deleting.id));
                    if (ok) setDeleting(null);
                  }}
                >
                  Delete {deleting.kind}
                </Button>
              </Stack>
            </Stack>
          </DialogContent>
        </AdaptiveDialog>
      )}
    </Paper>
  );
}
