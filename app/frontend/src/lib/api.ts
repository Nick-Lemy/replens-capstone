import type { AnalysisJob, ReviewInterval, SetReviewResponse } from "./types";

import { request } from "./transport";

export const api = {
  reviewSet: (reps: ReviewInterval[]) =>
    request<SetReviewResponse>("/set-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        failure_confirmed: true,
        all_remaining_reps_visible: true,
        reps,
      }),
    }),

  health: () =>
    request<{ status: string; model_available: boolean }>("/health"),

  analyze: (file: File) => {
    const body = new FormData();
    body.append("video", file);
    return request<{ id: string }>("/analyses", { method: "POST", body });
  },

  job: (id: string) => request<AnalysisJob>(`/analyses/${id}`),

  cancel: (id: string) =>
    request<void>(`/analyses/${id}`, { method: "DELETE" }),
};
