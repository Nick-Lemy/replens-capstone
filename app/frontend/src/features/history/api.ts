import { request } from "../../lib/transport";
import type { SavedSession } from "../../lib/types";

export type SessionRecord = Omit<SavedSession, "video">;

export const sessionApi = {
  list: () => request<SessionRecord[]>("/sessions"),

  save: (session: SavedSession) =>
    request<SessionRecord>(`/sessions/${session.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: session.title,
        result: session.result,
        review: session.review ?? null,
      }),
    }),

  remove: (id: string) =>
    request<void>(`/sessions/${id}`, { method: "DELETE" }),
};
