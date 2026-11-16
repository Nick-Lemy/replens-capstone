# How to read the research and engineering metrics

## Frozen model comparison

The persistent-transverse comparison uses the same 33 selected examples from four people for the speed-only and speed-plus-transverse models. The frozen bundles are `app/backend/assets/rir_speed_only.json` (`ridge_speed_only`) and `app/backend/assets/rir_model.json` (`ridge_speed_transverse`, version `persistent_tremor_20261101T105947439502Z`). The prediction rows are in `training/results/persistent_tremor_20261101T105947439502Z/predictions.csv`. The comparison CSV's `examples=8.25` is **not** a total sample count: it is the mean fold example count. The predictions CSV contains 33 matched rows per model. In the stored summary, MAE is the unweighted mean of the four per-participant MAEs, so each participant receives equal weight even though their row counts differ.

Recomputation from `training/results/persistent_tremor_20261101T105947439502Z/predictions.csv` gives participant-macro MAE of 2.2512 reps for speed only and 2.2215 reps for speed plus transverse shaking. The relative reduction is 1.32%, far below the historical 15% target. The 33 examples are unevenly distributed (12, 1, 13 and 7). With each row weighted equally instead, pooled MAE is 3.0173 versus 3.0656 reps, a small increase. That weighting sensitivity and the single-example participant mean these numbers should be described as exploratory, not as a robust or reliable improvement. The frozen fold results are reused exploratory evidence, not untouched confirmation data.

Among the ten matched examples with reviewed `reps_left <= 2`, participant-macro MAE is 2.80 reps for speed only and 3.18 for speed plus transverse shaking. This subgroup is small and exploratory. Do not claim that either model reliably identifies proximity to failure.

MAE in repetitions is average absolute difference between the model estimate and the retrospective reviewed RIR label. It is not “accuracy,” percent correct, a direct physiological fatigue measure, or a safety signal. A reviewed RIR after confirmed failure is a distinct observed value; voluntary stopping does not establish zero RIR. The model's wrist speed uses normalized image coordinates, not calibrated metres per second. The video-derived transverse feature is candidate shaking, not sensor-validated physiological tremor.

The validation script reproduces the frozen comparison without fitting: `python3 scripts/validate_research_artifacts.py`. Its machine-readable output is `training/results/validation_ml/persistent-tremor-recomputed.json`. It checks identical sample IDs, counts, participant IDs and the stored participant-macro MAEs, and reports pooled MAE separately.

## Engineering metrics

HTTP status counts, job durations, request latency percentiles and timeouts describe the specific local test workload and environment recorded alongside them. They do not establish a production service-level objective. An expected HTTP 429 job admission rejection is distinct from database-overload HTTP 503, a client timeout or another server error. Completed rep count and RIR availability have separate denominators; the current speed-only capacity clips had 6/9 and 7/18 available estimates, with eight clip-3 windows unavailable due to the tracking-gap gate. A partial-frame browser benchmark is not comparable to full uploaded-video processing.

Frontend display rounding can differ from raw stored predictions. This is display behavior, not a change in model error. Browser tests with fixture responses establish UI handling; they do not establish backend prediction accuracy. Simulated mobile viewports are not physical-device checks.

## User acceptance measures

Task completion counts use the number of participants who attempted each task as the denominator; report completion unaided, completion after help, failure and not attempted separately. Task time is descriptive and should state whether help or interruptions occurred. SUS yields a 0–100 composite scale score, not a percentage of users satisfied or percentage accuracy. Use its original ten-item wording and standard scoring, or clearly label any adapted wording as an adapted questionnaire rather than standard SUS. Summarize open-ended comments by coded theme without names or contact details. No user study results exist until collected.
