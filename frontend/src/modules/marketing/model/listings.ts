import { z } from "zod";
import { api } from "@/shared/api/client";

export const listingChannels = ["ZILLOW", "APARTMENTS_COM"] as const;
export type ListingChannel = (typeof listingChannels)[number];
export const listingStatuses = ["DRAFT", "PUBLISHED", "UNPUBLISHED"] as const;
export type ListingStatus = (typeof listingStatuses)[number];
export const syndicationStatuses = [
  "PENDING",
  "SYNDICATED",
  "FAILED",
  "REMOVED",
] as const;
export type SyndicationStatus = (typeof syndicationStatuses)[number];

export interface ListingSummary {
  id: string;
  space_id: string;
  headline: string;
  rent_amount: string;
  currency: string;
  status: ListingStatus;
  published_at: string | null;
}
export interface Syndication {
  channel: ListingChannel;
  status: SyndicationStatus;
  external_id: string | null;
  synced_at: string;
}
export interface ListingDetail extends ListingSummary {
  description: string;
  unpublished_at: string | null;
  syndications: Syndication[];
}

export const newListingSchema = z.object({
  spaceId: z.string().uuid(),
  headline: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(4000),
  rentAmount: z.coerce.number().positive(),
});
export type NewListing = z.infer<typeof newListingSchema>;

const base = (org: string, building: string) =>
  `/organizations/${org}/buildings/${building}/listings`;

export const listingsApi = {
  list: (org: string, building: string) =>
    api<ListingSummary[]>(base(org, building)),
  create: (org: string, building: string, body: NewListing) =>
    api<{ id: string }>(base(org, building), "POST", body),
  detail: (org: string, building: string, id: string) =>
    api<ListingDetail>(`${base(org, building)}/${id}`),
  publish: (
    org: string,
    building: string,
    id: string,
    channels: ListingChannel[],
  ) => api(`${base(org, building)}/${id}/publish`, "POST", { channels }),
  unpublish: (org: string, building: string, id: string) =>
    api(`${base(org, building)}/${id}/unpublish`, "POST"),
};
