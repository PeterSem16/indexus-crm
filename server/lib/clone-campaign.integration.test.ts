import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import {
  campaigns,
  campaignAgents,
  campaignSchedules,
  campaignOperatorSettings,
  campaignDispositions,
  campaignStatusAssignments,
  campaignPhases,
  campaignStatusListItems,
  campaignStatusListQuestions,
  campaignStatusListAutomations,
  sopCampaignArticles,
  campaignMailchimpSync,
  campaignContacts,
  campaignContactHistory,
  campaignContactSessions,
  campaignContactPhases,
  campaignContactStatusListState,
  callLogs,
  nexusPulseModuleRevisions,
} from "@shared/schema";
import { createIsolatedCloneDatabase, type IsolatedCloneDatabase } from "./clone-campaign.pg-test-helper";

const SOURCE_CAMPAIGN_ID = "source-campaign";
const SOURCE_CONTACT_ID = "source-contact";
const CREATOR_ID = "clone-creator";

const scriptFixture = {
  version: 1,
  name: "Integration script",
  description: "A complete persisted script",
  startStepId: "script-step-1",
  steps: [
    {
      id: "script-step-1",
      title: "Qualification",
      description: "First step",
      nextStepId: "script-step-2",
      elements: [
        {
          id: "script-element-1",
          type: "radio" as const,
          label: "Interested?",
          options: [
            { value: "yes", label: "Yes", nextStepId: "script-step-2" },
            { value: "no", label: "No", nextStepId: "script-step-2" },
          ],
        },
      ],
    },
    {
      id: "script-step-2",
      title: "Finish",
      elements: [
        {
          id: "script-element-2",
          type: "note" as const,
          content: "Record the outcome",
        },
      ],
      isEndStep: true,
    },
  ],
};

const sourceIds = {
  rootDisposition: "source-disposition-root",
  childDisposition: "source-disposition-child",
  firstPhase: "source-phase-first",
  secondPhase: "source-phase-second",
  rootItem: "source-item-root",
  childItem: "source-item-child",
  firstQuestion: "source-question-first",
  secondQuestion: "source-question-second",
};

type Row = Record<string, any>;

function omit(row: Row, ...keys: string[]): Row {
  const result = { ...row };
  for (const key of keys) delete result[key];
  return result;
}

function replaceReferences(value: unknown, references: Map<string, string>): unknown {
  if (typeof value === "string") return references.get(value) ?? value;
  if (Array.isArray(value)) return value.map(item => replaceReferences(item, references));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceReferences(item, references)]),
    );
  }
  return value;
}

function sortRows(rows: Row[], key: string): Row[] {
  return [...rows].sort((left, right) => String(left[key]).localeCompare(String(right[key])));
}

function parseScript(value: unknown): Row {
  return (typeof value === "string" ? JSON.parse(value) : value) as Row;
}

function normalizeScript(value: unknown): Row {
  const script = parseScript(value);
  const stepReferences = new Map<string, string>();
  const elementReferences = new Map<string, string>();
  for (const [stepIndex, step] of (script.steps as Row[]).entries()) {
    stepReferences.set(step.id, `step:${stepIndex}`);
    for (const [elementIndex, element] of (step.elements as Row[]).entries()) {
      elementReferences.set(element.id, `element:${stepIndex}:${elementIndex}`);
    }
  }
  const remapStep = (id: unknown) => typeof id === "string" ? stepReferences.get(id) ?? id : id;
  return {
    ...script,
    startStepId: remapStep(script.startStepId),
    steps: (script.steps as Row[]).map((step, stepIndex) => ({
      ...step,
      id: `step:${stepIndex}`,
      nextStepId: remapStep(step.nextStepId),
      elements: (step.elements as Row[]).map((element, elementIndex) => ({
        ...element,
        id: `element:${stepIndex}:${elementIndex}`,
        jumpTargetStepId: remapStep(element.jumpTargetStepId),
        options: element.options?.map((option: Row) => ({
          ...option,
          nextStepId: remapStep(option.nextStepId),
        })),
      })),
    })),
  };
}

