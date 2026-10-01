import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AdaptiveDialog } from "@/shared/components/Responsive";
import { useZodForm } from "@/shared/forms/useZodForm";
import { useMailSettings, useEmailTemplates } from "../viewmodel/useAdmin";
import {
  emailTemplateSchema,
  mailSettingsSchema,
  mailTestSchema,
  type EmailTemplate,
} from "../model/admin";

const templateLabels: Record<EmailTemplate["template_key"], string> = {
  VERIFICATION: "Verification email",
  PASSWORD_RESET: "Password reset email",
};

export function SettingsPanel() {
  const mail = useMailSettings();
  const templates = useEmailTemplates();
  const form = useZodForm(mailSettingsSchema, {
    host: "",
    port: "587",
    username: "",
    password: "",
    from: "",
    starttls: true,
  });
  const testForm = useZodForm(mailTestSchema, { recipient: "" });
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const templateForm = useZodForm(emailTemplateSchema, {
    subject: "",
    body: "",
  });
  const { reset: resetForm } = form;

  useEffect(() => {
    if (!mail.query.data) return;
    resetForm({
      host: mail.query.data.host ?? "",
      port: String(mail.query.data.port),
      username: mail.query.data.username ?? "",
      password: "",
      from: mail.query.data.from_address ?? "",
      starttls: mail.query.data.starttls,
    });
  }, [mail.query.data, resetForm]);

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography variant="overline" color="primary.main">
          Email delivery
        </Typography>
        <Typography variant="h5">SMTP settings</Typography>
        <Typography color="text.secondary">
          Used to send verification and password-reset emails.
        </Typography>
        {(mail.query.error ?? mail.action.error) && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {mail.action.error || mail.query.error?.message}
          </Alert>
        )}
        <Stack spacing={2} sx={{ mt: 2, maxWidth: 480 }}>
          <TextField label="SMTP host" {...form.field("host")} />
          <TextField label="Port" type="number" {...form.field("port")} />
          <TextField label="Username" {...form.field("username")} />
          <TextField
            label="Password"
            type="password"
            {...form.field("password")}
            helperText={
              form.error("password") ??
              "Leave blank to keep the current password."
            }
          />
          <TextField label="From address" {...form.field("from")} />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.values.starttls}
                onChange={(_, checked) => form.setValue("starttls", checked)}
              />
            }
            label="Use STARTTLS"
          />
          <Button
            variant="contained"
            disabled={mail.action.busy}
            onClick={form.submit((values) => mail.update(values))}
          >
            Save settings
          </Button>
          <Divider />
          <Typography variant="subtitle2">Send a test email</Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ alignItems: { sm: "flex-start" } }}
          >
            <TextField
              label="Recipient"
              {...testForm.field("recipient")}
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="outlined"
              disabled={mail.action.busy}
              onClick={testForm.submit((values) =>
                mail.sendTest(values.recipient),
              )}
            >
              Send test
            </Button>
          </Stack>
        </Stack>
      </Paper>
      <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography variant="overline" color="primary.main">
          Email templates
        </Typography>
        <Typography variant="h5">Verification &amp; reset emails</Typography>
        {templates.action.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {templates.action.error}
          </Alert>
        )}
        <Stack spacing={1.25} sx={{ mt: 2 }}>
          {templates.query.data?.map((t) => (
            <Paper key={t.template_key} variant="outlined" sx={{ p: 2 }}>
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>
                    {templateLabels[t.template_key]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t.subject}
                  </Typography>
                </Box>
                <Button
                  onClick={() => {
                    setEditing(t);
                    templateForm.reset({ subject: t.subject, body: t.body });
                  }}
                >
                  Edit
                </Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Paper>
      <AdaptiveDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Edit {editing && templateLabels[editing.template_key].toLowerCase()}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Subject" {...templateForm.field("subject")} />
            <TextField
              label="Body"
              multiline
              minRows={6}
              {...templateForm.field("body")}
              helperText={
                templateForm.error("body") ??
                "Use {{link}} where the verification/reset link should appear."
              }
            />
            <Divider />
            <Typography variant="subtitle2">Preview</Typography>
            <Paper variant="outlined" sx={{ p: 2, whiteSpace: "pre-wrap" }}>
              {templateForm.values.body.replaceAll(
                "{{link}}",
                "https://example.com/verify?token=sample-token",
              )}
            </Paper>
            <Button
              variant="contained"
              disabled={templates.action.busy}
              onClick={templateForm.submit(async (values) => {
                const ok = await templates.update(
                  editing!.template_key,
                  values.subject,
                  values.body,
                );
                if (ok) setEditing(null);
              })}
            >
              Save changes
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>
    </Stack>
  );
}
