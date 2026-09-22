import { useEffect, useState } from "react";
import {
  onboardingApi,
  type OnboardingMode,
  type OnboardingValues,
} from "../model/onboarding";

export function useOnboarding(mode: OnboardingMode, token: string) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "verify" || !token) return;
    setBusy(true);
    void onboardingApi
      .verify(token)
      .then(() => setMessage("Your workspace is ready. You can now sign in."))
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Verification failed",
        ),
      )
      .finally(() => setBusy(false));
  }, [mode, token]);

  const submit = async (values: OnboardingValues) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "register") {
        await onboardingApi.register(values);
        setMessage(
          "Check your email for a verification link. It expires in 30 minutes.",
        );
      } else if (mode === "forgot") {
        await onboardingApi.forgot(values.email);
        setMessage("If that account exists, a reset link has been sent.");
      } else if (mode === "reset") {
        await onboardingApi.reset(token, values.password);
        setMessage("Password changed. You can now sign in.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return { message, error, busy, submit };
}
