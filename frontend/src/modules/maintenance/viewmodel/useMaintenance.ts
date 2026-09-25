import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildingsApi } from "@/modules/buildings/model/buildings";
import {
  maintenanceApi,
  requestSchema,
  stripPhotoMetadata,
  type NewMaintenanceRequest,
  type Priority,
} from "../model/maintenance";

export function useMaintenance(org: string, building: string) {
  const cache = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const key = [org, "building", building, "maintenance"];
  const categories = useQuery({
    queryKey: [...key, "categories"],
    queryFn: () => maintenanceApi.categories(org, building),
    enabled: !!building,
  });
  const requests = useQuery({
    queryKey: [...key, "requests"],
    queryFn: () => maintenanceApi.requests(org, building),
    enabled: !!building,
  });
  const spaces = useQuery({
    queryKey: [org, "building", building, "spaces"],
    queryFn: () => buildingsApi.spaces(org, building),
    enabled: !!building,
  });
  const vendors = useQuery({
    queryKey: [...key, "vendors"],
    queryFn: () => maintenanceApi.vendors(org, building),
    enabled: !!building,
  });
  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await operation();
      await cache.invalidateQueries({ queryKey: key });
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return {
    categories,
    requests,
    spaces,
    vendors,
    error,
    busy,
    submit: async (body: NewMaintenanceRequest, file?: File) => {
      setBusy(true);
      setError("");
      try {
        const created = await maintenanceApi.submit(
          org,
          building,
          requestSchema.parse(body),
        );
        if (file) {
          const photo = await stripPhotoMetadata(file);
          const upload = await maintenanceApi.preparePhoto(
            org,
            building,
            created.id,
            photo,
          );
          const response = await fetch(upload.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": upload.contentType },
            body: photo,
          });
          if (!response.ok)
            throw new Error(
              "The request was saved, but its photo upload failed",
            );
        }
        await cache.invalidateQueries({ queryKey: key });
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Operation failed");
        return false;
      } finally {
        setBusy(false);
      }
    },
    createCategory: (body: {
      name: string;
      responseHours: number;
      resolutionHours: number;
    }) => run(() => maintenanceApi.createCategory(org, building, body)),
    updateCategory: (
      id: string,
      body: { name: string; responseHours: number; resolutionHours: number },
    ) => run(() => maintenanceApi.updateCategory(org, building, id, body)),
    triage: (id: string, priority: Priority) =>
      run(() =>
        maintenanceApi.triage(
          org,
          building,
          id,
          priority,
          "Dispatcher confirmed rule suggestion",
        ),
      ),
    start: (id: string) => run(() => maintenanceApi.start(org, building, id)),
    resolve: (id: string, summary: string) =>
      run(() => maintenanceApi.resolve(org, building, id, summary)),
    close: (id: string, confirmed: boolean) =>
      run(() =>
        maintenanceApi.close(
          org,
          building,
          id,
          confirmed ? "CONFIRMED" : "REJECTED",
        ),
      ),
    assignStaff: (request: string, accountId: string, estimatedCost?: number) =>
      run(() =>
        maintenanceApi.assignStaff(
          org,
          building,
          request,
          accountId,
          estimatedCost,
        ),
      ),
    assignVendor: (request: string, vendorId: string, estimatedCost?: number) =>
      run(() =>
        maintenanceApi.assignVendor(
          org,
          building,
          request,
          vendorId,
          estimatedCost,
        ),
      ),
    createVendor: (body: {
      name: string;
      email?: string;
      phone?: string;
      accountId?: string;
    }) => run(() => maintenanceApi.createVendor(org, building, body)),
  };
}

export function useRequestDetail(
  org: string,
  building: string,
  request: string,
) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = [org, "building", building, "maintenance", "requests", request];
  const query = useQuery({
    queryKey: key,
    queryFn: () => maintenanceApi.detail(org, building, request),
    enabled: !!request,
  });
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await cache.invalidateQueries({ queryKey: key });
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const comment = async (body: string, internal = false) =>
    run(() => maintenanceApi.comment(org, building, request, body, internal));
  const addWorkLog = (workOrder: string, note: string, minutes?: number) =>
    run(() =>
      maintenanceApi.addWorkLog(org, building, workOrder, note, minutes),
    );
  const updateWorkCosts = (
    workOrder: string,
    body: { estimatedCost?: number; actualCost?: number },
  ) =>
    run(() => maintenanceApi.updateWorkCosts(org, building, workOrder, body));
  const uploadPhoto = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const photo = await stripPhotoMetadata(file);
      const upload = await maintenanceApi.preparePhoto(
        org,
        building,
        request,
        photo,
      );
      const response = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": upload.contentType },
        body: photo,
      });
      if (!response.ok) throw new Error("Photo upload failed");
      await cache.invalidateQueries({ queryKey: key });
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to upload photo",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  return {
    query,
    busy,
    error,
    comment,
    addWorkLog,
    updateWorkCosts,
    uploadPhoto,
  };
}
