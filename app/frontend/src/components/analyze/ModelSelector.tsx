import type { ModelCatalog, ModelChoice } from "../../lib/types";
import { Notice } from "../shared/UI";

export function ModelSelector({
  value,
  onChange,
  catalog,
  loading,
  error,
  busy,
  onRetry,
}: {
  value: ModelChoice;
  onChange: (value: ModelChoice) => void;
  catalog?: ModelCatalog;
  loading: boolean;
  error: boolean;
  busy: boolean;
  onRetry: () => void;
}) {
  return (
    <fieldset
      disabled={busy}
      className="space-y-3 rounded-2xl border border-line bg-panel p-5"
    >
      <legend className="px-1 text-sm font-medium">Prediction model</legend>
      <p className="text-xs leading-5 text-muted">
        Shaking is a candidate tremor signal, not a validated physiological
        measurement.
      </p>
      {loading ? (
        <p role="status" className="text-sm text-muted">
          Loading available models…
        </p>
      ) : error ? (
        <Notice>
          Could not load available models.{" "}
          <button
            type="button"
            onClick={onRetry}
            className="font-medium underline"
          >
            Try again
          </button>
        </Notice>
      ) : (
        <>
          {catalog?.models.map((model) => (
            <label key={model.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="model"
                value={model.id}
                checked={value === model.id}
                disabled={!model.available}
                onChange={() => onChange(model.id)}
              />
              {model.id === "speed_only" ? "Speed only" : "Speed + shaking"}
              {!model.available && " · unavailable"}
            </label>
          ))}
          {!catalog?.models.some(
            (model) => model.id === value && model.available,
          ) && (
            <p role="status" className="text-xs text-muted">
              The selected model is unavailable. Choose an available model to
              analyze.
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}
