# WebKit IndexedDB video persistence regression

Date: 2026-11-15 (Africa/Kigali)

Reproduction command:

```sh
cd app/frontend
pnpm test:e2e --project=webkit-mobile --grep='upload rejects'
```

Before the frontend change, fixture analysis results rendered, but saving the result failed in the iPhone 13 WebKit emulation. The screen showed “Device storage could not be updated.” and retained the “Save session” button. A direct IndexedDB diagnostic showed string storage succeeded while Blob and File storage returned `UnknownError: Error preparing Blob/File data to be stored in object store`.

The fallback now retries failed Blob writes using an ArrayBuffer record and restores a Blob when listing sessions or reading account videos. Existing Blob records remain readable. After the fix, the same browser journey saved the set, reopened it from History, and deleted it successfully.

Observed engine: Playwright WebKit 27.2, iPhone 13 viewport emulation. This is browser automation on a desktop host, not physical iPhone evidence. The failed-run screenshot and trace were not retained; Playwright cleared the configured output directory on the subsequent passing run. The failure text and regression command are recorded here.
