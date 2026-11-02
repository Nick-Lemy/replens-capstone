import {
  ApplicationStatusNotices,
  InstallAppPrompt,
  PwaUpdateNotice,
} from "./components/layout/ApplicationStatus";
import { AppHeader, AppNavigation } from "./components/layout/AppNavigation";
import { useEffect, useRef, useState } from "react";
import type { SavedSession } from "./lib/types";
import { AnalyzePage } from "./pages/AnalyzePage";
import { ResultsPage } from "./pages/ResultsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { useAnalysisJob } from "./hooks/useAnalysisJob";
import { useActiveSession } from "./hooks/useActiveSession";
import { useBrowserStatus } from "./hooks/useBrowserStatus";
import { useObjectUrl } from "./hooks/useObjectUrl";
import { useModels } from "./hooks/useModels";
import { useHealth } from "./hooks/useHealth";

export default function App() {
  const [tab, setTab] = useState<"analyze" | "history">("analyze");
  const [message, setMessage] = useState("");

  const analysis = useAnalysisJob();

  const active = useActiveSession();

  const health = useHealth();

  const models = useModels();

  const { online, install, dismissInstall } = useBrowserStatus();

  const { file, job, busy } = analysis;
  const { session, review, saved, viewId, complete } = active;
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
      complete(job.data.result, file);
    }
  }, [
    analysis.jobId,
    analysis.cancel.isPending,
    job.data?.state,
    job.data?.result,
    file,
    complete,
  ]);

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
        <PwaUpdateNotice busy={busy} />
        <ApplicationStatusNotices
          online={online}
          healthError={health.isError}
          busy={busy}
          tab={tab}
          setTab={setTab}
          message={message}
          clearMessage={() => setMessage("")}
          errors={errors}
          job={job.data}
        />
        {tab === "history" ? (
          <HistoryPage
            sessions={active.sessions.data ?? []}
            loading={active.sessions.isPending}
            onOpen={open}
            onRemove={(id) => active.remove.mutate(id)}
            onAnalyze={() => (busy ? setTab("analyze") : reset())}
          />
        ) : result && review ? (
          <ResultsPage
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
          <AnalyzePage
            file={file}
            url={url}
            busy={busy}
            job={job.data}
            onFile={analysis.choose}
            model={analysis.model}
            onModel={analysis.setModel}
            models={models.data}
            modelsLoading={models.isPending}
            modelsError={models.isError}
            retryModels={() => {
              void models.refetch();
            }}
            onStart={() => {
              if (
                models.isError ||
                !models.data?.models.some(
                  (item) => item.id === analysis.model && item.available,
                )
              )
                return;
              setMessage("");
              analysis.start();
            }}
            onCancel={analysis.cancelJob}
          />
        )}
        <InstallAppPrompt
          install={install}
          busy={busy}
          dismissInstall={dismissInstall}
        />
        <footer className="pt-3 text-center text-[11px] text-muted">
          RepLens · A closer look at your effort.
        </footer>
      </main>
      <AppNavigation tab={tab} setTab={setTab} />
    </div>
  );
}
