import { Download, RefreshCw } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import type { AnalysisJob } from "../../lib/types";
import type { InstallPrompt } from "../../hooks/useBrowserStatus";
import { Button, Notice } from "../shared/UI";

export function PwaUpdateNotice({ busy }: { busy: boolean }) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <>
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
    </>
  );
}

export function ApplicationStatusNotices({
  online,
  healthError,
  busy,
  tab,
  setTab,
  message,
  clearMessage,
  errors,
  job,
}: {
  online: boolean;
  healthError: boolean;
  busy: boolean;
  tab: "analyze" | "history";
  setTab: (tab: "analyze" | "history") => void;
  message: string;
  clearMessage: () => void;
  errors: unknown[];
  job?: AnalysisJob;
}) {
  return (
    <>
      {!online && (
        <Notice>
          You’re offline. Saved sessions still work. Connect to analyze a new
          video.
        </Notice>
      )}
      {healthError && online && (
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
      {message && <Notice onClose={() => clearMessage()}>{message}</Notice>}
      {errors.map((error, i) => (
        <Notice key={i}>
          {error instanceof Error
            ? error.message
            : "Something went wrong. Please try again."}
        </Notice>
      ))}
      {job?.state === "failed" && <Notice>{job.message}</Notice>}
    </>
  );
}

export function InstallAppPrompt({
  install,
  busy,
  dismissInstall,
}: {
  install: InstallPrompt | null;
  busy: boolean;
  dismissInstall: () => void;
}) {
  return (
    <>
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
    </>
  );
}
