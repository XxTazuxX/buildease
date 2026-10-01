import { Alert, Button } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useBillingStatus } from "../viewmodel/useBilling";

/**
 * App-wide notice about the organization's subscription (trial countdown, read-only trial, past
 * due). Owners get a link to Billing; other members are told to contact an owner.
 */
export function SubscriptionBanner({
  org,
  owner,
}: {
  org: string;
  owner: boolean;
}) {
  const status = useBillingStatus(org).data;
  if (!status) return null;
  let severity: "info" | "warning" | "error" = "info";
  let message: string | null = null;
  if (status.status === "TRIALING" && status.writable) {
    if ((status.trialDaysLeft ?? 0) > 7) return null;
    message = `Your free trial ends in ${status.trialDaysLeft ?? 0} day${status.trialDaysLeft === 1 ? "" : "s"}.`;
  } else if (status.status === "TRIALING") {
    severity = "warning";
    message =
      "Your free trial has ended. The workspace is read-only until a plan is active.";
  } else if (status.status === "PAST_DUE") {
    severity = "warning";
    message = "A subscription invoice is overdue.";
  } else if (!status.writable) {
    severity = "error";
    message = "This subscription is not active. New records cannot be created.";
  }
  if (!message) return null;
  return (
    <Alert
      severity={severity}
      sx={{ mb: 3 }}
      action={
        owner ? (
          <Button
            color="inherit"
            size="small"
            component={RouterLink}
            to={`/organizations/${org}/billing`}
          >
            {status.status === "PAST_DUE" ? "View invoices" : "Choose a plan"}
          </Button>
        ) : undefined
      }
    >
      {message}
      {!owner && " Contact an organization owner."}
    </Alert>
  );
}
