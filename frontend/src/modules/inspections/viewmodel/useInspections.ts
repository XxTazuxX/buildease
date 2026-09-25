import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildingsApi, type Space } from "@/modules/buildings";
import { stripPhotoMetadata } from "@/modules/maintenance";
import { occupancyApi, type Resident } from "@/modules/occupancy";
import {
  createInspectionSchema,
  inspectionsApi,
  itemSchema,
  type NewInspection,
  type NewItem,
} from "../model/inspections";

export function useInspections(
  org: string,
  building: string,
  page: number,
  spaceId?: string,
) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useQuery({
    queryKey: [org, "building", building, "inspections", page, spaceId ?? ""],
    queryFn: () => inspectionsApi.list(org, building, page, spaceId),
    enabled: !!building,
  });
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await cache.invalidateQueries({
        queryKey: [org, "building", building, "inspections"],
      });
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return {
    list,
    busy,
    error,
    create: (body: NewInspection) =>
      run(() =>
        inspectionsApi.create(
          org,
          building,
          createInspectionSchema.parse(body),
        ),
      ),
    complete: (id: string, notes?: string) =>
      run(() => inspectionsApi.complete(org, building, id, notes)),
    acknowledge: (id: string) =>
      run(() => inspectionsApi.acknowledge(org, building, id)),
  };
}

export function useInspectionSpaces(org: string, building: string) {
  return useQuery<Space[]>({
    queryKey: [org, "building", building, "spaces"],
    queryFn: () => buildingsApi.spaces(org, building),
    enabled: !!building,
  });
}

export function useInspectionResidents(org: string, building: string) {
  return useQuery<Resident[]>({
    queryKey: [org, "building", building, "residents"],
    queryFn: () => occupancyApi.residents(org, building),
    enabled: !!building,
  });
}

export function useInspectionDetail(org: string, building: string, id: string) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = [org, "building", building, "inspections", id];
  const detail = useQuery({
    queryKey: key,
    queryFn: () => inspectionsApi.detail(org, building, id),
    enabled: !!id,
  });
  const addItem = async (body: NewItem) => {
    setBusy(true);
    setError("");
    try {
      await inspectionsApi.addItem(org, building, id, itemSchema.parse(body));
      await cache.invalidateQueries({ queryKey: key });
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to add item");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const uploadPhoto = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const photo = await stripPhotoMetadata(file);
      const upload = await inspectionsApi.preparePhoto(
        org,
        building,
        id,
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
  return { detail, busy, error, addItem, uploadPhoto };
}
