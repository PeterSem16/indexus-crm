# Mission Status List automation — approved implementation sequence

Keep the shared Automation WHEN / IF / THEN / ELSE editing direction, but execute
inside the exact Mission and campaign-contact scope. Do not expose Mission-only
actions in the standalone Automation engine.

## 1. First complete rule
- [x] Shared compact editor and persisted create/edit/enable/disable/delete.
- [x] Agent confirms a step/option or answers a question.
- [x] Conditions select THEN or ELSE.
- [x] Set another answer in this Mission: only-if-empty or replace (including occupied exclusive groups).
- [x] Server-side execution, atomic audit, duplicate-request protection.
- [x] Persist and display answers; retain existing automations without double execution.
- [x] Verify real authenticated flow, persistence, permissions and replay safety.

Verification: `npx tsx scripts/status-list-workflow.test.ts` passed 77 assertions,
including real PostgreSQL persistence, HTTP handlers and native browser create/save.
Existing clone-campaign, Status List note and task-routing regressions also passed.
New rule configuration participates in Mission cloning and version snapshots;
answers and execution history are operational data and are not cloned.

## 2. Notes and further internal actions
- [x] Replace/append/clear notes, clear answers, multi-select add/remove.
- [x] Explicit step confirmation/unconfirmation, separate from note editing.

Notes also work before confirmation and survive its removal and re-confirmation.
The existing note editor stays synchronized. Multiple-choice actions change one
option only and reject exclusive groups. Note and answer actions may target the
same step independently; competing writes to the same facet are rejected.
All writes remain Mission/contact-scoped and write-only (no chaining).

Verification: `npx tsx scripts/status-list-workflow.test.ts` passed 167 assertions
over real PostgreSQL/API/authenticated browser flows. The three redesign browser
scenarios, strict action/clone-reference tests, existing note tests, scoped type
check and clone-campaign regressions also passed.

## 3. Hidden/system questions
- [x] Map source data to answers; begin with representative assignment.
- [x] Evaluate server-side without an open card or logged-in agent.
- [x] Event-driven changes, timed checks and bounded recovery scans.
- [x] Track answer transitions separately from side effects.
- [x] Initial baseline without replaying historical actions.

Configure an existing yes/no question for representative presence or a text
question for assignment type. Clinic/hospital temporal assignment history is the
source of truth; unsupported/missing entities stay unknown, never false.
Visibility remains independent from system ownership. Exclusive groups and
incompatible question types are rejected, and agents/workflows cannot overwrite
derived answers. Conditions use a coherent source snapshot; effects remain
write-only, with an explicit non-human audit principal.

Database change hints include assignments, enrollment and source configuration.
A single-leader worker processes bounded pages every five seconds; rotating
recovery pages (50 contacts per 30 seconds) cover downtime and time boundaries.
Baseline creation and re-enabling never replay historical actions. Cloning and
versions contain source configuration, not source generations or operational
answers/transitions/runs.

Verification: `npx tsx scripts/status-list-background.test.ts` passed 58 real
PostgreSQL/API/authenticated-browser assertions, including missing-hint recovery,
temporal activation, concurrency, ownership, country scope, clone and snapshot
parity. Existing 167 workflow assertions, internal-action/note unit tests,
clone-campaign regressions, five editor browser scenarios and scoped TypeScript
verification passed. Native desktop/mobile screenshots were inspected.

## 4. Controlled chaining
- [ ] Explicit opt-in to run target automations; default remains write-only.
- [ ] Detect loops/conflicts, preserve causation and execution order.

## 5. Mission callback and status actions
- [ ] Offset, calendar/business days, fixed time, agent/Queue and replacement policy.
- [ ] Mission contact statuses and eligibility; no automatic voice dialing.

## 6. Shared action services
- [ ] Task/Back Office, notification, email, SMS, then remaining suitable services.
- [ ] Reuse editors, validation and services, with Mission-specific authorization.

## Constraints applying from step 1
- Hidden visibility, answer ownership and trigger mode are independent.
- A note edit is not a confirmation; unchanged values are not new transitions.
- Derived answers must not be overwritten against their source of truth.
- Never guess an agent/sender when a background trigger has none.
- Keep old rules active until reviewed replacement, never run both for one action.
- Cloning/version restore must preserve rule references without copying run history.
- No production deployment or broad push of unfinished work.
