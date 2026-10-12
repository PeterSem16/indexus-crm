import assert from "node:assert/strict";
import { pool } from "../db";
import { storage } from "../storage";
import { notificationService } from "./notification-service";

const oldRules = storage.getActiveNotificationRulesByTrigger;
const oldUsers = storage.getAllUsers;
const oldDeliver = notificationService.sendNotificationToUsers;
const delivered: string[][] = [];
let rule: any = { id: "fixture-rule", countryCodes: ["SK"], targetType: "all",
  notificationTitle: "fixture", priority: "high", sendPush: true, triggerConditions: { hasAngryTone: true } };
storage.getActiveNotificationRulesByTrigger = async () => [rule];
storage.getAllUsers = async () => [
  { id: "allowed", isActive: true }, { id: "not-allowed", isActive: true },
  { id: "inactive", isActive: false },
] as any;
notificationService.sendNotificationToUsers = async ids => { delivered.push(ids); };
try {
  const data = { title: "fixture", entityType: "sms", entityId: "fixture-sms",
    countryCode: "SK", allowedUserIds: ["allowed"], metadata: { hasAngryTone: true } };
  await notificationService.triggerNotification("sentiment_negative", data);
  assert.deepEqual(delivered.pop(), ["allowed"]);
  await notificationService.triggerNotification("sentiment_negative", { ...data, allowedUserIds: [] });
  assert.equal(delivered.length, 0);
  await notificationService.triggerNotification("sentiment_negative", { ...data, countryCode: undefined });
  assert.equal(delivered.length, 0);
  await notificationService.triggerNotification("sentiment_negative", { ...data, metadata: { hasAngryTone: false } });
  assert.equal(delivered.length, 0);
  await notificationService.triggerNotification("new_sms", { ...data, smsAnalysisPhase: "received" });
  assert.equal(delivered.length, 0, "intent filters wait for persisted AI fields");
  await notificationService.triggerNotification("new_sms", { ...data, smsAnalysisPhase: "analyzed" });
  assert.deepEqual(delivered.pop(), ["allowed"]);
  rule = { ...rule, triggerConditions: null };
  await notificationService.triggerNotification("new_sms", { ...data, smsAnalysisPhase: "received" });
  assert.deepEqual(delivered.pop(), ["allowed"]);
  await notificationService.triggerNotification("new_sms", { ...data, smsAnalysisPhase: "analyzed" });
  assert.equal(delivered.length, 0, "generic receipt notices do not repeat after AI");
  rule = { ...rule, sendPush: false };
  await notificationService.triggerNotification("new_sms", { ...data, smsAnalysisPhase: "received" });
  assert.equal(delivered.length, 0, "in-app delivery switch is honored");
  rule = { ...rule, sendPush: true };
  rule = { ...rule, targetType: "assignee", targetUserIds: ["allowed"] };
  await notificationService.triggerNotification("sentiment_negative", data);
  assert.deepEqual(delivered.pop(), ["allowed"]);
  rule = { ...rule, targetUserIds: ["inactive"] };
  await notificationService.triggerNotification("sentiment_negative", { ...data, allowedUserIds: ["inactive"] });
  assert.equal(delivered.length, 0);
  console.log("SMS rules: authorized audience intersection, country fail-closed, conditions and selected-user routing PASSED");
} finally {
  storage.getActiveNotificationRulesByTrigger = oldRules;
  storage.getAllUsers = oldUsers;
  notificationService.sendNotificationToUsers = oldDeliver;
  await pool.end();
}
