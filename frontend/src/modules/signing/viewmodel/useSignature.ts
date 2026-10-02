import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { signaturesApi, type SignatureRole } from "../model/signatures";
import { reportError } from "@/shared/feedback/reportError";

export function useSignature(org: string, building: string, lease: string) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = [org, "building", building, "leases", lease, "signature"];
  const status = useQuery({
    queryKey: key,
    queryFn: () => signaturesApi.status(org, building, lease),
    enabled: !!lease,
  });
  const sign = async (
    role: SignatureRole,
    signedName: string,
    drawing?: string,
  ) => {
    setBusy(true);
    setError("");
    try {
      await signaturesApi.sign(
        org,
        building,
        lease,
        drawing
          ? { role, signedName, method: "DRAWN", signatureData: drawing }
          : { role, signedName, method: "TYPED" },
      );
      await cache.invalidateQueries({ queryKey: key });
      return true;
    } catch (cause) {
      setError(reportError(cause, "Failed to sign"));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { status, busy, error, sign };
}
