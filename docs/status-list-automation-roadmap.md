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

### Extension of step 3: existing option groups
- [x] Existing groups map their direct leaf options to server-derived outcomes.
- [x] Coordinator means the user assigned to this Mission contact (`assigned_to`),
  not the institution's representative or a collection coordinator. Support
  assigned/unassigned fallback plus explicit coordinator-to-option overrides.
- [x] Four reachability states: not defined, waiting for response, unreachable,
  reachable. An existing three-option group can explicitly add its waiting option
  in the source editor; no group or existing contact is converted automatically.
- [x] Configurable call/email/SMS channels, failed-attempt threshold, reply deadline,
  minimum connected talk time and successful-contact validity (zero = no expiry).
- [x] Exact Mission/contact evidence only. Sent/delivered messages await a reply;
  delivery/open receipts are never success. Bound incoming replies or sufficiently
  long connected calls establish success; a later failure does not erase it.
  Forwarded caller-channel answer alone is deliberately not accepted as proof.
- [x] Durable communication/assignment hints and timed recovery; transactional
  exclusive selection, database ownership guard, system audit and no-replay
  baseline/reconfiguration. Old communications without reliable attribution
  cannot be used as evidence.
- [x] Source configuration participates in cloning and version restoration;
  runtime state/transitions do not. All editor copy is localized in seven languages.

This extension does not enable controlled chaining or deploy to production.

Verification: `npx tsx scripts/status-list-option-source.test.ts` passed 63
assertions over real PostgreSQL, authorized HTTP handlers and native browser
configuration. This includes three-to-four-option upgrade, coordinator identity,
communication isolation, receipt/timeout semantics, concurrent transitions,
ownership guards, fresh clone IDs and version restore without replay. The prior
58 background and 167 workflow assertions, clone regressions and scoped
TypeScript check also passed; authenticated desktop/mobile screenshots inspected.

## 4. Controlled chaining
- [x] Explicit opt-in to run target automations; default remains write-only.
- [x] Detect loops/conflicts, preserve causation and execution order.

Rule-level opt-in applies only to changed nonempty answers/new confirmations.
Notes and removals never trigger downstream rules. Events run breadth-first in
the same contact transaction, with a stable rule order, source/target write
guards, exclusive-sibling rollback protection and bounded depth/executions.
Canonical answer-revision/confirmation identities prevent duplicate delivery.
Audit retains root event, parent run, depth and the original user/system actor.
The editor exposes explicit opt-in; history shows chained runs and blocked
conflicts. The dry-run explicitly previews one rule, not the downstream chain.
Existing rules remain write-only; no production activation or deployment.

## 5. Mission callback and status actions
- [ ] Offset, calendar/business days, fixed time, agent/Queue and replacement policy.
- [ ] Mission contact statuses and eligibility; no automatic voice dialing.

Incremental progress in the existing service-action mechanism:
- [x] Configurable working-day versus calendar-day offsets for standalone
  callbacks, callback dispositions and quick options; retain the legacy weekday
  default and explicit manual-date overrides.
- [x] Configurable fixed time for standalone callbacks as well as callback
  dispositions, including quick options, validation, saved summaries and agent
  prefill. Existing saved times are retained; missing times use 09:00.
- [x] Explicit policy to replace a pending callback or preserve its date/time,
  agent, note and source, including overdue/legacy pending callbacks. Decisions
  serialize with the write; preserving does not create a rescheduling event.
- [ ] Explicit agent/Queue targeting.

These editor increments do not migrate internal workflow rules to another
execution mechanism or activate new background side effects.

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
