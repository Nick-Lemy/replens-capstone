import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScanLine, Clock3, Download, RefreshCw } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { api } from "./lib/api";
import { historyStore } from "./lib/history";
import type { AnalysisResult, SavedSession, SetReview } from "./lib/types";
import { Analyze } from "./components/analyze";
import { initialReview } from "./components/set-review";
import { Results } from "./components/results";
import { History } from "./components/history";
import { Button, Notice, ThemeSwitch } from "./components/ui";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function App() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"analyze" | "history">("analyze");
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [video, setVideo] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeSession, setActiveSession] = useState<SavedSession | null>(null);
  const [review, setReview] = useState<SetReview | null>(null);
  const reviewRef = useRef<SetReview | null>(null);
  const viewRef = useRef<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const health = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    retry: 1,
    refetchInterval: 30000,
  });
  const sessions = useQuery({
    queryKey: ["history"],
    queryFn: historyStore.list,
  });
  const job = useQuery({
    queryKey: ["analysis", jobId],
    queryFn: () => api.job(jobId!),
    enabled: !!jobId,
    retry: 1,
    refetchInterval: (query) =>
      ["completed", "failed", "cancelled"].includes(
        query.state.data?.state ?? "",
      )
        ? false
        : 1000,
  });
  const upload = useMutation({
    mutationFn: api.analyze,
    onSuccess: (data) => setJobId(data.id),
  });
  const save = useMutation({
    mutationFn: ({ session }: { session: SavedSession; viewId: string }) =>
      historyStore.save(session),
    onSuccess: (_data, { session, viewId: savedViewId }) => {
      if (viewRef.current === savedViewId) {
        setActiveSession(session);
        setSaved(reviewRef.current === session.review);
      }
      void queryClient.invalidateQueries({ queryKey: ["history"] });
    },
  });
  const remove = useMutation({
    mutationFn: historyStore.remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["history"] });
    },
  });
  const cancel = useMutation({
    mutationFn: api.cancel,
    onSuccess: () => {
      setJobId(null);
      upload.reset();
    },
  });
  const busy =
    upload.isPending ||
    (!!jobId &&
      !["completed", "failed", "cancelled"].includes(job.data?.state ?? "") &&
      !job.isError);
  const displayVideo = result ? video : file;
  useEffect(() => {
    if (!displayVideo) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(displayVideo);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [displayVideo]);
  useEffect(() => {
    if (job.data?.state === "completed" && job.data.result) {
      setResult(job.data.result);
      const nextReview = initialReview(job.data.result);
      reviewRef.current = nextReview;
      setReview(nextReview);
      const nextViewId = crypto.randomUUID();
      viewRef.current = nextViewId;
      setViewId(nextViewId);
      setActiveSession(
        file
          ? {
              id: crypto.randomUUID(),
              title: "Dumbbell curl",
              createdAt: new Date().toISOString(),
              result: job.data.result,
              video: file,
            }
          : null,
      );
      setVideo(file);
      setSaved(false);
    }
  }, [job.data?.state, job.data?.result, file]);
  useEffect(() => {
    const connect = () => setOnline(navigator.onLine);
    const prompt = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    window.addEventListener("online", connect);
    window.addEventListener("offline", connect);
    window.addEventListener("beforeinstallprompt", prompt);
    return () => {
      window.removeEventListener("online", connect);
      window.removeEventListener("offline", connect);
      window.removeEventListener("beforeinstallprompt", prompt);
    };
  }, []);
  function reset() {
    viewRef.current = null;
    setViewId(null);
    setResult(null);
    reviewRef.current = null;
    setReview(null);
    setActiveSession(null);
    setJobId(null);
    setSaved(false);
    setVideo(null);
    upload.reset();
    save.reset();
    setTab("analyze");
    setMessage("");
  }
  function open(session: SavedSession) {
    if (busy) {
      setMessage(
        "An analysis is running. Finish or cancel it before opening another session.",
      );
      setTab("analyze");
      return;
    }
    const nextViewId = crypto.randomUUID();
    viewRef.current = nextViewId;
    setViewId(nextViewId);
    setJobId(null);
    setResult(session.result);
    const nextReview = session.review ?? initialReview(session.result);
    reviewRef.current = nextReview;
    setReview(nextReview);
    setActiveSession(session);
    setVideo(session.video);
    setSaved(true);
    setTab("analyze");
    save.reset();
  }
  const errors = [
    upload.error,
    job.error,
    save.error,
    remove.error,
    cancel.error,
    sessions.error,
  ].filter(Boolean);
  return (
    <div className="min-h-dvh bg-page text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex h-18 max-w-5xl items-center justify-between px-5 sm:px-8">
          <button
            aria-label="RepLens home"
            onClick={() => {
              setTab("analyze");
            }}
            className="flex items-center gap-2.5"
          >
            <span className="grid size-8 place-items-center rounded-[10px] bg-ink text-page">
              <ScanLine size={19} strokeWidth={1.6} />
            </span>
            <span className="text-lg font-semibold tracking-[-.055em]">
              RepLens<span className="text-muted">.</span>
            </span>
          </button>
          <div className="hidden items-center gap-1 rounded-full bg-soft p-1 sm:flex">
            {(["analyze", "history"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-current={tab === t ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-xs font-medium transition ${tab === t ? "bg-panel text-ink shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {t === "analyze" ? "Analyze" : "History"}
              </button>
            ))}
          </div>
          <ThemeSwitch />
        </div>
      </header>
      <main
        className="mx-auto max-w-155 space-y-5 px-5 pb-32 pt-9 sm:px-8 sm:pt-12"
        id="main"
      >
        {needRefresh && (
          <Notice>
            <div className="flex flex-wrap items-center gap-3">
              An app update is ready.
              <button
                onClick={() => void updateServiceWorker(true)}
                disabled={busy}
                className="flex items-center gap-1 font-medium text-ink underline"
              >
                <RefreshCw size={13} />
                Update
              </button>
            </div>
          </Notice>
        )}
        {!online && (
          <Notice>
            You’re offline. Saved sessions still work. Connect to analyze a new
            video.
          </Notice>
        )}
        {health.isError && online && (
          <Notice>
            The analyzer is offline. Start the backend or check its URL. Your
            saved sessions are still available.
          </Notice>
        )}
        {busy && tab === "history" && (
          <Notice>
            <button
              onClick={() => setTab("analyze")}
              className="font-medium underline underline-offset-4"
            >
              Your analysis is running. View progress
            </button>
          </Notice>
        )}
        {message && <Notice onClose={() => setMessage("")}>{message}</Notice>}
        {errors.map((error, i) => (
          <Notice key={i}>
            {error instanceof Error
              ? error.message
              : "Something went wrong. Please try again."}
          </Notice>
        ))}
        {job.data?.state === "failed" && <Notice>{job.data.message}</Notice>}
        {tab === "history" ? (
          <History
            sessions={sessions.data ?? []}
            loading={sessions.isPending}
            onOpen={open}
            onRemove={(id) => remove.mutate(id)}
            onAnalyze={() => (busy ? setTab("analyze") : reset())}
          />
        ) : result && review ? (
          <Results
            key={viewId}
            result={result}
            url={url}
            onBack={reset}
            saved={saved}
            saving={save.isPending}
            review={review}
            onReviewChange={(next) => {
              reviewRef.current = next;
              setReview(next);
              setSaved(false);
            }}
            onSave={
              video && viewId
                ? () =>
                    save.mutate({
                      viewId,
                      session: {
                        id: activeSession?.id ?? crypto.randomUUID(),
                        title: activeSession?.title ?? "Dumbbell curl",
                        createdAt:
                          activeSession?.createdAt ?? new Date().toISOString(),
                        result,
                        video,
                        review,
                      },
                    })
                : undefined
            }
          />
        ) : (
          <Analyze
            file={file}
            url={url}
            busy={busy}
            job={job.data}
            onFile={(value) => {
              setFile(value);
              setJobId(null);
              upload.reset();
            }}
            onStart={() => {
              if (file) {
                setMessage("");
                setJobId(null);
                upload.mutate(file);
              }
            }}
            onCancel={() => {
              if (jobId) cancel.mutate(jobId);
            }}
          />
        )}
        {install && !busy && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-line p-4">
            <div>
              <p className="text-sm font-medium">Keep RepLens close.</p>
              <p className="mt-1 text-xs text-muted">
                Add it to your home screen.
              </p>
            </div>
            <Button
              secondary
              onClick={async () => {
                await install.prompt();
                await install.userChoice;
                setInstall(null);
              }}
            >
              <Download size={15} />
              Install
            </Button>
          </div>
        )}
        <footer className="pt-3 text-center text-[11px] text-muted">
          RepLens · A closer look at your effort.
        </footer>
      </main>
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-page/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
      >
        <div className="mx-auto grid h-17 max-w-md grid-cols-2">
          {(
            [
              { id: "analyze", label: "Analyze", Icon: ScanLine },
              { id: "history", label: "History", Icon: Clock3 },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1.5 text-[10px] font-medium transition ${tab === id ? "text-ink" : "text-muted"}`}
            >
              <Icon size={21} strokeWidth={tab === id ? 1.9 : 1.5} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
