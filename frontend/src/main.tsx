import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { AuthProvider } from "@/modules/auth/viewmodel/AuthProvider";
import App from "@/app/App";
import { theme } from "@/app/theme";
const query = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 15000 } },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <QueryClientProvider client={query}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ThemeProvider>,
);
