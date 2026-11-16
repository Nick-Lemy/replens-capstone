# RepLens testing assignments

The work follows the eleven expectations extracted from the meeting with multiple supervisors. Baseline main is 8a74834184d842ef47df11459f02c1192a0f21c3. Work is in the persistent `replens-validation` worktree on `feat/defense-validation-suite`. The former temporary validation worktree is absent. Earlier validation counts are historical until reproduced.

## Agent 1 — Authentication, security and persistence

Verify account creation, verification, sign-in, recovery, password change, token expiry/reuse/revocation and saved-session ownership through real API routes and disposable PostgreSQL. Mock external email. Reproduce and fix critical defects, retain expected/actual outcomes and retest. Own auth/session modules and their tests. Report in `auth-security-results.md`.

## Agent 2 — Jobs, failure diagnosis and capacity

Test admission limits, cancellation, worker errors, cleanup and queue consistency. Reproduce the previously observed authenticated-read overload, investigate root cause and repeat the same workload after justified fixes. Measure bounded real-video workloads and API responsiveness. Own job lifecycle modules and capacity scripts. Report in `capacity-results.md`, with raw records under `training/results/validation_capacity/`.

## Agent 3 — Browser workflows and resilience

Automate supported product workflows using Playwright plus focused frontend tests. Cover upload/results/history/account paths, slow/failing requests, unavailable predictions, cancellation, stale responses and recovery. Use desktop/mobile viewport configurations, record the actual browser engines executed, distinguish fixture-driven UI checks from live-backend journeys and physical devices. Own frontend code, browser tests and frontend test configuration. Report in `browser-results.md`.

## Agent 4 — ML audit, independent checks and evidence

Audit labels, feature scaling/order, inference gates, participant separation and saved metrics with tests. Review critical assumptions and test gaps across the other agents' work, documenting the same-model peer-review limitation. Integrate CI and measurement evidence, requirements traceability, metric explanations and before/after records. Prepare actual-user task sheets and questionnaire/scoring guidance. Own ML tests/scripts, CI and consolidated documentation. Report in `evaluation-summary.md`.

## Coverage of meeting expectations

| Expectation | Lead | Supporting work |
| --- | --- | --- |
| Critical functionality and security | Agent 1 | Agent 3 browser journeys |
| Presented features work as described | Agent 3 | Agents 1 and 2 API behavior |
| Explicit pass/fail criteria | Each agent | Agent 4 consolidates |
| Failure-cause investigation | Agent 2 | Agent 3 network/UI behavior |
| Findings lead to fixes and retests | Each agent | Agent 4 before/after evidence |
| User experience evaluation | Agent 3 automation | User conducts actual acceptance study |
| Independent checking | Agent 4 peer checks | User/external or different-model review remains separately identified |
| Explain practical meaning of metrics | Agent 4 | Agent 2 performance context |
| Report unsuccessful findings | Each agent | Agent 4 consolidates |
| Clear charts, counts, screenshots and logs | Each agent | Agent 4 indexes evidence |
| Dedicated testing narrative | Agent 4 | User reviews report wording |

## User participation

Conduct consented acceptance tasks with real target users and physical devices. The report template requests at least twenty app testers or documented supervisor approval for a smaller cohort. Keep recruitment and contact evidence privately, publish coded observations and aggregates. Confirm recruitment context and final needs-survey snapshot. Review screenshots and explain decisions in the defense. Prepare the final report with the measured findings, including unresolved results.

## Execution rules

Two subagents run at once because this session has three total active-agent slots including the parent. Agents 1 and 2 form the first wave; agents 3 and 4 form the second. Use isolated local test settings, bounded workloads and actual observed results. Preserve the root checkout's uncommitted streaming experiment. All four agents use GPT-6 Luna with medium reasoning, as requested. Their peer checks must not be described as validation by a different model. Nothing is pushed, merged or deployed without the user's instruction.
