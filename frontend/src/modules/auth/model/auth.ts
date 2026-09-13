import { z } from "zod";
import { api } from "@/shared/api/client";
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
  email: z.string().trim().email(),
  password: z.string().min(1, "Enter your password"),
});
export const changeSchema = z
  .object({
    oldPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match",
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
