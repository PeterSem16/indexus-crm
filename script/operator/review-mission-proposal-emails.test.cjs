const { test } = require("node:test");
const assert = require("node:assert/strict");
const { reviewProposalBatch, fingerprint, MISSION, SUBJECT, SQL } = require("./review-mission-proposal-emails.cjs");
function records() {
  return Array.from({length:38},(_,i)=>({
    id:`message-${String(i).padStart(2,"0")}`,clinic_id:`clinic-${i%34}`,user_id:"sender",
    subject:SUBJECT,status:"sent",campaign_id:null,provider:null,external_id:null,
    metadata:JSON.stringify({contactType:"clinic",sentVia:"ms365"}),country_code:"SK",country_allowed:true,
    sent_at:null,recorded_at:"2026-09-23T10:05:03.998123Z",
    contact_ids:[`contact-${i%34}`],mission_ids:[MISSION],review_id:null,conflicting_review:false,
  }));
}
function fixture(rows=records(), failAudit=false) {
  const calls=[];
  return { calls, query:async(sql,params)=>{
    calls.push({sql,params});
    if(sql.startsWith(SQL))return {rows};
    if(sql.startsWith("UPDATE"))return {rows:[{id:params[0]}]};
    if(sql.startsWith("INSERT")&&failAudit)throw Error("audit unavailable");
    return {rows:[]};
  }};
}
test("preview is read-only, scoped, count-checked and preserves unknown sending time",async()=>{
  const db=fixture(),result=await reviewProposalBatch(db);
  assert.equal(result.records,38);assert.equal(result.clinics,34);assert.equal(result.sendingTimeUnknown,38);
  assert.equal(result.fingerprint,fingerprint(records()));
  assert.match(db.calls[0].sql,/READ ONLY/);
  assert.equal(db.calls.some(c=>/^(UPDATE|INSERT|COMMIT)/.test(c.sql)),false);
});
test("approved batch updates only Mission and atomically writes one review per record",async()=>{
  const rows=records(),db=fixture(rows);
  assert.equal((await reviewProposalBatch(db,{apply:true,expectedFingerprint:fingerprint(rows)})).updates,38);
  const updates=db.calls.filter(c=>c.sql.startsWith("UPDATE"));
  assert.equal(updates.length,38);assert.ok(updates.every(c=>/SET campaign_id=\$2/.test(c.sql)&&!c.sql.includes("sent_at")));
  const audits=db.calls.filter(c=>c.sql.startsWith("INSERT"));
  assert.equal(audits.length,38);
  const meta=JSON.parse(audits[0].params[3]);
  assert.equal(meta.originalSentAt,null);assert.equal(meta.timestampKind,"recorded");
  assert.equal(meta.originalRecordedAt,rows[0].recorded_at);
  assert.equal(db.calls.at(-1).sql,"COMMIT");
});
test("scope, transport, countries, dates, duplicate enrollments and fingerprints fail closed",async()=>{
  const mutations=[
    rows=>rows.pop(),rows=>rows[0].clinic_id="different",
    rows=>rows[0].country_allowed=false,rows=>rows[0].mission_ids.push("other"),
    rows=>rows[0].contact_ids.push("duplicate"),rows=>rows[0].subject="Information",
    rows=>rows[0].metadata='{"contactType":"clinic","sentVia":"simulated"}',
    rows=>rows[0].sent_at="2026-09-23T10:05:00Z",rows=>rows[0].conflicting_review=true,
  ];
  for(const mutate of mutations){
    const rows=records(),hash=fingerprint(rows);mutate(rows);const db=fixture(rows);
    await assert.rejects(reviewProposalBatch(db,{apply:true,expectedFingerprint:hash}));
    assert.equal(db.calls.some(c=>/^(UPDATE|INSERT)/.test(c.sql)),false);
    assert.equal(db.calls.at(-1).sql,"ROLLBACK");
  }
  const db=fixture();await assert.rejects(reviewProposalBatch(db,{apply:true,expectedFingerprint:"0".repeat(64)}),/fingerprint/);
});
test("retry is idempotent and a failed audit rolls back the whole batch",async()=>{
  const rows=records(),hash=fingerprint(rows);
  const applied=rows.map(row=>({...row,campaign_id:MISSION,review_id:`review-${row.id}`}));
  const db=fixture(applied);
  assert.equal((await reviewProposalBatch(db,{apply:true,expectedFingerprint:hash})).status,"already_applied");
  assert.equal(db.calls.some(c=>/^(UPDATE|INSERT)/.test(c.sql)),false);
  const failure=fixture(records(),true);
  await assert.rejects(reviewProposalBatch(failure,{apply:true,expectedFingerprint:hash}),/audit unavailable/);
  assert.equal(failure.calls.at(-1).sql,"ROLLBACK");
});
