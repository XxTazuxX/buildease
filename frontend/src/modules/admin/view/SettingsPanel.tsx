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
import { useMailSettings, useEmailTemplates } from "../viewmodel/useAdmin";
import type { EmailTemplate } from "../model/admin";

const templateLabels: Record<EmailTemplate["template_key"], string> = {
  VERIFICATION: "Verification email",
  PASSWORD_RESET: "Password reset email",
};

export function SettingsPanel() {
  const mail = useMailSettings();
  const templates = useEmailTemplates();
  const [form, setForm] = useState({
    host: "",
    port: 587,
    username: "",
    password: "",
    from: "",
    starttls: true,
  });
  const [testEmail, setTestEmail] = useState("");
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ subject: "", body: "" });

  useEffect(() => {
    if (!mail.query.data) return;
    setForm({
      host: mail.query.data.host ?? "",
      port: mail.query.data.port,
      username: mail.query.data.username ?? "",
      password: "",
      from: mail.query.data.from_address ?? "",
      starttls: mail.query.data.starttls,
    });
  }, [mail.query.data]);

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
          <TextField
            label="SMTP host"
            value={form.host}
            onChange={(e) => setForm({ ...form, host: e.target.value })}
          />
          <TextField
            label="Port"
            type="number"
            value={form.port}
            onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
          />
          <TextField
            label="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <TextField
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            helperText="Leave blank to keep the current password."
          />
          <TextField
            label="From address"
            value={form.from}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.starttls}
                onChange={(_, checked) =>
                  setForm({ ...form, starttls: checked })
                }
              />
            }
            label="Use STARTTLS"
          />
          <Button
            variant="contained"
            disabled={mail.action.busy}
            onClick={() => void mail.update(form)}
          >
            Save settings
          </Button>
          <Divider />
          <Typography variant="subtitle2">Send a test email</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="Recipient"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="outlined"
              disabled={mail.action.busy || !testEmail}
              onClick={() => void mail.sendTest(testEmail)}
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
                    setTemplateForm({ subject: t.subject, body: t.body });
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
            <TextField
              label="Subject"
              value={templateForm.subject}
              onChange={(e) =>
                setTemplateForm({ ...templateForm, subject: e.target.value })
              }
            />
            <TextField
              label="Body"
              multiline
              minRows={6}
              value={templateForm.body}
              onChange={(e) =>
                setTemplateForm({ ...templateForm, body: e.target.value })
              }
              helperText="Use {{link}} where the verification/reset link should appear."
            />
            <Divider />
            <Typography variant="subtitle2">Preview</Typography>
            <Paper variant="outlined" sx={{ p: 2, whiteSpace: "pre-wrap" }}>
              {templateForm.body.replaceAll(
                "{{link}}",
                "https://example.com/verify?token=sample-token",
              )}
            </Paper>
            <Button
              variant="contained"
              disabled={templates.action.busy}
              onClick={() =>
                void templates
                  .update(
                    editing!.template_key,
                    templateForm.subject,
                    templateForm.body,
                  )
                  .then((ok) => ok && setEditing(null))
              }
            >
              Save changes
            </Button>
          </Stack>
        </DialogContent>
      </AdaptiveDialog>
    </Stack>
  );
}
