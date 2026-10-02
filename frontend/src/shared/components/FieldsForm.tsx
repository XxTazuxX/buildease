import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, Button, Stack, TextField } from "@mui/material";
import { useState } from "react";
import {
  optionalEmail,
  optionalPasswordRule,
  passwordRule,
  requiredEmail,
} from "@/shared/forms/rules";
import { reportError } from "@/shared/feedback/reportError";
export interface Field {
  name: string;
  label: string;
  type?: string;
  optional?: boolean;
  password?: boolean;
  max?: number;
  defaultValue?: string;
  multiline?: boolean;
  pattern?: RegExp;
  patternMessage?: string;
}

function ruleFor(f: Field): z.ZodType<string> {
  if (f.password) return f.optional ? optionalPasswordRule() : passwordRule();
  if (f.type === "email") {
    return f.optional ? optionalEmail(f.max) : requiredEmail(f.max);
  }
  const base = z.string().trim();
  const sized = f.max
    ? base.max(f.max, `Use at most ${f.max} characters`)
    : base;
  const rule: z.ZodType<string> = f.optional ? sized : sized.min(1, "Required");
  const { pattern } = f;
  if (!pattern) return rule;
  return rule.refine(
    (value) => (f.optional && value === "") || pattern.test(value),
    f.patternMessage ?? "Invalid format",
  );
}
export function FieldsForm({
  fields,
  onSubmit,
  label = "Save",
}: {
  fields: Field[];
  onSubmit: (values: Record<string, string>) => Promise<unknown>;
  label?: string;
}) {
  const shape: Record<string, z.ZodType<string>> = {};
  for (const f of fields) shape[f.name] = ruleFor(f);
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(z.object(shape)),
    defaultValues: Object.fromEntries(
      fields.map((f) => [f.name, f.defaultValue ?? ""]),
    ),
  });
  const [error, setError] = useState("");
  return (
    <Stack
      component="form"
      noValidate
      spacing={2}
      onSubmit={form.handleSubmit(async (v) => {
        setError("");
        try {
          await onSubmit(v);
          form.reset();
        } catch (e) {
          setError(reportError(e, "Request failed"));
        }
      })}
    >
      {error && <Alert severity="error">{error}</Alert>}
      {fields.map((f) => (
        <TextField
          key={f.name}
          label={f.label}
          type={f.type || "text"}
          multiline={f.multiline}
          minRows={f.multiline ? 2 : undefined}
          autoComplete={f.password ? "new-password" : undefined}
          {...form.register(f.name)}
          error={!!form.formState.errors[f.name]}
          helperText={form.formState.errors[f.name]?.message}
        />
      ))}
      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={form.formState.isSubmitting}
        sx={{ mt: 0.5 }}
      >
        {form.formState.isSubmitting ? "Saving…" : label}
      </Button>
    </Stack>
  );
}
