import { Alert, Paper, Tab, Tabs } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import { AssetsPanel } from "@/modules/assets";
import { AccountingSyncPanel, ApiKeysPanel } from "@/modules/integrations";
import { InspectionsPanel } from "@/modules/inspections";
import { LeasesPanel } from "@/modules/leases";
import { MaintenancePanel } from "@/modules/maintenance";
import { ReportsPanel } from "@/modules/reporting";
import { PageHeader } from "@/shared/components/Surface";

export function OperationsPage({
  org,
  building,
  owner,
  canManage,
  canFinance,
  canMaintenance,
}: {
  org: string;
  building: string;
  owner: boolean;
  canManage: boolean;
  canFinance: boolean;
  canMaintenance: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab =
    requested === "maintenance" && canMaintenance
      ? "maintenance"
      : requested === "inspections" && canManage
        ? "inspections"
        : requested === "assets" && canManage
          ? "assets"
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
              {canManage && <Tab value="inspections" label="Inspections" />}
              {canManage && <Tab value="assets" label="Assets" />}
            </Tabs>
          </Paper>
          {tab === "finance" && canFinance && (
            <>
              <LeasesPanel
                org={org}
                building={building}
                canManage={canManage}
                canManageFinance={canFinance}
              />
              <ReportsPanel org={org} building={building} />
              {canManage && (
                <AccountingSyncPanel org={org} building={building} />
              )}
              {owner && <ApiKeysPanel org={org} />}
            </>
          )}
          {tab === "maintenance" && canMaintenance && (
            <MaintenancePanel
              org={org}
              building={building}
              canManage={canManage}
              canReport={canManage}
            />
          )}
          {tab === "inspections" && canManage && (
            <InspectionsPanel org={org} building={building} />
          )}
          {tab === "assets" && canManage && (
            <AssetsPanel org={org} building={building} />
          )}
        </>
      )}
    </>
  );
}
