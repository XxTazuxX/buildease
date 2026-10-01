import { z } from "zod";
import { api } from "@/shared/api/client";
import { requiredEmail } from "@/shared/forms/rules";
export const passwordSchema = z
  .string()
  .refine(
    (s) => [...s].length >= 15 && [...s].length <= 64,
    "Use 15–64 characters",
  )
  .refine(
    (s) => new TextEncoder().encode(s).length <= 72,
    "Use at most 72 UTF-8 bytes",
  );
export const loginSchema = z.object({
  email: requiredEmail(),
  password: z
    .string()
    .min(1, "Enter your password")
    .max(256, "Use at most 256 characters"),
});
export const changeSchema = z
  .object({
    oldPassword: z
      .string()
      .min(1, "Enter your current password")
      .max(256, "Use at most 256 characters"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match",
  })
  .refine((v) => v.newPassword !== v.oldPassword, {
    path: ["newPassword"],
    message: "Choose a different password",
  });
export interface Membership {
  organization_id: string;
  name: string;
  owner: boolean;
  status: "ACTIVE" | "PENDING";
}
export interface Profile {
  id: string;
  email: string;
  display_name: string;
  platform_admin: boolean;
  must_change_password: boolean;
  memberships: Membership[];
}
export const getProfile = () => api<Profile>("/auth/me");
export const changePassword = (oldPassword: string, newPassword: string) =>
  api("/auth/change-password", "POST", { oldPassword, newPassword });
