import type { AnalysisResult } from "../../lib/types";
export function ModelMetadata({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-2 text-xs leading-5 text-muted">
      {result.warnings.map((w) => (
        <p key={w}>{w}</p>
      ))}
      {result.model && (
        <p>
          {result.model.display_name ?? result.model.family.toUpperCase()} ·{" "}
          {result.model.version} · Experimental model. Held-out participant
          average error: {result.model.participant_mae_reps.toFixed(2)} reps
          {result.model.evaluation_examples &&
          result.model.evaluation_participants
            ? ` on ${result.model.evaluation_examples} quality-filtered examples from ${result.model.evaluation_participants} people`
            : ""}
          . This is not an individual confidence estimate.
          {result.model.evaluated_refit === false &&
            " The app uses a refit on all accepted training examples; that refit has not been independently evaluated."}
        </p>
      )}
      <p>
        Predictions do not confirm muscle failure or tell you that another rep
        is safe.
      </p>
    </div>
  );
}
