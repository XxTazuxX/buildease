import { api } from "@/shared/api/client";
export const roles = [
  "PROPERTY_MANAGER",
  "ACCOUNTANT",
  "MAINTENANCE_STAFF",
  "SECURITY_OPERATIONS_STAFF",
  "TENANT",
  "VENDOR",
] as const;
export type Role = (typeof roles)[number];
export interface Organization {
  id: string;
  name: string;
  active: boolean;
}
export interface Account {
  id: string;
  email: string;
  display_name: string;
  active: boolean;
  platform_admin: boolean;
  must_change_password: boolean;
}
export interface Building {
  id: string;
  name: string;
  code: string;
}
export interface Member {
  account_id: string;
  email: string;
  display_name: string;
  owner: boolean;
  status: string;
}
export interface Access {
  owner: boolean;
  roles: { building_id: string; role: Role }[];
}
export const adminApi = {
  organizations: (page: number) =>
    api<Organization[]>(`/platform/organizations?page=${page}`),
  accounts: (page: number) => api<Account[]>(`/platform/accounts?page=${page}`),
  createOrg: (body: unknown) => api("/platform/organizations", "POST", body),
  createAccount: (body: unknown) => api("/platform/accounts", "POST", body),
  organizationStatus: (id: string, active: boolean) =>
    api(`/platform/organizations/${id}`, "PATCH", { active }),
  accountStatus: (id: string, active: boolean) =>
    api(`/platform/accounts/${id}`, "PATCH", { active }),
  reset: (id: string, temporaryPassword: string) =>
    api(`/platform/accounts/${id}/reset-password`, "POST", {
      temporaryPassword,
    }),
  access: (org: string) => api<Access>(`/organizations/${org}/access`),
  buildings: (org: string, page: number) =>
    api<Building[]>(`/organizations/${org}/buildings?page=${page}`),
  createBuilding: (org: string, body: unknown) =>
    api(`/organizations/${org}/buildings`, "POST", body),
  members: (org: string, building: string, page: number) =>
    api<Member[]>(
      `/organizations/${org}/members?page=${page}${building ? `&buildingId=${building}` : ""}`,
    ),
  invite: (org: string, body: unknown) =>
    api(`/organizations/${org}/members`, "POST", body),
  membership: (org: string, user: string, owner: boolean, removed: boolean) =>
    api(`/organizations/${org}/members/${user}`, "PATCH", { owner, removed }),
  updateMember: (org: string, user: string, displayName: string) =>
    api(`/organizations/${org}/members/${user}/profile`, "PATCH", {
      displayName,
    }),
  getRoles: (org: string, building: string, user: string) =>
    api<{ role: Role }[]>(
      `/organizations/${org}/buildings/${building}/members/${user}/roles`,
    ),
  setRoles: (org: string, building: string, user: string, roles: Role[]) =>
    api(
      `/organizations/${org}/buildings/${building}/members/${user}/roles`,
      "PUT",
      { roles },
    ),
  accept: (org: string) =>
    api(`/organizations/${org}/invitations/accept`, "POST"),
};
