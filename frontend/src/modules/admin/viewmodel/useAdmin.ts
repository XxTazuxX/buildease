import { useAuth } from "@/modules/auth/viewmodel/AuthProvider";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminApi,
  type Role,
  type Organization,
  type Account,
  type EmailTemplateKey,
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
export function usePlatform(
  kind: "organizations" | "accounts",
  page: number,
  enabled = true,
) {
  return useQuery<Organization[] | Account[]>({
    queryKey: ["platform", kind, page],
    queryFn: () =>
      kind === "organizations"
        ? adminApi.organizations(page)
        : adminApi.accounts(page),
    enabled,
  });
}
export function useOrgAccess(org: string) {
  return useQuery({
    queryKey: [org, "access"],
    queryFn: () => adminApi.access(org),
    enabled: !!org,
  });
}
export function useWorkspaceContext(org: string) {
  const access = useOrgAccess(org);
  const buildings = useQuery({
    queryKey: [org, "buildings"],
    queryFn: () => adminApi.buildings(org, 0),
    enabled: !!org,
  });
  return { access, buildings };
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
export function useMailSettings() {
  const query = useQuery({
    queryKey: ["platform", "mail-settings"],
    queryFn: () => adminApi.mailSettings(),
  });
  const action = useAction();
  const update = (body: {
    host: string;
    port: number;
    username: string;
    password: string;
    from: string;
    starttls: boolean;
  }) => action.run(() => adminApi.updateMailSettings(body));
  const sendTest = (recipient: string) =>
    action.run(() => adminApi.testMail(recipient));
  return { query, action, update, sendTest };
}
export function useEmailTemplates() {
  const query = useQuery({
    queryKey: ["platform", "email-templates"],
    queryFn: () => adminApi.emailTemplates(),
  });
  const action = useAction();
  const update = (key: EmailTemplateKey, subject: string, body: string) =>
    action.run(() => adminApi.updateEmailTemplate(key, subject, body));
  return { query, action, update };
}
export function usePlatformAudit(
  page: number,
  organizationId?: string,
  actorId?: string,
) {
  return useQuery({
    queryKey: ["platform", "audit", page, organizationId, actorId],
    queryFn: () => adminApi.platformAudit(page, organizationId, actorId),
  });
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
    impersonate: async (id: string) => {
      const tokens = await adminApi.impersonate(id);
      await auth.startImpersonation(tokens);
    },
  };
}
