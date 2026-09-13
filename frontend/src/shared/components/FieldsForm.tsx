import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, Button, Stack, TextField } from "@mui/material";
import { useState } from "react";
export interface Field {
  name: string;
  label: string;
  type?: string;
  optional?: boolean;
  password?: boolean;
  max?: number;
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
  for (const f of fields) {
    let schema = z.string();
    if (f.max) schema = schema.max(f.max);
    let rule: z.ZodType<string> = f.optional
      ? schema
      : schema.min(1, "Required");
    if (f.type === "email") rule = z.string().trim().email();
    if (f.password)
      rule = z
        .string()
        .refine(
          (s) =>
            (s === "" && f.optional) ||
            ([...s].length >= 15 &&
              [...s].length <= 64 &&
              new TextEncoder().encode(s).length <= 72),
          "Use 15–64 characters, at most 72 UTF-8 bytes",
        );
    shape[f.name] = rule;
  }
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(z.object(shape)),
    defaultValues: Object.fromEntries(fields.map((f) => [f.name, ""])),
  });
  const [error, setError] = useState("");
  return (
    <Stack
      component="form"
      spacing={2}
      onSubmit={form.handleSubmit(async (v) => {
        setError("");
        try {
          await onSubmit(v);
          form.reset();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Request failed");
        }
      })}
    >
      {error && <Alert severity="error">{error}</Alert>}
      {fields.map((f) => (
        <TextField
          key={f.name}
          label={f.label}
          type={f.type || "text"}
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
