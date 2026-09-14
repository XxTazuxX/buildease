import type { DialogProps, DrawerProps } from "@mui/material";
import {
  Box,
  Dialog,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type { ReactNode } from "react";

export function AdaptiveDialog(props: DialogProps) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));
  return (
    <Dialog
      {...props}
      fullScreen={phone}
      slotProps={{
        ...props.slotProps,
        paper: {
          ...props.slotProps?.paper,
          sx: {
            ...(props.slotProps?.paper as { sx?: object } | undefined)?.sx,
            ...(phone && { borderRadius: 0, m: 0, p: 0 }),
          },
        },
      }}
    />
  );
}

export function ActionSheet({
  open,
  onClose,
  title,
  children,
  ...drawerProps
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
} & Omit<DrawerProps, "anchor" | "open" | "onClose">) {
  return (
    <Drawer
      {...drawerProps}
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            borderRadius: "22px 22px 0 0",
            border: 0,
            maxHeight: "82dvh",
            pb: "max(16px, env(safe-area-inset-bottom))",
          },
        },
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 4,
          borderRadius: 4,
          bgcolor: "divider",
          mx: "auto",
          mt: 1.25,
        }}
      />
      <Stack direction="row" sx={{ alignItems: "center", px: 2.5, py: 1.75 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        <IconButton aria-label="Close" onClick={onClose}>
          ×
        </IconButton>
      </Stack>
      <Divider />
      <Stack
        spacing={1}
        sx={{
          p: 2,
          overflowY: "auto",
          "& .MuiButton-root": { minHeight: 48, justifyContent: "flex-start" },
        }}
      >
        {children}
      </Stack>
    </Drawer>
  );
}

export function Glyph({
  name,
}: {
  name: "home" | "admin" | "profile" | "logout" | "building";
}) {
  const paths = {
    home: "M3 10.8 12 3l9 7.8v9.7a.5.5 0 0 1-.5.5H15v-6H9v6H3.5a.5.5 0 0 1-.5-.5z",
    admin: "M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z",
    profile: "M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9m-8 9a8 8 0 0 1 16 0z",
    logout:
      "M10 4H5v16h5v-2H7V6h3zm3.5 3-1.4 1.4 2.6 2.6H9v2h5.7l-2.6 2.6 1.4 1.4 5-5z",
    building:
      "M5 3h10v18H5zm3 3v2h2V6zm0 4v2h2v-2zm0 4v2h2v-2zm4-8v2h1V6zm0 4v2h1v-2zm0 4v2h1v-2z",
  };
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      aria-hidden
      sx={{ width: 22, height: 22, fill: "currentColor" }}
    >
      <path d={paths[name]} />
    </Box>
  );
}
