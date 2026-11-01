export type Rep = {
  rep: number;
  start_s: number;
  top_s: number;
  end_s: number;
  rir: number | null;
  prediction_status?: "building_history" | "available" | "unavailable";
  prediction_reason?: string | null;
};
export type ModelInfo = {
  family: string;
  display_name?: string;
  version: string;
  participant_mae_reps: number;
  experimental: boolean;
  evaluation_examples?: number;
  evaluation_participants?: number;
  evaluated_refit?: boolean;
};
export type AnalysisResult = {
  exercise: string;
  reps: Rep[];
  rep_count: number;
  duration_s: number;
  tracking_coverage: number;
  warnings: string[];
  prediction_unavailable_reason: string | null;
  model: ModelInfo | null;
};
export type AnalysisJob = {
  id: string;
  state: "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  message: string;
  result?: AnalysisResult;
};
export type SavedSession = {
  id: string;
  title: string;
  createdAt: string;
  result: AnalysisResult;
  video: Blob;
};
