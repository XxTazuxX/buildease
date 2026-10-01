import {
  Alert,
  DialogContent,
  DialogTitle,
  Divider,
  Typography,
} from "@mui/material";
import { FieldsForm, type Field } from "@/shared/components/FieldsForm";
import { AdaptiveDialog } from "@/shared/components/Responsive";

/** A validated replacement for window.prompt: a small dialog of text fields. */
export function PromptDialog({
  title,
  description,
  fields,
  label,
  error,
  onSubmit,
  onClose,
}: {
  title: string;
  description?: string;
  fields: Field[];
  label: string;
  error?: string;
  onSubmit: (values: Record<string, string>) => Promise<unknown>;
  onClose: () => void;
}) {
  return (
    <AdaptiveDialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <Divider />
      <DialogContent>
        {description && <Typography sx={{ mb: 2 }}>{description}</Typography>}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <FieldsForm fields={fields} label={label} onSubmit={onSubmit} />
      </DialogContent>
    </AdaptiveDialog>
  );
}
