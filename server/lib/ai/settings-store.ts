import type { Pool, PoolClient } from "pg";
import type { AIPersistedSettings, AIVerification } from "../../../shared/ai-settings";
import { AISettingsError, DEFAULT_AI_SETTINGS, assertVersion, parseSettings } from "./settings-policy";
import { applyAIAdminSnapshot } from "./admin-runtime";

export type AIStored = { version: number; value: AIPersistedSettings;
  gatewayCheck: AIVerification | null; openaiCheck: AIVerification | null };
const decode = (row: any): AIStored => ({
  version: row.version, value: parseSettings(row.value), gatewayCheck: row.gateway_check, openaiCheck: row.openai_check,
});
export class AISettingsStore {
  constructor(readonly pool: Pool) {}
  async initialize() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(1991202611)");
      await client.query(`CREATE TABLE IF NOT EXISTS ai_router_configuration (
        singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
        version integer NOT NULL DEFAULT 1 CHECK (version > 0),
        value jsonb NOT NULL, gateway_check jsonb, openai_check jsonb,
        updated_at timestamptz NOT NULL DEFAULT now())`);
      await client.query(`CREATE TABLE IF NOT EXISTS ai_router_configuration_audit (
        id bigserial PRIMARY KEY, actor_id varchar(128) NOT NULL, action varchar(50) NOT NULL,
        version integer NOT NULL, changes jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
      await client.query(`INSERT INTO ai_router_configuration(singleton,value)
        VALUES(true,$1::jsonb) ON CONFLICT(singleton) DO NOTHING`, [JSON.stringify(DEFAULT_AI_SETTINGS)]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  async read(client: Pick<PoolClient, "query"> = this.pool, lock = false): Promise<AIStored> {
    const result = await client.query("SELECT version,value,gateway_check,openai_check FROM ai_router_configuration WHERE singleton=true" +
      (lock ? " FOR UPDATE" : ""));
    if (!result.rows[0]) throw new AISettingsError("settings_unavailable", 503);
    const state = decode(result.rows[0]);
    applyAIAdminSnapshot(state.version, state.value);
    return state;
  }
  async audit() {
    const result = await this.pool.query(`SELECT id::text,actor_id AS "actorId",action,version,created_at AS "createdAt"
      FROM ai_router_configuration_audit ORDER BY id DESC LIMIT 20`);
    return result.rows;
  }
  async mutate(expected: unknown, actor: string, action: string,
    change: (state: AIStored) => AIPersistedSettings) {
    assertVersion(expected);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await this.read(client, true);
      if (current.version !== expected) throw new AISettingsError("version_conflict", 409);
      const value = parseSettings(change(current)), version = current.version + 1;
      const gatewayChanged = JSON.stringify(value.gateway) !== JSON.stringify(current.value.gateway);
      // Route-only changes do not invalidate a Gateway test. settingsVersion is
      // the applicability version; checkedAt always preserves the original test time.
      const carry = (check: AIVerification | null) => check && check.state !== "checking" ?
        { ...check, settingsVersion: version } : null;
      const gatewayCheck = gatewayChanged ? null : carry(current.gatewayCheck);
      await client.query(`UPDATE ai_router_configuration SET version=$1,value=$2::jsonb,gateway_check=$3::jsonb,
        openai_check=$4::jsonb,updated_at=now() WHERE singleton=true`,
      [version, JSON.stringify(value), JSON.stringify(gatewayCheck), JSON.stringify(carry(current.openaiCheck))]);
      await client.query(`INSERT INTO ai_router_configuration_audit(actor_id,action,version,changes)
        VALUES($1,$2,$3,$4::jsonb)`, [actor, action, version, JSON.stringify(value)]);
      await client.query("COMMIT");
      applyAIAdminSnapshot(version, value);
      return { version, value, gatewayCheck, openaiCheck: carry(current.openaiCheck) };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  async recordCheck(expected: number, actor: string, check: AIVerification) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await this.read(client, true);
      if (current.version !== expected) throw new AISettingsError("version_conflict", 409);
      const column = check.kind === "openai" ? "openai_check" : "gateway_check";
      await client.query(`UPDATE ai_router_configuration SET ${column}=$1::jsonb WHERE singleton=true`, [JSON.stringify(check)]);
      if (check.state !== "checking") await client.query(
        `INSERT INTO ai_router_configuration_audit(actor_id,action,version,changes) VALUES($1,$2,$3,$4::jsonb)`,
        [actor, "test_" + check.kind, expected, JSON.stringify(check)]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}
