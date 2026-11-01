import type { AnalysisJob, ReviewInterval, SetReviewResponse } from "./types";
const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}/api${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : Array.isArray(body?.detail)
          ? body.detail.map((item: { loc?: (string | number)[]; msg?: string }) => `${item.loc?.filter((part) => part !== "body").join(".") || "Review"}: ${item.msg ?? "Invalid value"}`).join("; ")
        : "The analyzer could not be reached. Check the backend and try again.",
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const api = {
  reviewSet: (reps: ReviewInterval[]) => request<SetReviewResponse>("/set-reviews", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ failure_confirmed: true, all_remaining_reps_visible: true, reps }),
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