async function rowsForCampaign(database: IsolatedCloneDatabase["db"], campaignId: string) {
  const [
    campaign,
    agents,
    schedule,
    operators,
    dispositions,
    statusAssignments,
    phases,
    items,
    questions,
    automations,
    sopArticles,
    mailchimp,
    contacts,
    contactHistory,
    contactSessions,
    contactPhases,
    statusListState,
    callLogRows,
    revisions,
  ] = await Promise.all([
    database.select().from(campaigns).where(eq(campaigns.id, campaignId)),
    database.select().from(campaignAgents).where(eq(campaignAgents.campaignId, campaignId)),
    database.select().from(campaignSchedules).where(eq(campaignSchedules.campaignId, campaignId)),
    database.select().from(campaignOperatorSettings).where(eq(campaignOperatorSettings.campaignId, campaignId)),
    database.select().from(campaignDispositions).where(eq(campaignDispositions.campaignId, campaignId)),
    database.select().from(campaignStatusAssignments).where(eq(campaignStatusAssignments.campaignId, campaignId)),
    database.select().from(campaignPhases).where(eq(campaignPhases.campaignId, campaignId)),
    database.select().from(campaignStatusListItems).where(eq(campaignStatusListItems.campaignId, campaignId)),
    database.select().from(campaignStatusListQuestions),
    database.select().from(campaignStatusListAutomations),
    database.select().from(sopCampaignArticles).where(eq(sopCampaignArticles.campaignId, campaignId)),
    database.select().from(campaignMailchimpSync).where(eq(campaignMailchimpSync.campaignId, campaignId)),
    database.select().from(campaignContacts).where(eq(campaignContacts.campaignId, campaignId)),
    database.select().from(campaignContactHistory),
    database.select().from(campaignContactSessions),
    database.select().from(campaignContactPhases).where(eq(campaignContactPhases.campaignId, campaignId)),
    database.select().from(campaignContactStatusListState),
    database.select().from(callLogs).where(eq(callLogs.campaignId, campaignId)),
    database.select().from(nexusPulseModuleRevisions).where(eq(nexusPulseModuleRevisions.campaignId, campaignId)),
  ]);
  const itemIds = new Set(items.map(row => row.id));
  const contactIds = new Set(contacts.map(row => row.id));
  return {
    campaign,
    agents,
    schedule,
    operators,
    dispositions,
    statusAssignments,
    phases,
    items,
    questions: questions.filter(row => itemIds.has(row.itemId)),
    automations: automations.filter(row => itemIds.has(row.statusListItemId)),
    sopArticles,
    mailchimp,
    contacts,
    contactHistory: contactHistory.filter(row => contactIds.has(row.campaignContactId)),
    contactSessions: contactSessions.filter(row => contactIds.has(row.campaignContactId)),
    contactPhases,
    statusListState: statusListState.filter(row => contactIds.has(row.campaignContactId)),
    callLogs: callLogRows,
    revisions,
  };
}

