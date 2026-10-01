import { useEffect, useRef, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";

/**
 * A small pointer-driven drawing surface. Reports a PNG data URL after each stroke, or null when
 * cleared. Works with mouse, pen and touch.
 */
export function SignaturePad({
  onChange,
}: {
  onChange: (dataUrl: string | null) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    context.lineWidth = 2.2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#102E2D";
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = event.currentTarget.width / rect.width;
    const scaleY = event.currentTarget.height / rect.height;
    return [
      (event.clientX - rect.left) * scaleX,
      (event.clientY - rect.top) * scaleY,
    ] as const;
  };

  const clear = () => {
    const element = canvas.current;
    element?.getContext("2d")?.clearRect(0, 0, element.width, element.height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <Stack spacing={0.75}>
      <Box
        component="canvas"
        ref={canvas}
        width={560}
        height={160}
        aria-label="Draw your signature"
        role="img"
        onPointerDown={(event: React.PointerEvent<HTMLCanvasElement>) => {
          const context = event.currentTarget.getContext("2d");
          if (!context) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drawing.current = true;
          const [x, y] = point(event);
          context.beginPath();
          context.moveTo(x, y);
        }}
        onPointerMove={(event: React.PointerEvent<HTMLCanvasElement>) => {
          if (!drawing.current) return;
          const context = event.currentTarget.getContext("2d");
          if (!context) return;
          const [x, y] = point(event);
          context.lineTo(x, y);
          context.stroke();
        }}
        onPointerUp={(event: React.PointerEvent<HTMLCanvasElement>) => {
          if (!drawing.current) return;
          drawing.current = false;
          setEmpty(false);
          onChange(event.currentTarget.toDataURL("image/png"));
        }}
        sx={{
          width: "100%",
          height: 140,
          border: "1px dashed",
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "#FBFCFB",
          touchAction: "none",
          cursor: "crosshair",
        }}
      />
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="caption" color="text.secondary">
          {empty
            ? "Sign above with your mouse, pen or finger"
            : "Signature captured"}
        </Typography>
        <Button size="small" disabled={empty} onClick={clear}>
          Clear
        </Button>
      </Stack>
    </Stack>
  );
}
