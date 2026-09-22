import { useEffect, useState } from "react";
import { Alert } from "@mui/material";

export function OfflineNotice() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online) return null;
  return (
    <Alert
      severity="warning"
      sx={{
        position: "fixed",
        zIndex: 2000,
        top: 8,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(92vw, 620px)",
      }}
    >
      You are offline. Saved pages remain readable, but changes are disabled
      until the connection returns.
    </Alert>
  );
}
