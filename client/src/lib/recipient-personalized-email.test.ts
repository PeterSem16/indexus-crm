import test from "node:test";
import assert from "node:assert/strict";
import { preserveRecipientFields, recipientContext, renderRecipientDraft, editRecipientDraft, sendRecipientCopies } from "./recipient-personalized-email";

const people = [
  { id: "a", email: "anna@example.test", firstName: "Anna", lastName: "Nováková", titleBefore: "MUDr.", titleAfter: "" },
  { id: "b", email: "peter@example.test", firstName: "Peter", lastName: "Novák", titleBefore: "Ing.", titleAfter: "PhD." },
];
const base: { clinic: any; contact: any; hospital: any } = { clinic: { id: "clinic-parent", clinicName: "Clinic", doctorFirstName: "Primary", doctorLastName: "Doctor", email: "clinic@example.test" },
  contact: { id: "clinic-parent", firstName: "Primary", lastName: "Doctor" }, hospital: { id: "hospital-parent", name: "Hospital" } };
const resolve = (email: string) => (token: string) => {
  const ctx = recipientContext(base, email, people);
  const values: Record<string, string> = {
    "{{clinic.doctorFirstName}}": ctx.clinic.doctorFirstName,
    "{{clinic.doctorFullName}}": [ctx.clinic.doctorTitle, ctx.clinic.doctorFirstName, ctx.clinic.doctorLastName, ctx.clinic.doctorTitleAfter].filter(Boolean).join(" "),
    "{{clinic.doctorSalutationFull}}": ctx.clinic.doctorFirstName === "Anna" ? "Vážená pani" : "Vážený pán",
    "{{clinic.email}}": ctx.clinic.email,
  };
  return values[token] ?? token;
};

test("recipient variables survive eager template resolution, including delayed personnel loading", () => {
  const source = "{{clinic.doctorSalutationFull}} {{clinic.doctorFullName}} — {{clinic.name}}";
  const draft = preserveRecipientFields(source, value => value.replace("{{clinic.name}}", "Clinic").replace(/{{[^}]+}}/g, ""));
  assert.equal(renderRecipientDraft(draft, resolve("ANNA@example.test")), "Vážená pani MUDr. Anna Nováková — Clinic");
  assert.equal(renderRecipientDraft(draft, resolve("peter@example.test")), "Vážený pán Ing. Peter Novák PhD. — Clinic");
});
test("recipient context changes names but never institution identity or unrelated data", () => {
  const ctx = recipientContext(base, " anna@example.test ", people);
  assert.equal(ctx.contact.id, base.contact.id);
  assert.equal(ctx.clinic.id, base.clinic.id);
  assert.equal(ctx.clinic.clinicName, "Clinic");
  assert.equal(ctx.hospital.id, base.hospital.id);
  assert.equal(ctx.hospital.contactPerson, "MUDr. Anna Nováková");
  assert.equal(base.clinic.doctorFirstName, "Primary");
  assert.equal(recipientContext(base, "clinic@example.test", people), base);
});
test("ambiguous shared email identities fail explicitly", () => {
  assert.throws(() => recipientContext(base, people[0].email, [people[0], { ...people[1], email: people[0].email }]), /ambiguous/);
});
test("editing ordinary text preserves personalized fields; manual name edits stay literal", () => {
  const draft = "{{clinic.doctorFullName}}\nOriginal text";
  const modified = editRecipientDraft(draft, "MUDr. Anna Nováková\nUpdated text", resolve("anna@example.test"));
  assert.equal(modified, "{{clinic.doctorFullName}}\nUpdated text");
  assert.equal(renderRecipientDraft(modified, resolve("peter@example.test")), "Ing. Peter Novák PhD.\nUpdated text");
  assert.equal(editRecipientDraft(draft, "My manual greeting\nOriginal text", resolve("anna@example.test")), "My manual greeting\nOriginal text");
});
test("HTML recipient values are escaped without changing static text", () => {
  const html = renderRecipientDraft("<b>{{clinic.doctorFirstName}}</b> static Anna", () => 'A<&"');
  assert.equal(html, '<b>A<&"</b> static Anna');
  assert.equal(renderRecipientDraft("<b>{{clinic.doctorFirstName}}</b>", () => 'A<&"', true), "<b>A&lt;&amp;&quot;</b>");
});
test("multiple recipients receive independent, deduplicated personalized copies", async () => {
  const sent: Array<{ to: string[]; body: string }> = [], confirmed: string[] = [];
  const draft = "{{clinic.doctorSalutationFull}} {{clinic.doctorFullName}}";
  assert.equal(await sendRecipientCopies(["anna@example.test", "ANNA@example.test", "peter@example.test"], async email => {
    sent.push({ to: [email], body: renderRecipientDraft(draft, resolve(email)) });
    return true;
  }, email => confirmed.push(email)), true);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].to.length, 1);
  assert.notEqual(sent[0].body, sent[1].body);
  assert.deepEqual(confirmed, ["ANNA@example.test", "peter@example.test"]);
});
test("partial failures and quota rejection retain only unsent recipients", async () => {
  const confirmed: string[] = [];
  assert.equal(await sendRecipientCopies(["a", "b", "c"], async email => email !== "b", email => confirmed.push(email)), false);
  assert.deepEqual(confirmed, ["a"]);
  await assert.rejects(sendRecipientCopies(["a", "b", "c"], async email => {
    if (email === "b") throw new Error("delivery failed");
  }, () => {}), /delivery failed/);
});