async function seedFixture(database: IsolatedCloneDatabase["db"]) {
  await database.insert(campaigns).values({
    id: SOURCE_CAMPAIGN_ID,
    name: "Fully populated source",
    description: "Source description",
    type: "sales",
    channel: "mixed",
    status: "active",
    countryCodes: ["SK", "CZ"],
    criteria: JSON.stringify({ country: ["SK", "CZ"], minimumAge: 18 }),
    settings: JSON.stringify({ timezone: "Europe/Bratislava", retry: 4 }),
    script: JSON.stringify(scriptFixture),
    defaultActiveTab: "script",
    callerIdNumber: "+421200000001",
    startDate: new Date("2026-01-10T08:00:00.000Z"),
    endDate: new Date("2026-03-10T17:00:00.000Z"),
    targetContactCount: 42,
    conversionGoal: "12.34",
    createdBy: "source-owner",
  });

  await database.insert(campaignAgents).values({
    id: "source-agent",
    campaignId: SOURCE_CAMPAIGN_ID,
    userId: "operator-1",
    role: "supervisor",
    assignedBy: "source-owner",
  });
  await database.insert(campaignSchedules).values({
    id: "source-schedule",
    campaignId: SOURCE_CAMPAIGN_ID,
    workingDays: ["monday", "wednesday", "friday"],
    workingHoursStart: "08:15",
    workingHoursEnd: "16:45",
    maxAttemptsPerContact: 7,
    minHoursBetweenAttempts: 11,
    autoAssignContacts: false,
    prioritizeCallbacks: true,
  });
  await database.insert(campaignOperatorSettings).values({
    id: "source-operator-settings",
    campaignId: SOURCE_CAMPAIGN_ID,
    userId: "operator-1",
    isActive: false,
    workloadWeight: 73,
    maxContactsPerDay: 31,
    dailyCallQuota: 17,
    dailyEmailQuota: 13,
    dailySmsQuota: 9,
    assignedCountries: ["SK", "CZ"],
  });
  await database.insert(campaignStatusAssignments).values({
    id: "source-status-assignment",
    campaignId: SOURCE_CAMPAIGN_ID,
    statusDefinitionId: "status-definition-1",
    isActive: false,
    sortOrder: 8,
  });

  await database.insert(campaignDispositions).values([
    {
      id: sourceIds.rootDisposition,
      campaignId: SOURCE_CAMPAIGN_ID,
      parentId: null,
      name: "Interested",
      code: "INTERESTED",
      channel: "phone",
      icon: "thumb-up",
      color: "#16a34a",
      actionType: "callback",
      callbackOffsetDays: 5,
      childrenType: "checklist",
      requiresNote: true,
      requiresCallback: true,
      isFinal: false,
      isConversion: true,
      isDefault: true,
      isActive: true,
      sortOrder: 1,
    },
    {
      id: sourceIds.childDisposition,
      campaignId: SOURCE_CAMPAIGN_ID,
      parentId: sourceIds.rootDisposition,
      name: "Send offer",
      code: "SEND_OFFER",
      channel: "email",
      icon: "mail",
      color: "#2563eb",
      actionType: "send_email",
      callbackOffsetDays: null,
      childrenType: "radio",
      requiresNote: false,
      requiresCallback: false,
      isFinal: true,
      isConversion: false,
      isDefault: false,
      isActive: false,
      sortOrder: 2,
    },
  ]);

  await database.insert(campaignPhases).values([
    {
      id: sourceIds.firstPhase,
      campaignId: SOURCE_CAMPAIGN_ID,
      phaseNumber: 1,
      name: "Call phase",
      type: "phone",
      status: "active",
      scheduledStartAt: new Date("2026-01-12T09:00:00.000Z"),
      evaluationAt: new Date("2026-01-18T12:00:00.000Z"),
      completedAt: null,
      mailchimpCampaignId: "remote-source-call",
      transitionRules: {
        when: "conversion",
        dispositionId: sourceIds.childDisposition,
        nextPhaseId: sourceIds.secondPhase,
      },
      transitionMode: "automatic",
      autoTransitionSchedule: "daily",
      lastAutoTransitionAt: new Date("2026-01-17T12:00:00.000Z"),
      targetCalls: 80,
      targetEmails: 25,
      targetConversions: 9,
      targetResponseRate: 31,
    },
    {
      id: sourceIds.secondPhase,
      campaignId: SOURCE_CAMPAIGN_ID,
      phaseNumber: 2,
      name: "Email phase",
      type: "email",
      status: "completed",
      scheduledStartAt: new Date("2026-01-20T09:00:00.000Z"),
      evaluationAt: new Date("2026-01-27T12:00:00.000Z"),
      completedAt: new Date("2026-01-28T12:00:00.000Z"),
      mailchimpCampaignId: "remote-source-email",
      transitionRules: { when: "always", nextPhaseId: null },
      transitionMode: "ai_assisted",
      autoTransitionSchedule: "weekly",
      lastAutoTransitionAt: new Date("2026-01-27T12:00:00.000Z"),
      targetCalls: 12,
      targetEmails: 90,
      targetConversions: 15,
      targetResponseRate: 44,
    },
  ]);

  await database.insert(campaignStatusListItems).values([
    {
      id: sourceIds.rootItem,
      campaignId: SOURCE_CAMPAIGN_ID,
      stepId: "step-root",
      label: "Confirm contact",
      description: "Confirm the main contact",
      sortOrder: 1,
      required: true,
      parentId: null,
      confirmationType: "checkbox",
      nextStepId: sourceIds.childItem,
      restrictions: JSON.stringify({ country: ["SK"] }),
      isHidden: false,
      itemType: "step",
      color: "#f59e0b",
      autoConfirmOnSubQuestion: false,
      questionSelectionMode: "multiple",
      tab: "acquisition",
      canonicalClinicStatusKey: "acquisition_contacted",
    },
    {
      id: sourceIds.childItem,
      campaignId: SOURCE_CAMPAIGN_ID,
      stepId: "step-child",
      label: "Choose outcome",
      description: "Select the outcome",
      sortOrder: 2,
      required: false,
      parentId: sourceIds.rootItem,
      confirmationType: "radio",
      nextStepId: null,
      restrictions: "manager-only",
      isHidden: true,
      itemType: "question",
      color: "#9333ea",
      autoConfirmOnSubQuestion: true,
      questionSelectionMode: "single",
      tab: "retention",
      canonicalClinicStatusKey: "retention_active",
    },
  ]);

  await database.insert(campaignStatusListQuestions).values([
    {
      id: sourceIds.firstQuestion,
      itemId: sourceIds.rootItem,
      groupName: "Qualification",
      questionText: "Was a decision maker reached?",
      sortOrder: 1,
      logicOperator: "AND",
      gotoQuestionId: sourceIds.secondQuestion,
      required: true,
      icon: "user-check",
      color: "#0ea5e9",
      description: "Record whether the decision maker answered",
      isHidden: false,
      fieldType: "radio",
    },
    {
      id: sourceIds.secondQuestion,
      itemId: sourceIds.rootItem,
      groupName: "Qualification",
      questionText: "Should an offer be sent?",
      sortOrder: 2,
      logicOperator: "OR",
      gotoQuestionId: null,
      required: false,
      icon: "send",
      color: "#22c55e",
      description: "Offer follow-up",
      isHidden: true,
      fieldType: "checkbox",
    },
  ]);

  await database.insert(campaignStatusListAutomations).values({
    id: "source-automation",
    statusListItemId: sourceIds.childItem,
    questionId: sourceIds.secondQuestion,
    sortOrder: 3,
    actionType: "send_email",
    targetRole: "role:coordinator",
    emailTemplateId: "email-template-1",
    emailRecipients: ["coordinator@example.invalid", "manager@example.invalid"],
    smsTemplateId: "sms-template-1",
    smsProvider: "bulkgate",
    callbackOffsetDays: 4,
    callbackTime: "10:30",
    notifyAgentPulse: true,
    taskDescription: "Prepare an offer",
    taskDeadlineOffset: "2d",
    taskPriority: "high",
    conditionField: "decision",
    conditionOperator: "equals",
    conditionValue: "yes",
    conditionJson: JSON.stringify({ field: "decision", value: "yes" }),
    dispositionId: sourceIds.childDisposition,
    webhookTarget: "https://example.invalid/status-hook",
    taskGroupId: "task-group-1",
    assignNotify: true,
    assignNotifyChannels: ["email", "sms"],
  });

  await database.insert(sopCampaignArticles).values({
    id: "source-sop-link",
    articleId: "sop-article-1",
    campaignId: SOURCE_CAMPAIGN_ID,
  });
  await database.insert(campaignMailchimpSync).values({
    id: "source-mailchimp-sync",
    campaignId: SOURCE_CAMPAIGN_ID,
    mailchimpCampaignId: "remote-mailchimp-campaign",
    mailchimpListId: "audience-123",
    status: "sent",
    lastSyncAt: new Date("2026-01-15T15:00:00.000Z"),
    syncedContacts: 27,
    errorMessage: "previous warning retained on source",
    webhookUrl: "https://example.invalid/mailchimp-hook",
    webhookRegistered: true,
    selectedTags: ["prospect", "sk"],
    selectedSegmentId: "segment-789",
  });

  await database.insert(campaignContacts).values({
    id: SOURCE_CONTACT_ID,
    campaignId: SOURCE_CAMPAIGN_ID,
    customerId: "customer-1",
    contactType: "customer",
    status: "completed",
    assignedTo: "operator-1",
    notes: "Operational row that must not be cloned",
    attemptCount: 4,
    priorityScore: 91,
    completedAt: new Date("2026-01-25T12:00:00.000Z"),
  });
  await database.insert(campaignContactHistory).values({
    id: "source-contact-history",
    campaignContactId: SOURCE_CONTACT_ID,
    userId: "operator-1",
    action: "status_change",
    previousStatus: "contacted",
    newStatus: "completed",
    notes: "Operational history that must not be cloned",
    metadata: { reason: "converted" },
  });
  await database.insert(campaignContactSessions).values({
    id: "source-contact-session",
    campaignContactId: SOURCE_CONTACT_ID,
    userId: "operator-1",
    startedAt: new Date("2026-01-25T11:30:00.000Z"),
    endedAt: new Date("2026-01-25T11:45:00.000Z"),
    durationSeconds: 900,
    outcome: "answered",
    notes: "Operational session that must not be cloned",
    callbackScheduled: false,
  });
  await database.insert(campaignContactPhases).values({
    id: "source-contact-phase-completion",
    campaignId: SOURCE_CAMPAIGN_ID,
    contactId: SOURCE_CONTACT_ID,
    phaseId: sourceIds.firstPhase,
    status: "completed",
    result: "converted",
    phoneResult: { connected: true },
    emailResult: null,
    enteredAt: new Date("2026-01-12T09:00:00.000Z"),
    completedAt: new Date("2026-01-25T12:00:00.000Z"),
  });
  // These rows are the contact's actual completed status-list state (including
  // the persisted question answer note), not reusable campaign configuration.
  await database.insert(campaignContactStatusListState).values([
    {
      id: "source-status-state-root",
      campaignContactId: SOURCE_CONTACT_ID,
      statusListItemId: sourceIds.rootItem,
      confirmedAt: new Date("2026-01-25T11:50:00.000Z"),
      confirmedByUserId: "operator-1",
      createdAt: new Date("2026-01-25T11:50:00.000Z"),
      itemNote: "Decision maker reached: yes",
      noteUpdatedAt: new Date("2026-01-25T11:51:00.000Z"),
    },
    {
      id: "source-status-state-child",
      campaignContactId: SOURCE_CONTACT_ID,
      statusListItemId: sourceIds.childItem,
      confirmedAt: new Date("2026-01-25T11:55:00.000Z"),
      confirmedByUserId: "operator-1",
      createdAt: new Date("2026-01-25T11:55:00.000Z"),
      itemNote: "Offer requested: yes",
      noteUpdatedAt: new Date("2026-01-25T11:56:00.000Z"),
    },
  ]);
  await database.insert(callLogs).values({
    id: "source-call-log",
    userId: "operator-1",
    customerId: "customer-1",
    campaignId: SOURCE_CAMPAIGN_ID,
    campaignContactId: SOURCE_CONTACT_ID,
    phoneNumber: "+421900000001",
    direction: "outbound",
    status: "completed",
    startedAt: new Date("2026-01-25T11:30:00.000Z"),
    answeredAt: new Date("2026-01-25T11:31:00.000Z"),
    endedAt: new Date("2026-01-25T11:45:00.000Z"),
    durationSeconds: 840,
    hungUpBy: "user",
    sipCallId: "sip-source-call",
    notes: "Operational call log that must not be cloned",
    metadata: JSON.stringify({ completion: "yes" }),
    inboundQueueId: null,
    inboundQueueName: null,
    inboundCallLogId: null,
    isImportant: true,
    isForwarded: false,
    forwardedToNumber: null,
  });
  await database.insert(nexusPulseModuleRevisions).values({
    id: "source-module-revision",
    campaignId: SOURCE_CAMPAIGN_ID,
    versionNumber: 7,
    status: "active",
    snapshot: { version: 7, source: "operational revision" },
    changes: [{ field: "description", from: "old", to: "new" }],
    contentHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    changeNote: "Operational revision that must not be cloned",
    createdBy: "source-owner",
  });
}

