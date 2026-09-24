import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MenuItem, TextField } from "@mui/material";
import { PageHeader } from "@/shared/components/Surface";
import { adminApi } from "@/modules/admin/model/admin";
import { MyUnitPanel } from "./MyUnitPanel";
import { MyLeasePanel } from "./MyLeasePanel";
import { MyMaintenancePanel } from "./MyMaintenancePanel";

export function TenantPortalPage({ org }: { org: string }) {
  const buildings = useQuery({
    queryKey: [org, "buildings"],
    queryFn: () => adminApi.buildings(org, 0),
    enabled: !!org,
  });
  const [selected, setSelected] = useState("");
  const building = buildings.data?.some((b) => b.id === selected)
    ? selected
    : (buildings.data?.[0]?.id ?? "");
  return (
    <>
      <PageHeader
        eyebrow="My home"
        title="Your lease, unit, and requests"
        description="Everything about your place, in one spot."
      />
      {buildings.data && buildings.data.length > 1 && (
        <TextField
          select
          size="small"
          label="Building"
          value={building}
          onChange={(e) => setSelected(e.target.value)}
          sx={{ mb: 3, width: { xs: "100%", sm: 280 } }}
        >
          {buildings.data.map((b) => (
            <MenuItem key={b.id} value={b.id}>
              {b.name}
            </MenuItem>
          ))}
        </TextField>
      )}
      {building && (
        <>
          <MyUnitPanel org={org} building={building} />
          <MyLeasePanel org={org} building={building} />
          <MyMaintenancePanel org={org} building={building} />
        </>
      )}
    </>
  );
}
