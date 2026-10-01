import { z } from "zod";
import { api } from "@/shared/api/client";
import { enumChoice, requiredText } from "@/shared/forms/rules";

export const audiences = ["ALL_RESIDENTS", "ALL_STAFF"] as const;
export type Audience = (typeof audiences)[number];

export interface AnnouncementSummary {
  id: string;
  title: string;
  audience: Audience;
  sent_by: string;
  recipient_count: number;
  created_at: string;
}
export interface AnnouncementDetail extends AnnouncementSummary {
  body: string;
}

export const announcementSchema = z.object({
  title: requiredText(160),
  body: requiredText(4000),
  audience: enumChoice(audiences),
});
export type NewAnnouncement = z.infer<typeof announcementSchema>;

const base = (org: string, building: string) =>
  `/organizations/${org}/buildings/${building}/announcements`;

export const announcementsApi = {
  history: (org: string, building: string, page: number) =>
    api<AnnouncementSummary[]>(`${base(org, building)}?page=${page}`),
  send: (org: string, building: string, body: NewAnnouncement) =>
    api<{ id: string }>(base(org, building), "POST", body),
  detail: (org: string, building: string, id: string) =>
    api<AnnouncementDetail>(`${base(org, building)}/${id}`),
};
