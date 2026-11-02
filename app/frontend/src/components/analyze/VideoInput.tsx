import { useRef, useState } from "react";
import { Film, Plus, ScanLine, X } from "lucide-react";
import { Button, Notice, seconds } from "../shared/UI";
export function VideoInput({
  file,
  url,
  busy,
  onFile,
  onStart,
  canStart,
}: {
  file: File | null;
  url: string | null;
  busy: boolean;
  onFile: (file: File | null) => void;
  onStart: () => void;
  canStart: boolean;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  function choose(value?: File) {
    if (!value || busy) return;
    if (!/\.(mp4|mov|m4v|webm)$/i.test(value.name)) {
      setError("Choose an MP4, MOV, M4V or WebM video.");
      return;
    }
    if (value.size > 250 * 1024 * 1024) {
      setError("Choose a video smaller than 250 MB.");
      return;
    }
    setError("");
    setDuration(null);
    onFile(value);
  }
  return (
    <>
      <input
        ref={picker}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.m4v"
        className="sr-only"
        aria-label="Choose a curl video"
        disabled={busy}
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {!file ? (
        <div
          className={`rounded-3xl border bg-panel p-2 transition-colors ${dragging ? "border-ink" : "border-line"}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choose(e.dataTransfer.files[0]);
          }}
        >
          <button
            onClick={() => picker.current?.click()}
            className="group flex min-h-64 w-full flex-col items-center justify-center rounded-[18px] bg-soft p-6 text-center sm:min-h-72"
          >
            <span className="mb-6 grid size-14 place-items-center rounded-2xl border border-line bg-panel shadow-sm transition-transform group-hover:-translate-y-1">
              <Plus size={24} strokeWidth={1.5} />
            </span>
            <span className="text-base font-medium">Choose your video</span>
            <span className="mt-2 text-sm text-muted">
              From your camera roll or files
            </span>
            <span className="mt-5 text-xs text-muted">
              MP4, MOV or WebM · Up to 3 minutes
            </span>
          </button>
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted">
            <Film size={14} />
            <span>One complete set works best.</span>
          </div>
        </div>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-line bg-panel p-2">
          <div className="relative overflow-hidden rounded-[18px] bg-stage">
            <video
              src={url ?? undefined}
              controls
              playsInline
              muted
              preload="metadata"
              className="mx-auto max-h-100 w-full"
              onLoadedMetadata={(e) => {
                const value = e.currentTarget.duration;
                setDuration(value);
                if (value > 180)
                  setError(
                    "This video is longer than 3 minutes. Choose a shorter set.",
                  );
              }}
              onError={() =>
                setError(
                  "Your browser cannot preview this format. The analyzer may still decode it; an H.264 MP4 is the most compatible option.",
                )
              }
            />
            {!busy && (
              <button
                aria-label="Remove selected video"
                onClick={() => {
                  onFile(null);
                  setError("");
                }}
                className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/70 text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 px-3 py-4">
            <Film size={18} className="shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="mt-1 text-xs text-muted">
                {(file.size / 1024 / 1024).toFixed(1)} MB
                {duration && Number.isFinite(duration)
                  ? ` · ${seconds(duration)}`
                  : ""}
              </p>
            </div>
            {!busy && (
              <button
                onClick={() => picker.current?.click()}
                className="text-xs font-medium text-muted underline underline-offset-4"
              >
                Change
              </button>
            )}
          </div>
        </section>
      )}
      {error && <Notice onClose={() => setError("")}>{error}</Notice>}
      {file && !busy && (
        <Button
          className="w-full"
          onClick={onStart}
          disabled={!canStart || (duration !== null && duration > 180)}
        >
          <ScanLine size={17} />
          Analyze set
        </Button>
      )}
    </>
  );
}
