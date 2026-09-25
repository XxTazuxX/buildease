import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { accountingApi, apiKeySchema, apiKeysApi } from "../model/integrations";

export function useApiKeys(org: string) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = [org, "api-keys"];
  const list = useQuery({
    queryKey: key,
    queryFn: () => apiKeysApi.list(org),
    enabled: !!org,
  });
  const create = async (name: string) => {
    setBusy(true);
    setError("");
    try {
      const parsed = apiKeySchema.parse({ name });
      const created = await apiKeysApi.create(org, parsed.name);
      await cache.invalidateQueries({ queryKey: key });
      return created;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create key");
      return null;
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      await apiKeysApi.revoke(org, id);
      await cache.invalidateQueries({ queryKey: key });
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to revoke key");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { list, busy, error, create, revoke };
}

export function useAccountingSync(org: string, building: string) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = [org, "building", building, "accounting-syncs"];
  const history = useQuery({
    queryKey: key,
    queryFn: () => accountingApi.history(org, building),
    enabled: !!building,
  });
  const sync = async () => {
    setBusy(true);
    setError("");
    try {
      await accountingApi.sync(org, building);
      await cache.invalidateQueries({ queryKey: key });
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sync failed");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { history, busy, error, sync };
}
