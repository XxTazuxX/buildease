import { api } from "@/shared/api/client";

export const signatureRoles = ["OWNER", "RESIDENT"] as const;
export type SignatureRole = (typeof signatureRoles)[number];
export const signatureMethods = ["TYPED", "DRAWN"] as const;
export type SignatureMethod = (typeof signatureMethods)[number];

export interface SignatureRecord {
  signed_name: string;
  method: SignatureMethod;
  signed_at: string;
}
export interface SignatureStatus {
  owner: SignatureRecord | null;
  resident: SignatureRecord | null;
  fullyExecuted: boolean;
}

const base = (org: string, building: string, lease: string) =>
  `/organizations/${org}/buildings/${building}/leases/${lease}/signature`;

export const signaturesApi = {
  status: (org: string, building: string, lease: string) =>
    api<SignatureStatus>(base(org, building, lease)),
  sign: (
    org: string,
    building: string,
    lease: string,
    body: { role: SignatureRole; signedName: string; method: SignatureMethod },
  ) => api(base(org, building, lease), "POST", body),
};