function normalizeDispositions(rows: Row[]): Row[] {
  const codeById = new Map(rows.map(row => [row.id, row.code]));
  return sortRows(rows, "code").map(row => ({
    ...omit(row, "id", "campaignId", "parentId", "createdAt", "updatedAt"),
    parentCode: row.parentId ? codeById.get(row.parentId) : null,
  }));
}

function normalizePhases(rows: Row[], dispositions: Row[]): Row[] {
  const references = new Map<string, string>();
  for (const row of dispositions) references.set(row.id, `disposition:${row.code}`);
  for (const row of rows) references.set(row.id, `phase:${row.phaseNumber}:${row.name}`);
  return sortRows(rows, "phaseNumber").map(row => ({
    ...omit(
      row,
      "id",
      "campaignId",
      "status",
      "completedAt",
      "mailchimpCampaignId",
      "lastAutoTransitionAt",
      "createdAt",
      "updatedAt",
    ),
    transitionRules: replaceReferences(row.transitionRules, references),
  }));
}

function normalizeItems(rows: Row[]): Row[] {
  const references = new Map(rows.map(row => [row.id, `item:${row.stepId}`]));
  return sortRows(rows, "stepId").map(row => ({
    ...omit(row, "id", "campaignId", "parentId", "nextStepId", "createdAt", "updatedAt"),
    parentRef: row.parentId ? references.get(row.parentId) : null,
    nextRef: row.nextStepId ? references.get(row.nextStepId) : null,
  }));
}

