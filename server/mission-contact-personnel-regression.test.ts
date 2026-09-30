import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as schema from "../shared/schema";
import * as orm from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const source = readFileSync(process.env.MISSION_CONTACT_ROUTES_SOURCE || "server/routes.ts", "utf8");
const ast = ts.createSourceFile("routes.ts", source, ts.ScriptTarget.Latest, true);
let handlerSource = "";
let loaderSource = "";
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "loadFacilityPersonReferralIds") loaderSource = node.getText(ast);
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
    && node.expression.name.text === "get"
    && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])
    && node.arguments[0].text === "/api/campaigns/:id/contacts") {
    handlerSource = node.arguments[node.arguments.length - 1].getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(handlerSource);

for (const role of ["admin", "user"]) {
  for (const metadataFails of [false, true]) {
  test(`real contacts handler returns facilities for ${role}, metadata failure: ${metadataFails}`, async () => {
    const fixture = [
      { id: "cc-clinic", contactType: "clinic", clinicId: "clinic-a" },
      { id: "cc-hospital", contactType: "hospital", hospitalId: "hospital-a" },
      { id: "cc-clinic-again", contactType: "clinic", clinicId: "clinic-a" },
      { id: "cc-hospital-again", contactType: "hospital", hospitalId: "hospital-a" },
      { id: "cc-person", contactType: "collaborator", collaboratorId: "person-b" },
      { id: "cc-customer", contactType: "customer", customerId: "customer-a" },
      { id: "cc-fallback", contactType: "clinic", customerId: "customer-a" },
    ];
    const assignments = [
      { personId: "person-a", entityType: "clinic", entityId: "clinic-a" },
      { personId: "person-a", entityType: "hospital", entityId: "hospital-a" },
    ];
    const errors: unknown[] = [];
    const selectedTables: unknown[] = [];
    const context = {
      ...schema, ...orm,
      console: { error: (...args: unknown[]) => errors.push(args) },
      canAgentReadCampaignByWorkspaceCountry: () => true,
      parseCampaignContactVisibility: () => "all",
      includePersonReferrals: () => false,
      normalizeCollaboratorPriorityCity: () => ({ city: null, countryCode: null }),
      storage: {
        getCampaign: async () => ({ id: "mission", settings: "{}", countryCodes: ["SK"] }),
        getAgentWorkspaceAccess: async () => [{ countryCode: "SK" }],
        getCampaignContacts: async () => fixture,
        getClinic: async () => ({ id: "clinic-a", name: "Clinic" }),
        getHospital: async () => ({ id: "hospital-a", name: "Hospital" }),
      },
      db: {
        select: (fields?: Record<string, unknown>) => {
          let table: unknown;
          const chain: any = {
            from(value: unknown) { table = value; selectedTables.push(value); return chain; },
            where() { return chain; }, orderBy() { return chain; }, limit() { return chain; },
            then(resolve: (rows: unknown[]) => unknown) {
              if (metadataFails && fields?.firstName) throw new Error("Simulated optional metadata query failure");
              return Promise.resolve(resolve(
                table === schema.campaignAgents ? [{ id: "agent-link" }]
                : table === schema.contactAssignments ? assignments
                : table === schema.clinics ? [{ id: "clinic-a", name: "Clinic" }]
                : table === schema.hospitals ? [{ id: "hospital-a", name: "Hospital" }]
                : table === schema.customers ? [{ id: "customer-a", firstName: "Customer" }]
                : table === schema.collaborators && !fields ? [{ id: "person-b", firstName: "Collaborator" }]
                : table === schema.collaborators ? [{
                  id: "person-a", isActive: true, firstName: "Jana", lastName: "Testová",
                  hospitalIds: [], clinicIds: [], phone: "0905123456", email: "test@example.org",
                }] : [],
              ));
            },
          };
          return chain;
        },
      },
    };
    const code = ts.transpileModule(`globalThis.handler = ${handlerSource}`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, context);
    let status = 200;
    let body: any;
    const res = { status(value: number) { status = value; return res; }, json(value: unknown) { body = value; return res; } };
    await (context as any).handler({ query: { agentView: "true" }, params: { id: "mission" }, session: { user: { id: "agent", role } } }, res);
    assert.equal(status, 200, errors.map((args: any) => String(args[1]?.stack || args[1])).join("\n"));
    assert.equal(body.length, 7);
    assert.equal(body[0].clinic.id, "clinic-a");
    assert.equal(body[1].hospital.id, "hospital-a");
    assert.equal(body[2].clinic.id, "clinic-a");
    assert.equal(body[3].hospital.id, "hospital-a");
    assert.equal(body[4].collaborator.id, "person-b");
    assert.equal(body[5].customer.id, "customer-a");
    assert.equal(body[6].customer.id, "customer-a");
    assert.equal(selectedTables.filter(table => table === schema.clinics).length, 1);
    assert.equal(selectedTables.filter(table => table === schema.hospitals).length, 1);
    assert.equal(selectedTables.filter(table => table === schema.customers).length, 1);
    if (metadataFails) {
      assert.equal(body[0].personnelSearch.length, 0);
      assert.equal(body[1].personnelSearch.length, 0);
      assert.equal(errors.length, 1);
    } else {
      assert.equal(body[0].personnelSearch[0].name, "Jana Testová");
      assert.equal(body[1].personnelSearch[0].name, "Jana Testová");
      assert.equal(errors.length, 0);
    }
  });
  }
}

test("person referral SQL uses text arrays rather than PostgreSQL record casts", async () => {
  const queries: string[] = [];
  const context = {
    ...schema, ...orm,
    db: {
      select: () => {
        const chain: any = {
          from() { return chain; }, innerJoin() { return chain; },
          where(condition: any) {
            queries.push(new PgDialect().sqlToQuery(condition).sql);
            return Promise.resolve([]);
          },
        };
        return chain;
      },
    },
  };
  vm.runInNewContext(ts.transpileModule(`${loaderSource}; globalThis.load = loadFacilityPersonReferralIds;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  await (context as any).load(["clinic-a", "clinic-b"], ["hospital-a", "hospital-b"]);
  assert.match(queries[1], /&& ARRAY\[/);
  assert.doesNotMatch(queries[1], /&& \([^)]*\)::text\[\]/);
});