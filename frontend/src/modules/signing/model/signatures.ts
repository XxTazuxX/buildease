import { z } from "zod";
import { api } from "@/shared/api/client";
import { requiredText } from "@/shared/forms/rules";

/** Backend @Size limit on a drawn signature's data URL. */
export const SIGNATURE_DATA_MAX = 200000;

export const signFormSchema = z.object({ signedName: requiredText(160) });

/** Returns a message when a drawn signature cannot be submitted, otherwise null. */
export function drawingError(drawing: string | null) {
  if (!drawing) return "Draw your signature above";
  if (drawing.length > SIGNATURE_DATA_MAX)
    return "The drawing is too large. Clear it and draw a simpler signature";
  return null;
}

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
    body: {
      role: SignatureRole;
      signedName: string;
      method: SignatureMethod;
      signatureData?: string;
    },
  ) => api(base(org, building, lease), "POST", body),
};
