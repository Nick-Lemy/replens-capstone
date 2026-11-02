import { AppHeader, AppNavigation } from "./components/app-navigation";
import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import type { SavedSession } from "./lib/types";
import { Analyze } from "./components/analyze";
import { Results } from "./components/results";
import { History } from "./components/history";
import { Button, Notice } from "./components/ui";
import { useAnalysisJob } from "./hooks/use-analysis-job";
import { useActiveSession } from "./hooks/use-active-session";
import { useBrowserStatus } from "./hooks/use-browser-status";
import { useObjectUrl } from "./hooks/use-object-url";
import { useHealth } from "./hooks/use-health";

export default function App() {
  const [tab, setTab] = useState<"analyze" | "history">("analyze");
  const [message, setMessage] = useState("");
  const analysis = useAnalysisJob();
  const active = useActiveSession();
  const health = useHealth();
  const { online, install, dismissInstall } = useBrowserStatus();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const { file, job, busy } = analysis;
  const { session, review, saved, viewId } = active;
  const result = session?.result ?? null;
  const url = useObjectUrl(session?.video ?? file);
  const handledJob = useRef<string | null>(null);
  useEffect(() => {
    if (
      analysis.jobId &&
      !analysis.cancel.isPending &&
      handledJob.current !== analysis.jobId &&
      job.data?.state === "completed" &&
      job.data.result &&
      file
    ) {
      handledJob.current = analysis.jobId;
      active.complete(job.data.result, file);
    }
  }, [analysis.jobId, job.data?.state, job.data?.result, file]);
  function reset() {
    analysis.reset();
    active.reset();
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
    analysis.reset();
    active.open(session);
    setTab("analyze");
  }
  const errors = [
    analysis.upload.error,
    job.error,
    active.save.error,
    active.remove.error,
    analysis.cancel.error,
    active.sessions.error,
  ].filter(Boolean);
  return (
    <div className="min-h-dvh bg-page text-ink">
      <AppHeader tab={tab} setTab={setTab} />
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
            sessions={active.sessions.data ?? []}
            loading={active.sessions.isPending}
            onOpen={open}
            onRemove={(id) => active.remove.mutate(id)}
            onAnalyze={() => (busy ? setTab("analyze") : reset())}
          />
        ) : result && review ? (
          <Results
            key={viewId}
            result={result}
            url={url}
            onBack={reset}
            saved={saved}
            saving={active.save.isPending}
            review={review}
            onReviewChange={active.changeReview}
            onSave={active.saveSession}
          />
        ) : (
          <Analyze
            file={file}
            url={url}
            busy={busy}
            job={job.data}
            onFile={analysis.choose}
            onStart={() => {
              setMessage("");
              analysis.start();
            }}
            onCancel={analysis.cancelJob}
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
                dismissInstall();
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
      <AppNavigation tab={tab} setTab={setTab} />
    </div>
  );
}
