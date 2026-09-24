import { useAuth } from "@/modules/auth/viewmodel/AuthProvider";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminApi,
  type Role,
  type Organization,
  type Account,
} from "../model/admin";
export function useAction() {
  const cache = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await cache.invalidateQueries();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, error, busy };
}
export function usePlatform(kind: "organizations" | "accounts", page: number) {
  return useQuery<Organization[] | Account[]>({
    queryKey: ["platform", kind, page],
    queryFn: () =>
      kind === "organizations"
        ? adminApi.organizations(page)
        : adminApi.accounts(page),
  });
}
export function useOrgAccess(org: string) {
  return useQuery({
    queryKey: [org, "access"],
    queryFn: () => adminApi.access(org),
    enabled: !!org,
  });
}
export function useWorkspace(org: string, building: string, page: number) {
  const access = useQuery({
    queryKey: [org, "access"],
    queryFn: () => adminApi.access(org),
  });
  const buildings = useQuery({
    queryKey: [org, "buildings"],
    queryFn: () => adminApi.buildings(org, 0),
  });
  const canManage =
    access.data?.owner ||
    access.data?.roles.some(
      (r) => r.building_id === building && r.role === "PROPERTY_MANAGER",
    );
  const canManageFinance =
    access.data?.owner ||
    access.data?.roles.some(
      (r) =>
        r.building_id === building &&
        (r.role === "PROPERTY_MANAGER" || r.role === "ACCOUNTANT"),
    );
  const members = useQuery({
    queryKey: [org, "members", building, page],
    queryFn: () => adminApi.members(org, building, page),
    enabled: !!canManage,
  });
  return { access, buildings, members, canManage, canManageFinance };
}
export function useRoleEditor(org: string, building: string, user: string) {
  const query = useQuery({
    queryKey: [org, "roles", building, user],
    queryFn: () => adminApi.getRoles(org, building, user),
  });
  const action = useAction();
  const save = (roles: Role[]) =>
    action.run(() => adminApi.setRoles(org, building, user, roles));
  return { query, action, save };
}
export function useAdminCommands() {
  const auth = useAuth();
  const cache = useQueryClient();
  return {
    createOrg: async (body: unknown) => {
      await adminApi.createOrg(body);
      await auth.reload();
      await cache.invalidateQueries();
    },
    createAccount: async (body: unknown) => {
      await adminApi.createAccount(body);
      await cache.invalidateQueries();
    },
    reset: adminApi.reset,
    organizationStatus: adminApi.organizationStatus,
    accountStatus: adminApi.accountStatus,
    createBuilding: async (org: string, body: unknown) => {
      await adminApi.createBuilding(org, body);
      await cache.invalidateQueries();
    },
    invite: async (org: string, body: unknown) => {
      await adminApi.invite(org, body);
      await cache.invalidateQueries();
    },
    membership: adminApi.membership,
    updateMember: adminApi.updateMember,
    accept: adminApi.accept,
  };
}
