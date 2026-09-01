import { randomUUID } from "node:crypto";
import { inArray, eq } from "drizzle-orm";
import { db } from "../db";
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
  operatorScriptSchema,
} from "@shared/schema";

function remapIdsDeep(value: unknown, idMap: Map<string, string>): unknown {
  if (typeof value === "string") return idMap.get(value) ?? value;
  if (Array.isArray(value)) return value.map(item => remapIdsDeep(item, idMap));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, remapIdsDeep(item, idMap)]),
    );
  }
  return value;
}

export function cloneOperatorScript(script: unknown): unknown {
  const parsed = operatorScriptSchema.safeParse(script);
  if (!parsed.success) return script;

  const stepIdMap = new Map(parsed.data.steps.map(step => [step.id, randomUUID()]));
  const elementIdMap = new Map(
    parsed.data.steps.flatMap(step => step.elements.map(element => [element.id, randomUUID()] as const)),
  );
  const remapStepId = (id: string | undefined) => id ? stepIdMap.get(id) ?? id : undefined;

  return {
    ...parsed.data,
    startStepId: remapStepId(parsed.data.startStepId),
    steps: parsed.data.steps.map(step => ({
      ...step,
      id: stepIdMap.get(step.id)!,
      nextStepId: remapStepId(step.nextStepId),
      elements: step.elements.map(element => ({
        ...element,
        id: elementIdMap.get(element.id)!,
        jumpTargetStepId: remapStepId(element.jumpTargetStepId),
        options: element.options?.map(option => ({
          ...option,
          nextStepId: remapStepId(option.nextStepId),
        })),
      })),
    })),
  };
}

