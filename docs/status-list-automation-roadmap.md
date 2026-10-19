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
- [ ] Replace/append/clear notes, clear answers, multi-select add/remove.
- [ ] Explicit step confirmation/unconfirmation, separate from note editing.

## 3. Hidden/system questions
- [ ] Map source data to answers; begin with representative assignment.
- [ ] Evaluate server-side without an open card or logged-in agent.
- [ ] Event-driven changes, timed checks and bounded recovery scans.
- [ ] Track answer transitions separately from side effects.
- [ ] Initial baseline without replaying historical actions.

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
