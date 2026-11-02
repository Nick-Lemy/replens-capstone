import type { ReviewDraftRow } from "../../../lib/types";

export function ReviewRepRow({
  row,
  index,
  duration,
  onSeek,
  updateRow,
  onRemove,
}: {
  row: ReviewDraftRow;
  index: number;
  duration: number;
  onSeek: (time: number) => void;
  updateRow: (id: string, changes: Partial<ReviewDraftRow>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={row.included}
            onChange={(e) => updateRow(row.id, { included: e.target.checked })}
          />
          {row.sourceRep !== null
            ? `Detected rep ${row.sourceRep}`
            : `Added rep ${index + 1}`}
        </label>
        <div className="flex gap-3">
          <button
            className="text-xs underline"
            onClick={() => {
              const time = Number(row.start);
              if (
                row.start.trim() &&
                Number.isFinite(time) &&
                time >= 0 &&
                time <= duration
              )
                onSeek(time);
            }}
          >
            View
          </button>
          <button className="text-xs underline" onClick={() => onRemove()}>
            Remove
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(
          [
            ["start", "Start"],
            ["top", "Top"],
            ["end", "End"],
          ] as const
        ).map(([field, label]) => (
          <label key={field} className="text-xs text-muted">
            {label} (s)
            <input
              aria-label={`${label} seconds for ${row.sourceRep !== null ? `detected rep ${row.sourceRep}` : `added rep ${index + 1}`}`}
              type="number"
              min="0"
              max={Math.min(duration, 180)}
              step="any"
              value={row[field]}
              onChange={(e) => updateRow(row.id, { [field]: e.target.value })}
              className="mt-1 w-full rounded-lg border border-line bg-page px-2 py-2 text-sm text-ink"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
