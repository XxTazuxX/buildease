import { publicApi } from "@/shared/api/client";

export type OnboardingMode = "register" | "forgot" | "verify" | "reset";
export interface OnboardingValues {
  email: string;
  displayName: string;
  organizationName: string;
  password: string;
}

export const onboardingApi = {
  register: (values: OnboardingValues) =>
    publicApi("/auth/register", "POST", values),
  verify: (token: string) => publicApi("/auth/verify", "POST", { token }),
  forgot: (email: string) =>
    publicApi("/auth/forgot-password", "POST", { email }),
  reset: (token: string, password: string) =>
    publicApi("/auth/reset-password", "POST", { token, password }),
};
