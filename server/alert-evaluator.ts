import { storage } from "./storage";
import { db } from "./db";
import { collections, collectionLabResults, customers, invoices, tasks, apiKeys, users } from "@shared/schema";
import { eq, sql, and, isNull, lt, gte, lte, inArray } from "drizzle-orm";

type MetricType = 
  | 'pending_lab_results'
  | 'collections_without_hospital'
  | 'overdue_collections'
  | 'pending_evaluations'
  | 'expiring_api_keys'
  | 'inactive_customers'
  | 'upcoming_collection_dates'
  | 'low_collection_rate'
  | 'pending_invoices'
  | 'overdue_tasks';

type ComparisonOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
type CheckFrequency = 'hourly' | 'every_6_hours' | 'daily' | 'weekly';

const frequencyInMs: Record<CheckFrequency, number> = {
  'hourly': 60 * 60 * 1000,
  'every_6_hours': 6 * 60 * 60 * 1000,
  'daily': 24 * 60 * 60 * 1000,
  'weekly': 7 * 24 * 60 * 60 * 1000
};

async function evaluateMetric(metricType: MetricType, countryCodes?: string[]): Promise<number> {
  // Helper to add country filter to collection queries
  const getCollectionCountryCondition = () => {
    if (countryCodes?.length) {
      return inArray(collections.countryCode, countryCodes);
    }
    return undefined;
  };
  
  // Helper to add country filter to customer queries
  const getCustomerCountryCondition = () => {
    if (countryCodes?.length) {
      return inArray(customers.countryCode, countryCodes);
    }
    return undefined;
  };

  switch (metricType) {
    case 'pending_lab_results': {
      const conditions = [isNull(collectionLabResults.id)];
      const countryCondition = getCollectionCountryCondition();
      if (countryCondition) conditions.push(countryCondition);
      
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(collections)
        .leftJoin(collectionLabResults, eq(collections.id, collectionLabResults.collectionId))
        .where(and(...conditions));
      return Number(result[0]?.count || 0);
    }
    
    case 'collections_without_hospital': {
      const conditions = [isNull(collections.hospitalId)];
      const countryCondition = getCollectionCountryCondition();
      if (countryCondition) conditions.push(countryCondition);
      
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(collections)
        .where(and(...conditions));
      return Number(result[0]?.count || 0);
    }
    
    case 'overdue_collections': {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const conditions = [
        eq(collections.state, 'pending'),
        lt(collections.createdAt, sevenDaysAgo)
      ];
      const countryCondition = getCollectionCountryCondition();
      if (countryCondition) conditions.push(countryCondition);
      
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(collections)
        .where(and(...conditions));
      return Number(result[0]?.count || 0);
    }
    
    case 'pending_evaluations': {
      const conditions = [eq(collections.state, 'pending_evaluation')];
      const countryCondition = getCollectionCountryCondition();
      if (countryCondition) conditions.push(countryCondition);
      
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(collections)
        .where(and(...conditions));
      return Number(result[0]?.count || 0);
    }
    
    case 'expiring_api_keys': {
      // API keys are global, no country filter applies
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(apiKeys)
        .where(and(
          eq(apiKeys.isActive, true),
          lte(apiKeys.expiresAt, thirtyDaysFromNow)
        ));
      return Number(result[0]?.count || 0);
    }
    
    case 'inactive_customers': {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const conditions = [lt(customers.createdAt, sixMonthsAgo)];
      const countryCondition = getCustomerCountryCondition();
      if (countryCondition) conditions.push(countryCondition);
      
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(and(...conditions));
      return Number(result[0]?.count || 0);
    }
    
    case 'upcoming_collection_dates': {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const conditions = [
        eq(collections.state, 'scheduled'),
        gte(collections.collectionDate, new Date()),
        lte(collections.collectionDate, sevenDaysFromNow)
      ];
      const countryCondition = getCollectionCountryCondition();
      if (countryCondition) conditions.push(countryCondition);
      
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(collections)
        .where(and(...conditions));
      return Number(result[0]?.count || 0);
    }
    
    case 'low_collection_rate': {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const conditions = [gte(collections.createdAt, lastMonth)];
      const countryCondition = getCollectionCountryCondition();
      if (countryCondition) conditions.push(countryCondition);
      
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(collections)
        .where(and(...conditions));
      return Number(result[0]?.count || 0);
    }
    
    case 'pending_invoices': {
      // Invoices may have country via customer, but for simplicity keep global
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(invoices)
        .where(eq(invoices.status, 'pending'));
      return Number(result[0]?.count || 0);
    }
    
    case 'overdue_tasks': {
      // Tasks are user-assigned, not country-specific
      const now = new Date();
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(and(
          eq(tasks.status, 'pending'),
          lt(tasks.dueDate, now)
        ));
      return Number(result[0]?.count || 0);
    }
    
    default:
      return 0;
  }
}

