# RepLens user acceptance protocol

This protocol is for a future consented acceptance session. It is not evidence that participants have been recruited or that the system is validated. Target at least 20 actual app testers, or record documented supervisor approval for a smaller cohort before making a smaller-cohort claim. Keep this app test separate from the earlier needs survey (30 responses, 28 eligible respondents); do not combine denominators.

## Before the session

- Recruit recreational lifters in the intended Kigali context and explain that uploaded-video RIR predictions are experimental and can be wrong.
- Obtain any institutionally required approval and informed consent before recording study data. Do not ask users to exercise to failure. Use a consented existing curl clip or an approved demonstration clip.
- Assign a random participant code. Store names, contact details and consent records separately with restricted access. Never put names, email addresses, private recordings or identifying notes in result artifacts.
- Record the app build/commit, date and time, device model, OS version, browser/version, viewport, network type/quality, clip code and task outcome. Keep source video outside the repository.
- Provide a clean account/device state or record existing state. Explain where the app saves account history and browser-local guest history.

## Tasks and observations

Ask participants to work without coaching unless a safety or privacy issue arises. For each task, record start/end time, whether completed unaided, completed after assistance, failed, or not attempted, and a short coded issue note.

1. Register with a test account, verify through the test-session email mechanism, and sign in.
2. Select and upload an approved clip; wait for asynchronous analysis and read the results page.
3. Explain in their own words what the RIR estimate and its uncertainty mean. Check that they distinguish a model estimate from the reviewed observed countback value and do not interpret it as medical or safety advice.
4. Open rep-level results and identify unavailable predictions or warnings without treating missing values as zero.
5. Save a session, find it in history, reopen it, and delete it. If the app supports both guest browser history and account history in the chosen build, record which one was used.
6. Request password recovery using a study account, complete any approved reset flow, sign out, and sign back in with the new password.
7. Report one confusing or useful part and one thing that prevented task completion.

Do not enter participant credentials or tokenized recovery links in the study dataset. Delete test accounts and stored sessions after the study, following the applicable retention plan.

## Feedback form and scoring

Create a form with participant code only, task outcomes/assistance, device/browser/network metadata, and two open-ended questions: “What was confusing or difficult?” and “What would you change first?” Keep the SUS items separate and use the original ten-item wording and five response choices from the [System Usability Scale source (John Brooke)](https://digital.ahrq.gov/sites/default/files/docs/survey/systemusabilityscale%2528sus%2529_comp%255B1%255D.pdf). Administer it immediately after the tasks and before discussion. If any item cannot be answered, use the center response as described in the source. Do not alter item wording and call it standard SUS; if translation or adaptation is required, label and report that adaptation.

For responses coded 1–5, score items 1, 3, 5, 7 and 9 as response minus 1. Score items 2, 4, 6, 8 and 10 as 5 minus response. Sum the ten contributions and multiply by 2.5 for the 0–100 SUS score. A score is not a percent and is not a model-accuracy measure. Keep item-level and participant-level data coded; report denominator, missing responses, median and spread, and avoid unsupported population generalization.

## Reporting

Report recruitment and completion counts, task denominators, unaided/assisted/failed outcomes, interruptions, device mix and relevant network limits. Separate observed user behavior from participant opinions. Remove identifying details from quotations or paraphrase into coded themes. State that physical-device observations and user acceptance do not validate model accuracy, RIR physiology, safety, or the video shaking feature.
