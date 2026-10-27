import type { ExampleChapters } from "./types";

export const en: ExampleChapters = {
  healthcareExamples: {
    title: "Examples: reachability transitions",
    paragraphs: [
      "Use these states both as conditions and action triggers. Distinguish the reachability change — for example, a successful call changes Unreachable to Reachable — from the automation response: send a notification, create a task or confirm another question.",
      "A rule cannot currently arbitrarily overwrite the system state with Reachable in THEN. Reachable must be supported by a call result. These are setup instructions, not enabled rules; reading help creates and sends nothing.",
      "Setup: Mission → Settings → Status List → Rules and actions → Provider reachability. Expand the shared configuration and choose Configure actions next to the answer. For a rule affecting another question, select this answer in WHEN and add conditions in IF. Required states must have Use enabled.",
    ],
    examples: [
      { title: "1. Unreachable → Reachable after a successful call", paragraphs: [
        "Situation: Five attempts failed. On the next attempt, the doctor or staff answers.",
        "State change: The call connects and meets the configured minimum talk time — 3 seconds by default. The system sets Reachable and resets the failed-attempt counter.",
        "WHEN: Reachable becomes active\nTHEN: send an internal notification\n“The contact is reachable again.”",
        "Configure the notification under Reachable → Configure actions. Alternatively, use this answer as the source of a rule confirming an ordinary question such as “Phone contact verified”.",
        "Caution: This reacts to entering Reachable generally, not exclusively from Unreachable.",
      ] },
      { title: "2. Wrong number → task → verified call", paragraphs: [
        "Situation: The number reaches the wrong person.",
        "PROCESS:\nOpen New task and choose Wrong phone\n↓ select the reason and an existing phone field supplied for this clinic or hospital\n↓ the task records the selected reason and reported number; it does not request a new number\n↓ make any correction on the healthcare record, then call the corrected number\n↓ in end-of-call disposition, confirm only after reaching the correct provider or staff",
        "Request verification is only a request; it does not change healthcare reachability by itself. The verification control appears only when the server links a matching call and number to the report/correction. That call must meet the configured minimum talk time. A technical answer alone is not confirmation.",
        "The verification request is tied to the current Mission, session, healthcare entity, issue and phone number. Do not confirm an old task after switching contacts.",
        "A number correction alone is not proof of a successful connection. A matching eligible call and the agent’s explicit confirmation are required before the system can mark the number verified.",
      ] },
      { title: "3. Five failed attempts → email", paragraphs: [
        "Keep the reachability threshold at 5. Add an email action under Unreachable → Configure actions.",
        "WHEN: Unreachable becomes active\nIF: Provider reachability = Unreachable\nAND: Failed attempts ≥ 5\nTHEN: email the designated recipient",
        "Choose the recipient, subject, content and automatic execution or review before execution.",
        "The email is not sent on every card opening. The relevant state transition triggers it; this does not mean repeating the email on every subsequent failed attempt.",
      ] },
      { title: "4. Not working → report the selected phone", paragraphs: [
        "Open New task, choose Wrong phone, select “Number is not working” and choose the existing phone field that needs review.",
        "The task records the selected number and reason. It does not silently change reachability or add a replacement number; update the healthcare record through the normal correction process.",
        "After a correction, a matching call that meets the minimum talk time can be reviewed in end-of-call disposition. The agent must explicitly confirm the correct provider or staff; technical answered status is not enough.",
      ] },
      { title: "5. Reachability as an ordinary question condition", paragraphs: [
        "The seven states need not be the direct trigger. For example:",
        "WHEN: the agent confirms “Continue phone outreach”\nIF: Provider reachability = Reachable\nTHEN: confirm the next step “Phone contact verified”",
        "Or restrict an individual action:\nExecute only if state = Unreachable\nAND failed attempts ≥ 5.",
        "Confirming another question does not necessarily run its actions. Explicitly enable target automations if needed, and check for loops and duplicate effects.",
      ] },
      { title: "Current boundaries", paragraphs: [
        "You can configure “when it enters Reachable” and “current state is Reachable”. The editor does not yet offer the exact filter “previous state was Wrong number and new state is Reachable”.",
        "Reachable remains sticky after a later failed attempt; the failure is recorded separately. An ordinary failure therefore does not automatically move Reachable back to Unreachable.",
        "State and counter come from one configuration for the relevant Mission and contact. Missing or ambiguous sources, paused evaluation and disallowed results must not be treated as satisfied conditions.",
      ] },
    ],
  },
  previousAutomationExamples: {
    title: "Examples: other automations",
    paragraphs: [
      "These examples expand on previously prepared options. A question name, description or SYS label does not execute anything by itself; check the actual action and parameters.",
      "Choose automatic execution or review and confirmation per action. Hiding the source question does not disable evaluation. The first observation of an existing system state is a baseline, not a request to replay all actions. Respect Status List saving in Batch mode.",
    ],
    examples: [
      { title: "1. Unreached → callback in six business days", paragraphs: [
        "Situation: An attempt failed, the Unreachable threshold has not been met and the contact does not already retain Reachable.",
        "WHEN: a new failed attempt activates Unreached\nTHEN: schedule a callback in 6 business days at 09:00",
        "Open the callback action under Unreached → Configure actions. Check the 6-day offset, business days, 09:00 and existing-callback policy. The default created action keeps an existing callback; it does not automatically move every agreed appointment.",
        "The coordinator can change the time in Queue. Reopening the card must not create another callback.",
      ] },
      { title: "2. Connected voicemail → correction to Unreached", paragraphs: [
        "Situation: The call connected technically, but voicemail answered instead of the doctor or staff.",
        "PROCESS: open Review state\nMARK: the last connected call as voicemail\nSAVE: the review",
        "That call is no longer Reachable evidence. Without another successful call and below the threshold, the result is Unreached; at the threshold it may be Unreachable. Follow-up actions use the actual resulting state.",
        "The marking belongs to the specific latest call. It is not a rule that every short call is voicemail.",
      ] },
      { title: "3. Long-term absent → internal notification", paragraphs: [
        "Situation: The coordinator verifies a prolonged absence and saves Long-term absent through Review state.",
        "WHEN: Long-term absent becomes active\nTHEN: notify a designated user or group\n“Review the next steps during the prolonged absence.”",
        "Configure the recipient and message on this answer. Long-term absence leaves the failed-attempt counter unchanged.",
        "This state has no automatic time limit. Writing “call again in a month” does not schedule a callback; configure a separate supported action.",
      ] },
      { title: "4. Communication history → condition before another action", paragraphs: [
        "Situation: When an ordinary question is confirmed, take into account whether an email has already been recorded as sent in this Mission.",
        "WHEN: the agent confirms the relevant question\nIF: communication history — email sent = yes\nTHEN: confirm the ordinary step “Email already sent”",
        "In IF, select the relevant history field, not a text note or phone number. To chain another action, configure it on the target step and explicitly allow the rule to run it.",
        "Email sent does not prove delivery or a reply. This condition is not an “X days without reply” timer and does not itself identify a particular template or message content.",
      ] },
    ],
  },
};
