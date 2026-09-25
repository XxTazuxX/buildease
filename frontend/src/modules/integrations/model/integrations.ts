import { z } from "zod";
import { api } from "@/shared/api/client";

export interface ApiKeySummary {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}
export interface NewApiKey {
  id: string;
  key: string;
}

export const apiKeySchema = z.object({
  name: z.string().trim().min(1).max(120),
});
export type NewApiKeyRequest = z.infer<typeof apiKeySchema>;

export const apiKeysApi = {
  list: (org: string) => api<ApiKeySummary[]>(`/organizations/${org}/api-keys`),
  create: (org: string, name: string) =>
    api<NewApiKey>(`/organizations/${org}/api-keys`, "POST", { name }),
  revoke: (org: string, key: string) =>
    api(`/organizations/${org}/api-keys/${key}`, "DELETE"),
};

export const accountingSyncStatuses = ["SUCCEEDED", "FAILED"] as const;
export type AccountingSyncStatus = (typeof accountingSyncStatuses)[number];
export interface AccountingSync {
  id: string;
  status: AccountingSyncStatus;
  provider_reference: string | null;
  synced_by: string;
  synced_at: string;
}

const accountingBase = (org: string, building: string) =>
  `/organizations/${org}/buildings/${building}/accounting`;

export const accountingApi = {
  sync: (org: string, building: string) =>
    api<{ id: string }>(`${accountingBase(org, building)}/sync`, "POST"),
  history: (org: string, building: string) =>
    api<AccountingSync[]>(`${accountingBase(org, building)}/syncs`),
};