export async function cloneCampaignWithConfiguration(
  sourceCampaignId: string,
  createdBy: string,
  requestedName?: string,
) {
  return db.transaction(async tx => {
    const [sourceCampaign] = await tx.select().from(campaigns)
      .where(eq(campaigns.id, sourceCampaignId))
      .limit(1);
    if (!sourceCampaign) return null;

    const newCampaignId = randomUUID();
    const cloneName = requestedName?.trim() || `${sourceCampaign.name} (kópia)`;
    const [clonedCampaign] = await tx.insert(campaigns).values({
      id: newCampaignId,
      name: cloneName,
      description: sourceCampaign.description,
      type: sourceCampaign.type,
      channel: sourceCampaign.channel,
      status: "draft",
      countryCodes: sourceCampaign.countryCodes || [],
      criteria: sourceCampaign.criteria,
      settings: sourceCampaign.settings,
      script: cloneOperatorScript(sourceCampaign.script),
      defaultActiveTab: sourceCampaign.defaultActiveTab,
      callerIdNumber: sourceCampaign.callerIdNumber,
      startDate: sourceCampaign.startDate,
      endDate: sourceCampaign.endDate,
      targetContactCount: sourceCampaign.targetContactCount,
      conversionGoal: sourceCampaign.conversionGoal,
      createdBy,
    }).returning();

    const [
      sourceAgents,
      sourceSchedule,
      sourceOperatorSettings,
      sourceDispositions,
      sourceStatusAssignments,
      sourcePhases,
      sourceStatusItems,
      sourceSopArticles,
    ] = await Promise.all([
      tx.select().from(campaignAgents).where(eq(campaignAgents.campaignId, sourceCampaignId)),
      tx.select().from(campaignSchedules).where(eq(campaignSchedules.campaignId, sourceCampaignId)),
      tx.select().from(campaignOperatorSettings).where(eq(campaignOperatorSettings.campaignId, sourceCampaignId)),
      tx.select().from(campaignDispositions).where(eq(campaignDispositions.campaignId, sourceCampaignId)),
      tx.select().from(campaignStatusAssignments).where(eq(campaignStatusAssignments.campaignId, sourceCampaignId)),
      tx.select().from(campaignPhases).where(eq(campaignPhases.campaignId, sourceCampaignId)),
      tx.select().from(campaignStatusListItems).where(eq(campaignStatusListItems.campaignId, sourceCampaignId)),
      tx.select().from(sopCampaignArticles).where(eq(sopCampaignArticles.campaignId, sourceCampaignId)),
    ]);

    if (sourceAgents.length) {
      await tx.insert(campaignAgents).values(sourceAgents.map(row => ({
        id: randomUUID(),
        campaignId: newCampaignId,
        userId: row.userId,
        role: row.role,
        assignedBy: createdBy,
      })));
    }

    if (sourceSchedule.length) {
      const row = sourceSchedule[0];
      await tx.insert(campaignSchedules).values({
        id: randomUUID(),
        campaignId: newCampaignId,
        workingDays: row.workingDays,
        workingHoursStart: row.workingHoursStart,
        workingHoursEnd: row.workingHoursEnd,
        maxAttemptsPerContact: row.maxAttemptsPerContact,
        minHoursBetweenAttempts: row.minHoursBetweenAttempts,
        autoAssignContacts: row.autoAssignContacts,
        prioritizeCallbacks: row.prioritizeCallbacks,
      });
    }

    if (sourceOperatorSettings.length) {
      await tx.insert(campaignOperatorSettings).values(sourceOperatorSettings.map(row => ({
        id: randomUUID(),
        campaignId: newCampaignId,
        userId: row.userId,
        isActive: row.isActive,
        workloadWeight: row.workloadWeight,
        maxContactsPerDay: row.maxContactsPerDay,
        dailyCallQuota: row.dailyCallQuota,
        dailyEmailQuota: row.dailyEmailQuota,
        dailySmsQuota: row.dailySmsQuota,
        assignedCountries: row.assignedCountries,
      })));
    }

    if (sourceStatusAssignments.length) {
      await tx.insert(campaignStatusAssignments).values(sourceStatusAssignments.map(row => ({
        id: randomUUID(),
        campaignId: newCampaignId,
        statusDefinitionId: row.statusDefinitionId,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
      })));
    }

    const dispositionIdMap = new Map(sourceDispositions.map(row => [row.id, randomUUID()]));
    if (sourceDispositions.length) {
      await tx.insert(campaignDispositions).values(sourceDispositions.map(row => ({
        id: dispositionIdMap.get(row.id)!,
        campaignId: newCampaignId,
        parentId: row.parentId ? dispositionIdMap.get(row.parentId) ?? null : null,
        name: row.name,
        code: row.code,
        channel: row.channel,
        icon: row.icon,
        color: row.color,
        actionType: row.actionType,
        callbackOffsetDays: row.callbackOffsetDays,
        childrenType: row.childrenType,
        requiresNote: row.requiresNote,
        requiresCallback: row.requiresCallback,
        isFinal: row.isFinal,
        isConversion: row.isConversion,
        isDefault: row.isDefault,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
      })));
    }

    const phaseIdMap = new Map(sourcePhases.map(row => [row.id, randomUUID()]));
    const allConfigIdMap = new Map([...dispositionIdMap, ...phaseIdMap]);
    if (sourcePhases.length) {
      await tx.insert(campaignPhases).values(sourcePhases.map(row => ({
        id: phaseIdMap.get(row.id)!,
        campaignId: newCampaignId,
        phaseNumber: row.phaseNumber,
        name: row.name,
        type: row.type,
        status: "draft",
        scheduledStartAt: row.scheduledStartAt,
        evaluationAt: row.evaluationAt,
        completedAt: null,
        mailchimpCampaignId: null,
        transitionRules: remapIdsDeep(row.transitionRules, allConfigIdMap),
        transitionMode: row.transitionMode,
        autoTransitionSchedule: row.autoTransitionSchedule,
        lastAutoTransitionAt: null,
        targetCalls: row.targetCalls,
        targetEmails: row.targetEmails,
        targetConversions: row.targetConversions,
        targetResponseRate: row.targetResponseRate,
      })));
    }

    const itemIdMap = new Map(sourceStatusItems.map(row => [row.id, randomUUID()]));
    for (const [oldId, newId] of itemIdMap) allConfigIdMap.set(oldId, newId);
    if (sourceStatusItems.length) {
      await tx.insert(campaignStatusListItems).values(sourceStatusItems.map(row => ({
        id: itemIdMap.get(row.id)!,
        campaignId: newCampaignId,
        stepId: row.stepId,
        label: row.label,
        description: row.description,
        sortOrder: row.sortOrder,
        required: row.required,
        parentId: row.parentId ? itemIdMap.get(row.parentId) ?? null : null,
        confirmationType: row.confirmationType,
        nextStepId: row.nextStepId ? itemIdMap.get(row.nextStepId) ?? row.nextStepId : null,
        restrictions: row.restrictions,
        isHidden: row.isHidden,
        itemType: row.itemType,
        color: row.color,
        autoConfirmOnSubQuestion: row.autoConfirmOnSubQuestion,
        questionSelectionMode: row.questionSelectionMode,
        tab: row.tab,
        canonicalClinicStatusKey: row.canonicalClinicStatusKey,
      })));
    }

    const sourceItemIds = sourceStatusItems.map(row => row.id);
    const sourceQuestions = sourceItemIds.length
      ? await tx.select().from(campaignStatusListQuestions)
          .where(inArray(campaignStatusListQuestions.itemId, sourceItemIds))
      : [];
    const questionIdMap = new Map(sourceQuestions.map(row => [row.id, randomUUID()]));
    for (const [oldId, newId] of questionIdMap) allConfigIdMap.set(oldId, newId);
    if (sourceQuestions.length) {
      await tx.insert(campaignStatusListQuestions).values(sourceQuestions.map(row => ({
        id: questionIdMap.get(row.id)!,
        itemId: itemIdMap.get(row.itemId)!,
        groupName: row.groupName,
        questionText: row.questionText,
        sortOrder: row.sortOrder,
        logicOperator: row.logicOperator,
        gotoQuestionId: row.gotoQuestionId ? questionIdMap.get(row.gotoQuestionId) ?? null : null,
        required: row.required,
        icon: row.icon,
        color: row.color,
        description: row.description,
        isHidden: row.isHidden,
        fieldType: row.fieldType,
      })));
    }

    const sourceAutomations = sourceItemIds.length
      ? await tx.select().from(campaignStatusListAutomations)
          .where(inArray(campaignStatusListAutomations.statusListItemId, sourceItemIds))
      : [];
    if (sourceAutomations.length) {
      await tx.insert(campaignStatusListAutomations).values(sourceAutomations.map(row => ({
        id: randomUUID(),
        statusListItemId: itemIdMap.get(row.statusListItemId)!,
        questionId: row.questionId ? questionIdMap.get(row.questionId) ?? null : null,
        sortOrder: row.sortOrder,
        actionType: row.actionType,
        targetRole: row.targetRole,
        emailTemplateId: row.emailTemplateId,
        emailRecipients: row.emailRecipients,
        smsTemplateId: row.smsTemplateId,
        smsProvider: row.smsProvider,
        callbackOffsetDays: row.callbackOffsetDays,
        callbackTime: row.callbackTime,
        notifyAgentPulse: row.notifyAgentPulse,
        taskDescription: row.taskDescription,
        taskDeadlineOffset: row.taskDeadlineOffset,
        taskPriority: row.taskPriority,
        conditionField: row.conditionField,
        conditionOperator: row.conditionOperator,
        conditionValue: row.conditionValue,
        conditionJson: row.conditionJson,
        dispositionId: row.dispositionId ? dispositionIdMap.get(row.dispositionId) ?? row.dispositionId : null,
        webhookTarget: row.webhookTarget,
        taskGroupId: row.taskGroupId,
        assignNotify: row.assignNotify,
        assignNotifyChannels: row.assignNotifyChannels,
      })));
    }

    if (sourceSopArticles.length) {
      await tx.insert(sopCampaignArticles).values(sourceSopArticles.map(row => ({
        id: randomUUID(),
        articleId: row.articleId,
        campaignId: newCampaignId,
      })));
    }

    return clonedCampaign;
  });
}