function compareValue(value: number, operator: ComparisonOperator, threshold: number): boolean {
  switch (operator) {
    case 'gt': return value > threshold;
    case 'gte': return value >= threshold;
    case 'lt': return value < threshold;
    case 'lte': return value <= threshold;
    case 'eq': return value === threshold;
    case 'neq': return value !== threshold;
    default: return false;
  }
}

function shouldCheck(lastCheckedAt: Date | null, frequency: CheckFrequency): boolean {
  if (!lastCheckedAt) return true;
  const timeSinceLastCheck = Date.now() - lastCheckedAt.getTime();
  return timeSinceLastCheck >= frequencyInMs[frequency];
}

function isInCooldown(lastAlertedAt: Date | null, cooldownMinutes: number): boolean {
  if (!lastAlertedAt) return false;
  const cooldownMs = cooldownMinutes * 60 * 1000;
  return Date.now() - lastAlertedAt.getTime() < cooldownMs;
}

async function getTargetUserIds(rule: {
  targetUserType: string;
  targetRoles: string[] | null;
  targetUserIds: string[] | null;
  countryCodes: string[] | null;
}): Promise<string[]> {
  try {
    // Build base conditions - always require active users
    const baseConditions = [eq(users.isActive, true)];
    
    // Apply country filter if specified (applies to ALL target types)
    if (rule.countryCodes?.length) {
      baseConditions.push(inArray(users.countryCode, rule.countryCodes));
    }
    
    if (rule.targetUserType === 'specific_users' && rule.targetUserIds?.length) {
      // For specific users, also apply country filter if specified
      const specificUserResults = await db.select({ id: users.id })
        .from(users)
        .where(and(
          inArray(users.id, rule.targetUserIds),
          ...baseConditions
        ));
      return specificUserResults.map(r => r.id);
    }
    
    if (rule.targetUserType === 'role' && rule.targetRoles?.length) {
      // For role-based targeting with optional country filter
      const roleResults = await db.select({ id: users.id })
        .from(users)
        .where(and(
          inArray(users.role, rule.targetRoles),
          ...baseConditions
        ));
      return roleResults.map(r => r.id);
    }
    
    // For 'all' type - get all active users with optional country filter
    const allResults = await db.select({ id: users.id })
      .from(users)
      .where(and(...baseConditions));
    return allResults.map(r => r.id);
  } catch (error) {
    console.error("[AlertEvaluator] Error getting target users:", error);
    return [];
  }
}

function getMetricLabel(metricType: string): string {
  const labels: Record<string, string> = {
    'pending_lab_results': 'Pending Lab Results',
    'collections_without_hospital': 'Collections Without Hospital',
    'overdue_collections': 'Overdue Collections',
    'pending_evaluations': 'Pending Evaluations',
    'expiring_api_keys': 'Expiring API Keys',
    'inactive_customers': 'Inactive Customers',
    'upcoming_collection_dates': 'Upcoming Collection Dates',
    'low_collection_rate': 'Low Collection Rate',
    'pending_invoices': 'Pending Invoices',
    'overdue_tasks': 'Overdue Tasks',
  };
  return labels[metricType] || metricType.replace(/_/g, ' ');
}

