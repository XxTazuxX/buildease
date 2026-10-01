import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  Divider,
  GlobalStyles,
  Stack,
  Typography,
} from "@mui/material";
import { BrandMark } from "@/shared/components/BrandMark";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { formatDate } from "@/shared/utils/dates";
import { money, type InvoiceDetail } from "../model/billing";
import { useInvoice } from "../viewmodel/useBilling";
import { InvoiceStatusChip } from "./InvoiceStatusChip";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", py: 0.5 }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography sx={{ fontWeight: 650 }}>{value}</Typography>
    </Stack>
  );
}

/** A printable subscription invoice. */
export function InvoiceDocument({ invoice }: { invoice: InvoiceDetail }) {
  const billTo = [
    invoice.bill_to.name ?? invoice.organization_name,
    invoice.bill_to.address,
    invoice.bill_to.email,
    invoice.bill_to.tax_id ? `Tax ID ${invoice.bill_to.tax_id}` : null,
  ].filter(Boolean);
  return (
    <Box className="invoice-document" sx={{ p: { xs: 0, sm: 1 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", gap: 2 }}
      >
        <BrandMark />
        <Box sx={{ textAlign: { sm: "right" } }}>
          <Typography variant="h5">Invoice {invoice.number}</Typography>
          <InvoiceStatusChip status={invoice.status} />
        </Box>
      </Stack>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", gap: 2, mt: 3 }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            Bill to
          </Typography>
          {billTo.map((line) => (
            <Typography key={line}>{line}</Typography>
          ))}
        </Box>
        <Box sx={{ minWidth: 220 }}>
          <Row label="Issued" value={formatDate(invoice.issued_on)} />
          <Row label="Due" value={formatDate(invoice.due_on)} />
          {invoice.paid_on && (
            <Row label="Paid" value={formatDate(invoice.paid_on)} />
          )}
        </Box>
      </Stack>
      <Divider sx={{ my: 2.5 }} />
      <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 700 }}>
            {invoice.description}
          </Typography>
          {invoice.period_start && invoice.period_end && (
            <Typography variant="body2" color="text.secondary">
              Service period {formatDate(invoice.period_start)} –{" "}
              {formatDate(invoice.period_end)}
            </Typography>
          )}
        </Box>
        <Typography sx={{ fontWeight: 700 }}>
          {money(invoice.subtotal, invoice.currency)}
        </Typography>
      </Stack>
      <Divider sx={{ my: 2.5 }} />
      <Box sx={{ ml: "auto", maxWidth: 280 }}>
        <Row
          label="Subtotal"
          value={money(invoice.subtotal, invoice.currency)}
        />
        <Row label="Tax" value={money(invoice.tax, invoice.currency)} />
        <Row label="Total" value={money(invoice.total, invoice.currency)} />
      </Box>
      {invoice.payment_reference && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Payment received
          {invoice.payment_method ? ` by ${invoice.payment_method}` : ""} ·
          reference {invoice.payment_reference}
        </Typography>
      )}
      {invoice.notes && (
        <Typography variant="body2" sx={{ mt: 2, whiteSpace: "pre-wrap" }}>
          {invoice.notes}
        </Typography>
      )}
      {["ISSUED", "OVERDUE"].includes(invoice.status) && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          Please pay by bank transfer quoting invoice {invoice.number}, or
          contact BuildEase billing support for other payment options.
        </Typography>
      )}
    </Box>
  );
}

export function InvoiceDialog({
  org,
  invoice,
  platform = false,
  onClose,
}: {
  org: string;
  invoice: string;
  platform?: boolean;
  onClose: () => void;
}) {
  const query = useInvoice(org, invoice, platform);
  return (
    <AdaptiveDialog open onClose={onClose} fullWidth maxWidth="md">
      {/* Print only the invoice, not the application around it. */}
      <GlobalStyles
        styles={{
          "@media print": {
            "body *": { visibility: "hidden" },
            ".invoice-document, .invoice-document *": {
              visibility: "visible",
            },
            ".invoice-document": {
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
            },
          },
        }}
      />
      <DialogContent>
        {query.isLoading && (
          <Typography color="text.secondary">Loading invoice…</Typography>
        )}
        {query.error && <Alert severity="error">{query.error.message}</Alert>}
        {query.data && <InvoiceDocument invoice={query.data} />}
      </DialogContent>
      <DialogActions sx={{ displayPrint: "none" }}>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          disabled={!query.data}
          onClick={() => window.print()}
        >
          Print / save PDF
        </Button>
      </DialogActions>
    </AdaptiveDialog>
  );
}
