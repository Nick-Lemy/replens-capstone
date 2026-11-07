import {
  ApplicationStatusNotices,
  InstallAppPrompt,
  PwaUpdateNotice,
} from "./components/layout/ApplicationStatus";
import { AppHeader, AppNavigation } from "./components/layout/AppNavigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthPage } from "./features/auth/AuthPage";
import { useAuth } from "./features/auth/useAuth";
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
  const [liveActive, setLiveActive] = useState(false);
  const [authOpen, setAuthOpen] = useState(() =>
    new URLSearchParams(window.location.search).has("auth"),
  );
  const auth = useAuth();
  const refreshAuth = useCallback(() => auth.refresh(), [auth.refresh]);

  useEffect(() => {
    const onPopState = () =>
      setAuthOpen(new URLSearchParams(window.location.search).has("auth"));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const analysis = useAnalysisJob();

  const active = useActiveSession(auth.account?.id ?? null, auth.ready);

  const health = useHealth();

  const models = useModels();

  const { online, install, dismissInstall } = useBrowserStatus();

  const { file, job } = analysis;
  const busy = analysis.busy || liveActive;
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

  function openAuth() {
    if (
      liveActive &&
      !window.confirm("Leave the live camera and discard this recording?")
    ) {
      return;
    }
    window.history.pushState({}, "", "/?auth=login");
    setAuthOpen(true);
  }

  function closeAuth() {
    window.history.pushState({}, "", "/");
    setAuthOpen(false);
  }

  function navigate(next: "analyze" | "history") {
    if (
      liveActive &&
      next !== "analyze" &&
      !window.confirm("Leave the live camera and discard this recording?")
    ) {
      return;
    }
    setTab(next);
  }

  if (authOpen && auth.enabled) {
    return (
      <AuthPage
        account={auth.account}
        onExit={closeAuth}
        onAuthenticated={refreshAuth}
        onLogout={async () => {
          await auth.logout.mutateAsync();
        }}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-page text-ink">
      <AppHeader
        tab={tab}
        setTab={navigate}
        accountName={auth.account?.name}
        onAccount={auth.enabled ? openAuth : undefined}
      />
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
          setTab={navigate}
          message={message}
          clearMessage={() => setMessage("")}
          errors={errors}
          job={job.data}
        />
        {tab === "history" ? (
          <HistoryPage
            sessions={active.sessions.data ?? []}
            loading={active.sessions.isPending}
            error={active.sessions.isError}
            onRetry={() => {
              void active.sessions.refetch();
            }}
            synced={Boolean(auth.account)}
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
            synced={Boolean(auth.account)}
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
            onLiveActivityChange={setLiveActive}
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
      <AppNavigation tab={tab} setTab={navigate} />
    </div>
  );
}
