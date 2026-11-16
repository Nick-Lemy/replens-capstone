import { useEffect, useRef } from "react";

const privacyEmail = "n.kayiranga@alustudent.com";
const linkClass = "font-medium text-ink underline underline-offset-4 hover:text-accent";

export function PrivacyPage() {
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    title.current?.focus({ preventScroll: true });
  }, []);

  return (
    <article aria-labelledby="privacy-title" className="animate-enter space-y-5">
      <div>
        <h1
          id="privacy-title"
          ref={title}
          tabIndex={-1}
          className="text-[32px] font-semibold tracking-[-.035em] sm:text-[42px]"
        >
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          RepLens is a capstone project operated by Nick-Lemy Kayiranga Niyigena.
          This policy explains what happens to your curl videos and results.
        </p>
      </div>

      <div className="surface-card divide-y divide-line px-5 sm:px-6">
        <section className="space-y-2 py-5">
          <h2 className="text-base font-semibold">Camera and uploads</h2>
          <p className="text-sm leading-6 text-muted">
            Live counting and recording happen in your browser. RepLens asks
            for camera permission and records without microphone audio. Your
            browser downloads pose-model files from Google and jsDelivr. Those
            downloads do not send your camera frames to either provider.
          </p>
          <p className="text-sm leading-6 text-muted">
            When you select Analyze set, your video is sent to the RepLens
            analysis server hosted on Microsoft Azure. The server removes audio
            before processing and deletes its temporary video file after the job
            finishes. Unsaved results are held in memory. The server clears
            finished jobs more than two hours old when it accepts another upload.
            Restarting the server also clears them.
          </p>
          <p className="text-sm leading-6 text-muted">
            RepLens measures wrist movement to estimate how many reps may remain.
            It withholds the estimate if the signal is too weak. The estimate
            does not determine whether another rep is safe.
          </p>
        </section>

        <section className="space-y-2 py-5">
          <h2 className="text-base font-semibold">Saved sets and accounts</h2>
          <p className="text-sm leading-6 text-muted">
            You can analyze and save a set without an account. Guest saves
            store the video and results in this browser. If you sign in, RepLens
            syncs the saved results and reviews to your account in Neon
            PostgreSQL. The saved video stays in the browser where you saved
            it. People who use the same browser profile can access guest saves.
          </p>
          <p className="text-sm leading-6 text-muted">
            To create an account, provide your name, email, and a password.
            RepLens stores a password hash and uses a sign-in cookie. Resend
            handles verification and password-reset email. Netlify hosts the
            web app. The hosting, database, or email services may process data
            outside Rwanda.
          </p>
        </section>

        <section className="space-y-2 py-5">
          <h2 className="text-base font-semibold">Delete saved sets</h2>
          <p className="text-sm leading-6 text-muted">
            Open History and delete a set to remove its saved result. When
            signed in, this also deletes the synced review from your account.
            RepLens attempts to remove the local video for that set. Clear
            RepLens site data in each browser where you saved the video to
            remove any remaining local copies. Use Sign out to end your
            account session.
          </p>
        </section>

        <section className="space-y-2 py-5">
          <h2 className="text-base font-semibold">Your choices and rights</h2>
          <p className="text-sm leading-6 text-muted">
            Recording, uploading, saving, and creating an account are optional.
            Upload only footage you have permission to share. Account details
            are kept while your account exists. To request account closure or
            to ask about accessing, correcting, restricting, or erasing your
            data, objecting to processing, or withdrawing consent where it
            applies, email{" "}
            <a className={linkClass} href={`mailto:${privacyEmail}`}>
              {privacyEmail}
            </a>
            . You can also contact the{" "}
            <a className={linkClass} href="https://dpo.gov.rw/">
              Rwanda Data Protection and Privacy Office
            </a>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
