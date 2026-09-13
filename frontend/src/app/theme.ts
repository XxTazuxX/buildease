import { alpha, createTheme } from "@mui/material";

const ink = "#172B2D";
const evergreen = "#155E57";
const canvas = "#F5F7F4";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: evergreen, dark: "#0D4742", light: "#DDF2EC" },
    secondary: { main: "#E6A23C", dark: "#B96D10", light: "#FFF1D8" },
    background: { default: canvas, paper: "#FFFFFF" },
    text: { primary: ink, secondary: "#667776" },
    divider: "#DDE5E1",
    success: { main: "#278260" },
    error: { main: "#C34B4B" },
  },
  typography: {
    fontFamily:
      'Inter, "Avenir Next", Avenir, "Segoe UI", system-ui, sans-serif',
    h1: {
      fontSize: "clamp(2.5rem, 5vw, 4.4rem)",
      fontWeight: 720,
      lineHeight: 1.02,
      letterSpacing: "-0.045em",
    },
    h3: {
      fontSize: "clamp(2rem, 3vw, 2.7rem)",
      fontWeight: 720,
      lineHeight: 1.08,
      letterSpacing: "-0.035em",
    },
    h4: {
      fontSize: "clamp(1.55rem, 2vw, 2rem)",
      fontWeight: 700,
      lineHeight: 1.15,
      letterSpacing: "-0.025em",
    },
    h5: { fontWeight: 680, letterSpacing: "-0.018em" },
    h6: { fontWeight: 680, letterSpacing: "-0.012em" },
    overline: { fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.16em" },
    button: { fontWeight: 700, letterSpacing: "-0.01em" },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          minWidth: 320,
          backgroundImage:
            "radial-gradient(circle at 90% -10%, #E7F3EE 0, transparent 27rem)",
        },
        "::selection": { background: "#BFE4D8", color: ink },
        "*": { boxSizing: "border-box" },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: "1px solid #E0E7E3", backgroundImage: "none" },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 10,
          minHeight: 42,
          paddingInline: 18,
        },
        contained: { boxShadow: `0 7px 18px ${alpha(evergreen, 0.18)}` },
      },
    },
    MuiTextField: { defaultProps: { variant: "outlined" } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 11,
          background: "#FFFFFF",
          "&.Mui-focused": { boxShadow: `0 0 0 3px ${alpha(evergreen, 0.1)}` },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          padding: 8,
          boxShadow: "0 30px 80px rgba(18, 47, 45, 0.18)",
        },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 700, borderRadius: 8 } } },
    MuiTabs: { styleOverrides: { root: { minHeight: 48 } } },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 700, minHeight: 48 },
      },
    },
  },
});