function getOperatorLabel(operator: string): string {
  const labels: Record<string, string> = {
    'gt': '>',
    'gte': '>=',
    'lt': '<',
    'lte': '<=',
    'eq': '=',
    'neq': '!=',
  };
  return labels[operator] || operator;
}

export async function evaluateAlerts(): Promise<void> {
  try {
    const activeRules = await storage.getActiveAlertRules();
    
    for (const rule of activeRules) {
      try {
        const frequency = rule.checkFrequency as CheckFrequency;
        if (!shouldCheck(rule.lastCheckedAt, frequency)) {
          continue;
        }

        await storage.updateAlertRuleLastChecked(rule.id);

        if (isInCooldown(rule.lastAlertedAt, rule.cooldownMinutes || 60)) {
          continue;
        }

        const metricValue = await evaluateMetric(
          rule.metricType as MetricType,
          rule.countryCodes || undefined
        );

        const operator = rule.comparisonOperator as ComparisonOperator;
        const shouldAlert = compareValue(metricValue, operator, rule.thresholdValue);

        if (shouldAlert) {
          const alertInstance = await storage.createAlertInstance({
            alertRuleId: rule.id,
            metricValue,
            thresholdValue: rule.thresholdValue,
            status: 'active',
            notificationsSent: 0
          });

          await storage.updateAlertRuleLastAlerted(rule.id);

          // Get target users and create notifications for each
          const targetUserIds = await getTargetUserIds(rule);
          let notificationsSent = 0;
          
          for (const userId of targetUserIds) {
            try {
              await storage.createNotification({
                userId,
                type: 'system_alert',
                title: rule.name,
                message: `${getMetricLabel(rule.metricType)}: ${metricValue} ${getOperatorLabel(rule.comparisonOperator)} ${rule.thresholdValue}`,
                priority: rule.priority === 'critical' ? 'urgent' : 
                         rule.priority === 'high' ? 'high' : 'normal',
                entityType: 'alert',
                entityId: alertInstance.id,
                metadata: {
                  alertRuleId: rule.id,
                  alertInstanceId: alertInstance.id,
                  metricType: rule.metricType,
                  metricValue,
                  thresholdValue: rule.thresholdValue,
                  comparisonOperator: rule.comparisonOperator
                }
              });
              notificationsSent++;
            } catch (notifError) {
              console.error(`[AlertEvaluator] Error creating notification for user ${userId}:`, notifError);
            }
          }
          
          // Update notification count on the alert instance
          if (notificationsSent > 0) {
            await storage.updateAlertInstanceNotificationsSent(alertInstance.id, notificationsSent);
          }

          console.log(`[AlertEvaluator] Alert triggered for rule "${rule.name}": value=${metricValue}, threshold=${rule.thresholdValue}, notifications sent: ${notificationsSent}`);
        }
      } catch (ruleError) {
        console.error(`[AlertEvaluator] Error evaluating rule "${rule.name}":`, ruleError);
      }
    }
  } catch (error) {
    console.error("[AlertEvaluator] Error in alert evaluation:", error);
  }
}

let evaluationInterval: ReturnType<typeof setInterval> | null = null;

export function startAlertEvaluator(intervalMs: number = 60 * 1000): void {
  if (evaluationInterval) {
    console.log("[AlertEvaluator] Evaluator already running");
    return;
  }

  console.log(`[AlertEvaluator] Starting alert evaluator with ${intervalMs}ms interval`);
  
  evaluateAlerts();

  evaluationInterval = setInterval(() => {
    evaluateAlerts();
  }, intervalMs);
}

export function stopAlertEvaluator(): void {
  if (evaluationInterval) {
    clearInterval(evaluationInterval);
    evaluationInterval = null;
    console.log("[AlertEvaluator] Alert evaluator stopped");
  }
}
