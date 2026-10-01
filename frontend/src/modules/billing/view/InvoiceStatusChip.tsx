import { Chip } from "@mui/material";
import type { InvoiceStatus, SubscriptionStatus } from "../model/billing";

const invoiceColors: Record<
  InvoiceStatus,
  "default" | "info" | "error" | "success" | "warning"
> = {
  DRAFT: "default",
  ISSUED: "info",
  OVERDUE: "error",
  PAID: "success",
  VOID: "default",
};

export function InvoiceStatusChip({ status }: { status: InvoiceStatus }) {
  return (
    <Chip
      size="small"
      color={invoiceColors[status]}
      variant={status === "VOID" ? "outlined" : "filled"}
      label={status.charAt(0) + status.slice(1).toLowerCase()}
    />
  );
}

const subscriptionColors: Record<
  SubscriptionStatus,
  "default" | "info" | "error" | "success" | "warning"
> = {
  TRIALING: "info",
  ACTIVE: "success",
  PAST_DUE: "warning",
  SUSPENDED: "error",
  CANCELLED: "default",
};

export function SubscriptionStatusChip({
  status,
}: {
  status: SubscriptionStatus | null;
}) {
  if (!status) return <Chip size="small" label="No subscription" />;
  return (
    <Chip
      size="small"
      color={subscriptionColors[status]}
      label={
        status === "PAST_DUE"
          ? "Past due"
          : status.charAt(0) + status.slice(1).toLowerCase()
      }
    />
  );
}