function normalizeQuestions(rows: Row[], items: Row[]): Row[] {
  const itemReferences = new Map(items.map(row => [row.id, `item:${row.stepId}`]));
  const questionReferences = new Map(rows.map(row => [row.id, `question:${row.sortOrder}:${row.questionText}`]));
  return sortRows(rows, "sortOrder").map(row => ({
    ...omit(row, "id", "itemId", "gotoQuestionId", "createdAt", "updatedAt"),
    itemRef: itemReferences.get(row.itemId),
    gotoRef: row.gotoQuestionId ? questionReferences.get(row.gotoQuestionId) : null,
  }));
}

function normalizeAutomations(rows: Row[], items: Row[], questions: Row[], dispositions: Row[]): Row[] {
  const references = new Map<string, string>();
  for (const row of items) references.set(row.id, `item:${row.stepId}`);
  for (const row of questions) references.set(row.id, `question:${row.sortOrder}:${row.questionText}`);
  for (const row of dispositions) references.set(row.id, `disposition:${row.code}`);
  return sortRows(rows, "sortOrder").map(row => ({
    ...omit(row, "id", "statusListItemId", "questionId", "dispositionId", "createdAt", "updatedAt"),
    itemRef: references.get(row.statusListItemId),
    questionRef: row.questionId ? references.get(row.questionId) : null,
    dispositionRef: row.dispositionId ? references.get(row.dispositionId) : null,
  }));
}

