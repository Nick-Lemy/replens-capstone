export type ModelChoice = "speed_only" | "speed_shaking";
export type ModelCatalog = {
  default: ModelChoice | "legacy" | null;
  models: {
    id: ModelChoice;
    display_name: string;
    family: string;
    experimental: boolean;
    available: boolean;
  }[];
};
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
  model_choice?: ModelChoice | "legacy" | null;
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
  model_choice?: ModelChoice | "legacy" | null;
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
  video: Blob | null;
  review?: SetReview;
};

export type ReviewInterval = {
  start_s: number;
  top_s: number;
  end_s: number;
  source_rep?: number | null;
};
export type ReviewDraftRow = {
  id: string;
  included: boolean;
  start: string;
  top: string;
  end: string;
  sourceRep: number | null;
};
export type SetReview = {
  draft: ReviewDraftRow[];
  failureConfirmed: boolean;
  allRemainingVisible: boolean;
  result: SetReviewResponse | null;
};
export type SetReviewResponse = {
  method: "confirmed_failure_countback";
  is_prediction: false;
  rep_count: number;
  reps: (ReviewInterval & { rep: number; observed_rir: number })[];
  notice: string;
};
