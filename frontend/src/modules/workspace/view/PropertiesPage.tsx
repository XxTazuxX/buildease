import { useState } from "react";
import {
  Box,
  Button,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Typography,
} from "@mui/material";
import { BuildingConfigurationPanel } from "@/modules/buildings";
import { ProspectsPanel } from "@/modules/crm";
import { ListingsPanel } from "@/modules/marketing";
import { useAdminCommands } from "@/modules/admin/viewmodel/useAdmin";
import { FieldsForm } from "@/shared/components/FieldsForm";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { PageHeader } from "@/shared/components/Surface";

export function PropertiesPage({
  org,
  building,
  owner,
  canManage = owner,
}: {
  org: string;
  building: string;
  owner: boolean;
  /** Owners and this building's property managers (backend `building:manage`). */
  canManage?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const commands = useAdminCommands();
  return (
    <>
      <PageHeader
        eyebrow="Properties"
        title="Buildings and spaces"
        description="Configure property details, levels, rentable units, and operating status."
        action={
          owner ? (
            <Button variant="contained" onClick={() => setOpen(true)}>
              Add building
            </Button>
          ) : undefined
        }
      />
      {building ? (
        <>
          <BuildingConfigurationPanel
            org={org}
            building={building}
            owner={canManage}
          />
          {canManage && <ListingsPanel org={org} building={building} />}
          {canManage && <ProspectsPanel org={org} building={building} />}
        </>
      ) : (
        <Paper sx={{ p: 5, textAlign: "center" }}>
          <Typography variant="h5">No buildings available</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {owner
              ? "Add the first building to begin configuring the workspace."
              : "Ask an organization owner to assign you to a building."}
          </Typography>
        </Paper>
      )}
      <AdaptiveDialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add building</DialogTitle>
        <Divider />
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <FieldsForm
              fields={[
                { name: "name", label: "Building name", max: 120 },
                {
                  name: "code",
                  label: "Building code",
                  max: 40,
                  pattern: /^[A-Za-z0-9_-]{1,40}$/,
                  patternMessage:
                    "Use letters, digits, hyphens or underscores only",
                },
              ]}
              onSubmit={async (values) => {
                await commands.createBuilding(org, values);
                setOpen(false);
              }}
              label="Add building"
            />
          </Box>
        </DialogContent>
      </AdaptiveDialog>
    </>
  );
}