async function assertConfigurationEquality(
  database: IsolatedCloneDatabase["db"],
  sourceRows: Awaited<ReturnType<typeof rowsForCampaign>>,
  cloneRows: Awaited<ReturnType<typeof rowsForCampaign>>,
) {
  const sourceCampaign = sourceRows.campaign[0];
  const cloneCampaign = cloneRows.campaign[0];
  assert.ok(sourceCampaign);
  assert.ok(cloneCampaign);
  assert.notEqual(cloneCampaign.id, sourceCampaign.id);
  assert.equal(cloneCampaign.name, "Fully populated source (kópia)");
  assert.equal(cloneCampaign.status, "draft");
  assert.equal(cloneCampaign.createdBy, CREATOR_ID);
  assert.deepEqual(
    omit(cloneCampaign, "id", "name", "status", "createdBy", "createdAt", "updatedAt", "script"),
    omit(sourceCampaign, "id", "name", "status", "createdBy", "createdAt", "updatedAt", "script"),
  );
  assert.deepEqual(normalizeScript(cloneCampaign.script), normalizeScript(sourceCampaign.script));
  const originalScript = parseScript(sourceCampaign.script);
  const copiedScript = parseScript(cloneCampaign.script);
  const originalIds = new Set(originalScript.steps.flatMap((step: Row) =>
    [step.id, ...step.elements.map((element: Row) => element.id)]));
  for (const step of copiedScript.steps) {
    assert.ok(!originalIds.has(step.id), "persisted script step must get a fresh ID");
    for (const element of step.elements) {
      assert.ok(!originalIds.has(element.id), "persisted script element must get a fresh ID");
    }
  }

  assert.deepEqual(
    cloneRows.agents.map(row => omit(row, "id", "campaignId", "assignedAt", "assignedBy")),
    sourceRows.agents.map(row => omit(row, "id", "campaignId", "assignedAt", "assignedBy")),
  );
  assert.ok(cloneRows.agents.every(row => row.assignedBy === CREATOR_ID));
  assert.deepEqual(
    cloneRows.schedule.map(row => omit(row, "id", "campaignId", "createdAt", "updatedAt")),
    sourceRows.schedule.map(row => omit(row, "id", "campaignId", "createdAt", "updatedAt")),
  );
  assert.deepEqual(
    cloneRows.operators.map(row => omit(row, "id", "campaignId", "createdAt", "updatedAt")),
    sourceRows.operators.map(row => omit(row, "id", "campaignId", "createdAt", "updatedAt")),
  );
  assert.deepEqual(
    cloneRows.statusAssignments.map(row => omit(row, "id", "campaignId", "createdAt")),
    sourceRows.statusAssignments.map(row => omit(row, "id", "campaignId", "createdAt")),
  );

  assert.deepEqual(normalizeDispositions(cloneRows.dispositions), normalizeDispositions(sourceRows.dispositions));
  assert.deepEqual(
    normalizePhases(cloneRows.phases, cloneRows.dispositions),
    normalizePhases(sourceRows.phases, sourceRows.dispositions),
  );
  assert.deepEqual(normalizeItems(cloneRows.items), normalizeItems(sourceRows.items));
  assert.deepEqual(
    normalizeQuestions(
      cloneRows.questions,
      cloneRows.items,
    ),
    normalizeQuestions(sourceRows.questions, sourceRows.items),
  );
  assert.deepEqual(
    normalizeAutomations(
      cloneRows.automations,
      cloneRows.items,
      cloneRows.questions,
      cloneRows.dispositions,
    ),
    normalizeAutomations(
      sourceRows.automations,
      sourceRows.items,
      sourceRows.questions,
      sourceRows.dispositions,
    ),
  );
  assert.deepEqual(
    cloneRows.sopArticles.map(row => omit(row, "id", "campaignId", "createdAt")),
    sourceRows.sopArticles.map(row => omit(row, "id", "campaignId", "createdAt")),
  );

  assert.deepEqual(
    cloneRows.mailchimp.map(row => ({
      mailchimpListId: row.mailchimpListId,
      selectedTags: row.selectedTags,
      selectedSegmentId: row.selectedSegmentId,
      mailchimpCampaignId: row.mailchimpCampaignId,
      status: row.status,
      lastSyncAt: row.lastSyncAt,
      syncedContacts: row.syncedContacts,
      errorMessage: row.errorMessage,
      webhookUrl: row.webhookUrl,
      webhookRegistered: row.webhookRegistered,
    })),
    [{
      mailchimpListId: "audience-123",
      selectedTags: ["prospect", "sk"],
      selectedSegmentId: "segment-789",
      mailchimpCampaignId: null,
      status: "pending",
      lastSyncAt: null,
      syncedContacts: 0,
      errorMessage: null,
      webhookUrl: null,
      webhookRegistered: false,
    }],
  );

  assert.equal(cloneRows.contacts.length, 0);
  assert.equal(cloneRows.contactHistory.length, 0);
  assert.equal(cloneRows.contactSessions.length, 0);
  assert.equal(cloneRows.contactPhases.length, 0);
  assert.equal(cloneRows.statusListState.length, 0);
  assert.equal(cloneRows.callLogs.length, 0);
  assert.equal(cloneRows.revisions.length, 0);
  assert.deepEqual(
    sortRows(sourceRows.statusListState, "statusListItemId").map(row => ({
      statusListItemId: row.statusListItemId,
      confirmedByUserId: row.confirmedByUserId,
      itemNote: row.itemNote,
    })),
    [
      {
        statusListItemId: sourceIds.childItem,
        confirmedByUserId: "operator-1",
        itemNote: "Offer requested: yes",
      },
      {
        statusListItemId: sourceIds.rootItem,
        confirmedByUserId: "operator-1",
        itemNote: "Decision maker reached: yes",
      },
    ],
  );
  assert.deepEqual(
    sourceRows.callLogs.map(row => ({
      id: row.id,
      campaignContactId: row.campaignContactId,
      status: row.status,
      durationSeconds: row.durationSeconds,
      metadata: row.metadata,
    })),
    [{
      id: "source-call-log",
      campaignContactId: SOURCE_CONTACT_ID,
      status: "completed",
      durationSeconds: 840,
      metadata: JSON.stringify({ completion: "yes" }),
    }],
  );
  assert.equal((await database.select().from(campaignContactHistory)).length, 1);
  assert.equal((await database.select().from(campaignContactSessions)).length, 1);
}

