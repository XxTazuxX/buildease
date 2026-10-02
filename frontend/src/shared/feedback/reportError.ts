import { ZodError } from "zod";
import { notify } from "./notify";

/** A human message for a failure; validation errors read as their first problem, not as JSON. */
export function errorMessage(cause: unknown, fallback: string) {
  if (cause instanceof ZodError) return cause.issues[0]?.message ?? fallback;
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

/**
 * Raises an error toast and returns the same message, so a ViewModel can keep its inline error
 * state: `setError(reportError(cause, "Operation failed"))`.
 */
export function reportError(cause: unknown, fallback: string) {
  const message = errorMessage(cause, fallback);
  notify.error(message);
  return message;
}
