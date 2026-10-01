import { useState } from "react";
import {
  Alert,
  Button,
  FormHelperText,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { StatusChip } from "@/shared/components/Surface";
import { useZodForm } from "@/shared/forms/useZodForm";
import {
  drawingError,
  signFormSchema,
  type SignatureRole,
} from "../model/signatures";
import { useSignature } from "../viewmodel/useSignature";
import { SignaturePad } from "./SignaturePad";

export function SignaturePanel({
  org,
  building,
  lease,
  role,
  defaultName,
  canSign = true,
}: {
  org: string;
  building: string;
  lease: string;
  role: SignatureRole;
  defaultName: string;
  canSign?: boolean;
}) {
  const vm = useSignature(org, building, lease);
  const form = useZodForm(signFormSchema, { signedName: defaultName });
  const [style, setStyle] = useState<"typed" | "drawn">("typed");
  const [drawing, setDrawing] = useState<string | null>(null);
  const [drawingProblem, setDrawingProblem] = useState<string | null>(null);
  const mine =
    role === "OWNER" ? vm.status.data?.owner : vm.status.data?.resident;
  const other =
    role === "OWNER" ? vm.status.data?.resident : vm.status.data?.owner;
  const otherLabel = role === "OWNER" ? "Resident" : "Owner";

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">Signatures</Typography>
      {vm.error && <Alert severity="error">{vm.error}</Alert>}
      <StatusChip
        active={!!vm.status.data?.fullyExecuted}
        label={
          vm.status.data?.fullyExecuted
            ? "Fully executed"
            : "Awaiting signatures"
        }
      />
      <Typography variant="body2" color="text.secondary">
        {otherLabel}:{" "}
        {other ? `Signed by ${other.signed_name}` : "Not yet signed"}
      </Typography>
      {mine ? (
        <Typography variant="body2" color="text.secondary">
          You signed as {mine.signed_name}.
        </Typography>
      ) : canSign ? (
        <Stack spacing={1}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={style}
            onChange={(_, value: "typed" | "drawn" | null) =>
              value && setStyle(value)
            }
            aria-label="Signature style"
          >
            <ToggleButton value="typed">Type</ToggleButton>
            <ToggleButton value="drawn">Draw</ToggleButton>
          </ToggleButtonGroup>
          {style === "drawn" && (
            <>
              <SignaturePad
                onChange={(data) => {
                  setDrawing(data);
                  setDrawingProblem(null);
                }}
              />
              {drawingProblem && (
                <FormHelperText error>{drawingProblem}</FormHelperText>
              )}
            </>
          )}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ alignItems: { sm: "flex-start" } }}
          >
            <TextField
              size="small"
              label="Type your full legal name to sign"
              {...form.field("signedName")}
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="contained"
              disabled={vm.busy}
              onClick={form.submit(async ({ signedName }) => {
                if (style !== "drawn") return vm.sign(role, signedName);
                const problem = drawingError(drawing);
                setDrawingProblem(problem);
                if (problem || !drawing) return;
                return vm.sign(role, signedName, drawing);
              })}
            >
              Sign lease
            </Button>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}
