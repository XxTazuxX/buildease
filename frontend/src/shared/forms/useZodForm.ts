import { useCallback, useRef } from "react";
import type { BaseSyntheticEvent, ChangeEvent } from "react";
import { useForm, type DefaultValues, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

type Input<S extends z.ZodTypeAny> = z.input<S> & Record<string, unknown>;
type Name<S extends z.ZodTypeAny> = Extract<keyof Input<S>, string>;

/**
 * React Hook Form + Zod, shaped for MUI TextField: `{...form.field("name")}`
 * wires value, change/blur handling and the per-field error message. Errors
 * appear after a field is blurred or a submit was attempted, then follow edits.
 */
export function useZodForm<S extends z.ZodTypeAny>(
  schema: S,
  defaultValues: z.input<S>,
) {
  const form = useForm<Input<S>, unknown, z.output<S>>({
    resolver: zodResolver(
      schema as z.ZodType<z.output<S>, z.ZodTypeDef, Input<S>>,
    ),
    defaultValues: defaultValues as DefaultValues<Input<S>>,
  });
  const initial = useRef(defaultValues);
  const { reset: resetForm } = form;
  const reset = useCallback(
    (next?: z.input<S>) =>
      resetForm((next ?? initial.current) as DefaultValues<Input<S>>),
    [resetForm],
  );
  const values = form.watch();
  const { errors, touchedFields, isSubmitted } = form.formState;

  const message = (name: Name<S>) => {
    const entry = errors[name as keyof typeof errors];
    return typeof entry?.message === "string" ? entry.message : undefined;
  };

  const revalidate = (name: Name<S>) => {
    const targets: string[] = Object.keys(errors);
    const shown =
      isSubmitted || touchedFields[name as keyof typeof touchedFields];
    if (shown && !targets.includes(name)) targets.push(name);
    if (targets.length) void form.trigger(targets as Path<Input<S>>[]);
  };

  const setValue = (name: Name<S>, value: unknown) => {
    form.setValue(name as Path<Input<S>>, value as never, {
      shouldDirty: true,
    });
    revalidate(name);
  };

  return {
    values: values as z.input<S>,
    field: (name: Name<S>) => ({
      name,
      value: (values[name] ?? "") as string,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setValue(name, event.target.value),
      onBlur: () => {
        form.setValue(
          name as Path<Input<S>>,
          form.getValues(name as Path<Input<S>>),
          {
            shouldTouch: true,
          },
        );
        void form.trigger(name as Path<Input<S>>);
      },
      error: message(name) !== undefined,
      helperText: message(name),
    }),
    setValue,
    error: message,
    submit:
      (onValid: (values: z.output<S>) => unknown) =>
      (event?: BaseSyntheticEvent) =>
        form.handleSubmit(async (parsed) => {
          await onValid(parsed);
        })(event),
    reset,
    isSubmitting: form.formState.isSubmitting,
  };
}
