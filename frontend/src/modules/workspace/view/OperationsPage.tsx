import { Alert, Paper, Tab, Tabs } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import { LeasesPanel } from "@/modules/leases";
import { MaintenancePanel } from "@/modules/maintenance";
import { PageHeader } from "@/shared/components/Surface";

export function OperationsPage({
  org,
  building,
  canManage,
  canFinance,
  canMaintenance,
}: {
  org: string;
  building: string;
  canManage: boolean;
  canFinance: boolean;
  canMaintenance: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab =
    requested === "maintenance" && canMaintenance
      ? "maintenance"
      : canFinance
        ? "finance"
        : "maintenance";
  const select = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", value);
    setParams(next, { replace: true });
  };
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Finance and maintenance"
        description="Manage leases, rent, payments, and repair work for the selected building."
      />
      {!building ? (
        <Alert severity="info">
          Select or create a building to open operations.
        </Alert>
      ) : !canFinance && !canMaintenance ? (
        <Alert severity="warning">
          You do not have finance or maintenance access for this building.
        </Alert>
      ) : (
        <>
          <Paper sx={{ px: 1.5, mb: 2 }}>
            <Tabs value={tab} onChange={(_, value) => select(value)}>
              {canFinance && <Tab value="finance" label="Finance" />}
              {canMaintenance && (
                <Tab value="maintenance" label="Maintenance" />
              )}
            </Tabs>
          </Paper>
          {tab === "finance" && canFinance && (
            <LeasesPanel
              org={org}
              building={building}
              canManage={canManage}
              canManageFinance={canFinance}
            />
          )}
          {tab === "maintenance" && canMaintenance && (
            <MaintenancePanel
              org={org}
              building={building}
              canManage={canManage}
              canReport={canManage}
            />
          )}
        </>
      )}
    </>
  );
}
