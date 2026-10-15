import { pgTable, varchar, text, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { NormalizedCompany, RegistryPerson } from "./healthcare-legal-entity";

export const healthcareLegalEntities = pgTable("healthcare_legal_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  countryCode: text("country_code").notNull().default("SK"),
  ico: text("ico").notNull(),
  normalized: jsonb("normalized").$type<NormalizedCompany>().notNull(),
  notes: text("notes").notNull().default(""),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  sourceUpdatedAt: text("source_updated_at"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({ identity: uniqueIndex("healthcare_legal_entities_country_ico").on(table.countryCode, table.ico) }));

export const healthcareLegalEntitySnapshots = pgTable("healthcare_legal_entity_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  legalEntityId: varchar("legal_entity_id").notNull().references(() => healthcareLegalEntities.id),
  normalized: jsonb("normalized").$type<NormalizedCompany>().notNull(),
  registryPeople: jsonb("registry_people").$type<RegistryPerson[]>().notNull().default([]),
  rawData: jsonb("raw_data").$type<Record<string, unknown>>().notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  sourceUpdatedAt: text("source_updated_at"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const healthcareLegalEntityVerifications = pgTable("healthcare_legal_entity_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  createdBy: varchar("created_by").notNull(),
  facilityType: text("facility_type"), facilityId: varchar("facility_id"),
  normalized: jsonb("normalized").$type<NormalizedCompany>().notNull(),
  registryPeople: jsonb("registry_people").$type<RegistryPerson[]>().notNull(),
  rawData: jsonb("raw_data").$type<Record<string, unknown>>().notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  sourceUpdatedAt: text("source_updated_at"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }), resultEntityId: varchar("result_entity_id"),
});
export const healthcareLegalEntityFacilities = pgTable("healthcare_legal_entity_facilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  legalEntityId: varchar("legal_entity_id").notNull().references(() => healthcareLegalEntities.id),
  facilityType: text("facility_type").notNull(), facilityId: varchar("facility_id").notNull(),
  relationship: text("relationship").notNull().default("operator"),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  validTo: timestamp("valid_to", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedBy: varchar("confirmed_by"), endedBy: varchar("ended_by"),
}, table => ({ activeOperator: uniqueIndex("hle_one_active_operator").on(table.facilityType, table.facilityId).where(sql`${table.validTo} IS NULL`) }));
export const healthcareLegalEntityPersonLinks = pgTable("healthcare_legal_entity_person_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  legalEntityId: varchar("legal_entity_id").notNull().references(() => healthcareLegalEntities.id),
  personId: varchar("person_id").notNull(), registryPersonKey: text("registry_person_key").notNull(), role: text("role").notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  validTo: timestamp("valid_to", { withTimezone: true }), confirmedBy: varchar("confirmed_by"), endedBy: varchar("ended_by"),
}, table => ({ activeRole: uniqueIndex("hle_one_active_person_role").on(table.legalEntityId, table.registryPersonKey).where(sql`${table.validTo} IS NULL`) }));
export const healthcareLegalEntityAudit = pgTable("healthcare_legal_entity_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  legalEntityId: varchar("legal_entity_id").notNull().references(() => healthcareLegalEntities.id),
  actorId: varchar("actor_id"), kind: text("kind").notNull(), details: jsonb("details").notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});
