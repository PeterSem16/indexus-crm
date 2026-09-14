import { randomUUID } from "node:crypto";
import pg, { type Client as PgClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "@shared/schema";
import type { db as applicationDatabase } from "../db";

const { Client } = pg;

export type IsolatedCloneDatabase = {
  db: typeof applicationDatabase;
  client: PgClient;
  schemaName: string;
  close: () => Promise<void>;
};

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

type SqlLike = {
  toQuery?: (config: {
    casing: { cache: Map<string, string>; convert: (value: string) => string };
    escapeName: (value: string) => string;
    escapeParam: (index: number) => string;
    inlineParams: boolean;
    paramStartIndex: { value: number };
    prepareTyping: () => undefined;
  }) => { sql: string; params?: unknown[] };
};

function renderDefault(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return quoteLiteral(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";

  const sqlValue = value as SqlLike;
  if (typeof sqlValue.toQuery === "function") {
    const rendered = sqlValue.toQuery({
      casing: { cache: new Map(), convert: input => input },
      escapeName: quoteIdentifier,
      escapeParam: index => `$${index}`,
      inlineParams: true,
      paramStartIndex: { value: 0 },
      prepareTyping: () => undefined,
    });
    if (rendered.params?.length) {
      throw new Error("A schema default containing parameters cannot be rendered for the isolated test database");
    }
    return rendered.sql;
  }

  throw new Error(`Unsupported schema default value: ${String(value)}`);
}

type TableConfig = ReturnType<typeof getTableConfig>;

function primaryColumnNames(config: TableConfig): Set<string> {
  const names = new Set(
    config.columns.filter(column => column.primary).map(column => column.name),
  );
  for (const primaryKey of config.primaryKeys) {
    for (const column of primaryKey.columns) names.add(column.name);
  }
  return names;
}

function renderTable(config: TableConfig): string {
  const primaryNames = primaryColumnNames(config);
  const hasTablePrimaryKey = config.primaryKeys.some(primaryKey =>
    primaryKey.columns.length > 1 ||
    primaryKey.columns.some(column => !column.primary),
  );
  const definitions = config.columns.map(column => {
    const definition = [
      quoteIdentifier(column.name),
      column.getSQLType(),
      ...(column.primary && !hasTablePrimaryKey ? ["PRIMARY KEY"] : []),
      ...(column.notNull && !(column.primary && !hasTablePrimaryKey) ? ["NOT NULL"] : []),
    ];
    const defaultValue = column.hasDefault ? renderDefault(column.default) : null;
    if (defaultValue !== null) definition.push(`DEFAULT ${defaultValue}`);
    if (column.isUnique && !column.primary) definition.push("UNIQUE");
    return definition.join(" ");
  });

  if (hasTablePrimaryKey) {
    const primaryKey = config.primaryKeys.find(candidate =>
      candidate.columns.some(column => primaryNames.has(column.name)),
    );
    if (!primaryKey) throw new Error(`Unable to render primary key for ${config.name}`);
    definitions.push(
      `CONSTRAINT ${quoteIdentifier(primaryKey.getName())} PRIMARY KEY (${primaryKey.columns.map(column => quoteIdentifier(column.name)).join(", ")})`,
    );
  }

  for (const uniqueConstraint of config.uniqueConstraints) {
    const uniqueName = uniqueConstraint.getName() ??
      `${config.name}_${uniqueConstraint.columns.map(column => column.name).join("_")}_unique`;
    definitions.push(
      `CONSTRAINT ${quoteIdentifier(uniqueName)} UNIQUE (${uniqueConstraint.columns.map(column => quoteIdentifier(column.name)).join(", ")})`,
    );
  }

  return `CREATE TABLE ${quoteIdentifier(config.name)} (\n  ${definitions.join(",\n  ")}\n)`;
}

function renderForeignKeys(configs: TableConfig[]): string[] {
  const knownTables = new Set(configs.map(config => config.name));
  const statements: string[] = [];
  for (const config of configs) {
    for (const foreignKey of config.foreignKeys) {
      const reference = foreignKey.reference();
      const foreignTableConfig = getTableConfig(reference.foreignTable);
      if (!knownTables.has(foreignTableConfig.name)) continue;
      const actions = [
        foreignKey.onUpdate && foreignKey.onUpdate !== "no action"
          ? ` ON UPDATE ${foreignKey.onUpdate.toUpperCase()}`
          : "",
        foreignKey.onDelete && foreignKey.onDelete !== "no action"
          ? ` ON DELETE ${foreignKey.onDelete.toUpperCase()}`
          : "",
      ].join("");
      statements.push(
        `ALTER TABLE ${quoteIdentifier(config.name)} ADD CONSTRAINT ${quoteIdentifier(foreignKey.getName())}` +
        ` FOREIGN KEY (${reference.columns.map(column => quoteIdentifier(column.name)).join(", ")})` +
        ` REFERENCES ${quoteIdentifier(foreignTableConfig.name)} (${reference.foreignColumns.map(column => quoteIdentifier(column.name)).join(", ")})${actions}`,
      );
    }
  }
  return statements;
}

function renderIndexes(configs: TableConfig[]): string[] {
  const statements: string[] = [];
  for (const config of configs) {
    for (const index of config.indexes) {
      const indexConfig = index.config;
      const columns = indexConfig.columns.map((column: unknown) => {
        if (column && typeof column === "object" && "name" in column) {
          return quoteIdentifier(String((column as { name: string }).name));
        }
        throw new Error(`Unsupported expression in ${config.name} index ${indexConfig.name}`);
      });
      const concurrently = indexConfig.concurrently ? " CONCURRENTLY" : "";
      const only = indexConfig.only ? " ONLY" : "";
      const unique = indexConfig.unique ? "UNIQUE " : "";
      const method = indexConfig.method ? ` USING ${indexConfig.method}` : "";
      const indexName = indexConfig.name ??
        `${config.name}_${indexConfig.columns.map((column: unknown) =>
          column && typeof column === "object" && "name" in column
            ? String((column as { name: string }).name)
            : "expression"
        ).join("_")}_idx`;
      statements.push(
        `CREATE ${unique}INDEX${concurrently}${only} ${quoteIdentifier(indexName)} ON ${quoteIdentifier(config.name)}${method} (${columns.join(", ")})`,
      );
    }
  }
  return statements;
}

/**
 * Keep this list deliberately narrow: these are the campaign configuration
 * tables and the operational tables touched by the clone integration test.
 * Their definitions are rendered from shared/schema.ts, rather than copied
 * here, so a schema change cannot silently leave this disposable database
 * with stale nullability, defaults, keys, or indexes.
 */
const isolatedTables = [
  schema.campaigns,
  schema.campaignAgents,
  schema.campaignSchedules,
  schema.campaignOperatorSettings,
  schema.campaignDispositions,
  schema.campaignStatusAssignments,
  schema.campaignPhases,
  schema.campaignStatusListItems,
  schema.campaignStatusListQuestions,
  schema.campaignStatusListAutomations,
  schema.sopCampaignArticles,
  schema.campaignMailchimpSync,
  schema.campaignContacts,
  schema.campaignContactHistory,
  schema.campaignContactSessions,
  schema.campaignContactPhases,
  schema.nexusPulseModuleRevisions,
  schema.campaignContactStatusListState,
  schema.callLogs,
] as const;

function renderIsolatedSchema(): string {
  const configs = isolatedTables.map(table =>
    getTableConfig(table as Parameters<typeof getTableConfig>[0]),
  );
  return [
    ...configs.map(renderTable),
    ...renderForeignKeys(configs),
    ...renderIndexes(configs),
  ].join(";\n");
}

/**
 * Opens a dedicated PostgreSQL connection and puts all test tables in a
 * random schema.  The URL is deliberately separate from DATABASE_URL: this
 * test must never be pointed at the application's database.
 */
export async function createIsolatedCloneDatabase(): Promise<IsolatedCloneDatabase> {
  const connectionString = process.env.CLONE_CAMPAIGN_TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "CLONE_CAMPAIGN_TEST_DATABASE_URL is required; use a disposable PostgreSQL cluster, never DATABASE_URL",
    );
  }

  const client = new Client({ connectionString });
  await client.connect();
  const schemaName = `clone_campaign_test_${randomUUID().replaceAll("-", "")}`;
  const quotedSchema = quoteIdentifier(schemaName);

  try {
    await client.query(`CREATE SCHEMA ${quotedSchema}`);
    await client.query(`SET search_path TO ${quotedSchema}`);
    await client.query(renderIsolatedSchema());

    const isolatedDatabase = drizzle(client, { schema }) as unknown as typeof applicationDatabase;
    return {
      db: isolatedDatabase,
      client,
      schemaName,
      close: async () => {
        try {
          await client.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
        } finally {
          await client.end();
        }
      },
    };
  } catch (error) {
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
    } finally {
      await client.end();
    }
    throw error;
  }
}