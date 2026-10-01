import { z } from "zod";
import { publicApi } from "@/shared/api/client";
import {
  passwordRule,
  requiredEmail,
  requiredText,
} from "@/shared/forms/rules";

export type OnboardingMode = "register" | "forgot" | "verify" | "reset";
export interface OnboardingValues {
  email: string;
  displayName: string;
  organizationName: string;
  password: string;
}

/** Only the fields the current mode submits are validated; the rest stay free-form. */
export const onboardingSchema = (mode: OnboardingMode) =>
  z.object({
    email:
      mode === "register" || mode === "forgot" ? requiredEmail() : z.string(),
    displayName: mode === "register" ? requiredText(120) : z.string(),
    organizationName: mode === "register" ? requiredText(120) : z.string(),
    password:
      mode === "register" || mode === "reset" ? passwordRule() : z.string(),
  });

export const onboardingApi = {
  register: (values: OnboardingValues) =>
    publicApi("/auth/register", "POST", values),
  verify: (token: string) => publicApi("/auth/verify", "POST", { token }),
  forgot: (email: string) =>
    publicApi("/auth/forgot-password", "POST", { email }),
  reset: (token: string, password: string) =>
    publicApi("/auth/reset-password", "POST", { token, password }),
};