async function countConfigurationRows(database: IsolatedCloneDatabase["db"]) {
  const rows = await Promise.all([
    database.select().from(campaigns),
    database.select().from(campaignAgents),
    database.select().from(campaignSchedules),
    database.select().from(campaignOperatorSettings),
    database.select().from(campaignDispositions),
    database.select().from(campaignStatusAssignments),
    database.select().from(campaignPhases),
    database.select().from(campaignStatusListItems),
    database.select().from(campaignStatusListQuestions),
    database.select().from(campaignStatusListAutomations),
    database.select().from(sopCampaignArticles),
    database.select().from(campaignMailchimpSync),
    database.select().from(campaignContacts),
    database.select().from(campaignContactHistory),
    database.select().from(campaignContactSessions),
    database.select().from(campaignContactPhases),
    database.select().from(campaignContactStatusListState),
    database.select().from(callLogs),
  ]);
  return rows.map(tableRows => tableRows.length);
}

async function run() {
  const isolatedUrl = process.env.CLONE_CAMPAIGN_TEST_DATABASE_URL;
  if (!isolatedUrl) {
    throw new Error(
      "CLONE_CAMPAIGN_TEST_DATABASE_URL is required; this integration test refuses DATABASE_URL",
    );
  }
  // clone-campaign imports the application's db for its default argument.
  // The shell runner supplies DATABASE_URL only for this disposable cluster;
  // all operations below inject the schema-isolated Drizzle database.
  const { cloneCampaignWithConfiguration } = await import("./clone-campaign");
  const isolated = await createIsolatedCloneDatabase();

  try {
    await seedFixture(isolated.db);
    const sourceBefore = await rowsForCampaign(isolated.db, SOURCE_CAMPAIGN_ID);

    const missing = await cloneCampaignWithConfiguration(
      "missing-campaign",
      CREATOR_ID,
      undefined,
      isolated.db,
    );
    assert.equal(missing, null);
    assert.deepEqual(await rowsForCampaign(isolated.db, SOURCE_CAMPAIGN_ID), sourceBefore);

    const clonedCampaign = await cloneCampaignWithConfiguration(
      SOURCE_CAMPAIGN_ID,
      CREATOR_ID,
      "   ",
      isolated.db,
    );
    assert.ok(clonedCampaign);
    const cloneRows = await rowsForCampaign(isolated.db, clonedCampaign.id);
    await assertConfigurationEquality(isolated.db, sourceBefore, cloneRows);
    assert.deepEqual(await rowsForCampaign(isolated.db, SOURCE_CAMPAIGN_ID), sourceBefore);

    const explicitlyNamed = await cloneCampaignWithConfiguration(
      SOURCE_CAMPAIGN_ID,
      CREATOR_ID,
      "  Explicit integration name  ",
      isolated.db,
    );
    assert.ok(explicitlyNamed);
    assert.equal(explicitlyNamed.name, "Explicit integration name");
    assert.deepEqual(await rowsForCampaign(isolated.db, SOURCE_CAMPAIGN_ID), sourceBefore);

    const countsBeforeFailure = await countConfigurationRows(isolated.db);
    const quotedSchema = `"${isolated.schemaName.replaceAll('"', '""')}"`;
    await isolated.client.query(`
      CREATE FUNCTION ${quotedSchema}.fail_clone_mailchimp_insert()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'intentional late clone failure';
      END;
      $$;
      CREATE TRIGGER fail_clone_mailchimp_insert
      BEFORE INSERT ON ${quotedSchema}.campaign_mailchimp_sync
      FOR EACH ROW EXECUTE FUNCTION ${quotedSchema}.fail_clone_mailchimp_insert();
    `);
    await assert.rejects(
      () => cloneCampaignWithConfiguration(
        SOURCE_CAMPAIGN_ID,
        CREATOR_ID,
        "Rollback must not remain",
        isolated.db,
      ),
      /intentional late clone failure/,
    );
    assert.deepEqual(await countConfigurationRows(isolated.db), countsBeforeFailure);
    assert.deepEqual(await rowsForCampaign(isolated.db, SOURCE_CAMPAIGN_ID), sourceBefore);
    assert.equal(
      (await isolated.db.select().from(campaigns).where(eq(campaigns.name, "Rollback must not remain"))).length,
      0,
    );
    await isolated.client.query(`
      DROP TRIGGER fail_clone_mailchimp_insert ON ${quotedSchema}.campaign_mailchimp_sync;
      DROP FUNCTION ${quotedSchema}.fail_clone_mailchimp_insert();
    `);
  } finally {
    await isolated.close();
  }
}

run()
  .then(() => {
    console.log("cloneCampaignWithConfiguration PostgreSQL integration: all assertions passed");
  })
  .catch(error => {
    console.error("cloneCampaignWithConfiguration PostgreSQL integration failed", error);
    process.exitCode = 1;
  });