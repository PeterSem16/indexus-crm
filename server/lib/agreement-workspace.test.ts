import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "../db";
import { DATA_ROOT } from "../config/storage-paths";
import { CLINIC_AGREEMENTS_MIGRATION } from "./clinic-agreement-contract";
import { HOSPITAL_AGREEMENTS_MIGRATION } from "./hospital-agreement-contract";
import { AGREEMENT_WORKSPACE_MIGRATION, parseActivityCursor } from "./agreement-workspace";
import { registerClinicAgreementRoutes,registerHospitalAgreementRoutes } from "./clinic-agreement-routes";

test("private version chains, retained audit and administrative file purge for both facility types",async t=>{
  await pool.query(CLINIC_AGREEMENTS_MIGRATION);
  await pool.query(HOSPITAL_AGREEMENTS_MIGRATION);
  await pool.query(AGREEMENT_WORKSPACE_MIGRATION);
  await pool.query(AGREEMENT_WORKSPACE_MIGRATION);
  const admin=randomUUID(),manager=randomUUID(),foreign=randomUUID(),agent=randomUUID(),mission=randomUUID(),otherMission=randomUUID();
  const owners={clinic:randomUUID(),hospital:randomUUID()};
  const app=express();app.use(express.json());
  app.use((req:any,_res,next)=>{req.session={user:{id:req.get("x-fixture-user") || "missing"}};next();});
  registerClinicAgreementRoutes(app,(_req:any,_res:any,next:any)=>next());
  registerHospitalAgreementRoutes(app,(_req:any,_res:any,next:any)=>next());
  const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  const uploaded=new Set<string>();
  const api=(entity:string,suffix:string,user=admin,init:RequestInit={})=>fetch(`${base}/api/${entity==="clinic"?"clinics":"hospitals"}/${owners[entity as keyof typeof owners]}${suffix}`,{...init,headers:{"x-fixture-user":user,...init.headers}});
  const json=(method:string,body:object)=>({method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const upload=(entity:string,fields:Record<string,string>={},user=admin)=>{
    const form=new FormData();form.set("file",new Blob(["%PDF-1.4\nfixture\n"],{type:"application/pdf"}),"fixture.pdf");form.set("title","Fixture contract");
    for(const [key,value]of Object.entries(fields))form.set(key,value);
    return api(entity,"/agreements",user,{method:"POST",body:form});
  };
  try{
    for(const [id,role,countries]of [[admin,"admin",[]],[manager,"manager",["SK"]],[foreign,"manager",["CZ"]],[agent,"user",["SK"]]]){
      await pool.query(`INSERT INTO users(id,username,email,full_name,password_hash,role,assigned_countries)
        VALUES($1::varchar,$1::text,$2,'Workspace test','not-a-password',$3,$4)`,[id,`${id}@fixture.invalid`,role,countries]);
    }
    await pool.query("INSERT INTO clinics(id,name,country_code) VALUES($1,'Workspace test','SK')",[owners.clinic]);
    await pool.query("INSERT INTO hospitals(id,name,country_code) VALUES($1,'Workspace test','SK')",[owners.hospital]);
    for(const id of [mission,otherMission]) await pool.query("INSERT INTO campaigns(id,name) VALUES($1,'Workspace test')",[id]);
    await pool.query("INSERT INTO campaign_agents(campaign_id,user_id) VALUES($1,$2)",[mission,agent]);
    for(const entity of ["clinic","hospital"] as const)await t.test(entity,async()=>{
      assert.equal((await api(entity,"/agreements",foreign)).status,403);
      const first=await upload(entity);assert.equal(first.status,201);const root=await first.json();
      assert.equal(root.groupId,root.id);assert.equal(root.version,1);
      assert.equal((await api(entity,"/agreements",manager)).status,200);
      assert.equal((await api(entity,`/agreements/${root.id}/file`,manager,json("DELETE",{reason:"no"}))).status,403);
      assert.equal((await api(entity,`/agreements/${root.id}/archive`,manager,json("POST",{reason:"no"}))).status,403);
      assert.equal((await api(entity,`/agreements/${root.id}`,admin,{method:"DELETE"})).status,404,"legacy destructive endpoint removed");
      assert.equal((await upload(entity,{parentId:root.id})).status,400,"version reason required");
      assert.equal((await upload(entity,{parentId:owners[entity],reason:"wrong"})).status,404);
      const concurrent=await Promise.all([upload(entity,{parentId:root.id,reason:"A"}),upload(entity,{parentId:root.id,reason:"B"})]);
      for(const response of concurrent)assert.equal(response.status,201);
      const versions=await Promise.all(concurrent.map(r=>r.json()));
      assert.deepEqual(versions.map(r=>r.version).sort(),[2,3]);
      assert.ok(versions.every(r=>r.groupId===root.id));
      const listing=await(await api(entity,"/agreements")).json();assert.equal(listing.canDelete,true);assert.equal(listing.agreements.length,3);
      const preview=await api(entity,`/agreements/${root.id}/preview`);assert.equal(preview.status,200);assert.equal(preview.headers.get("content-type"),"application/pdf");assert.match(await preview.text(),/^%PDF/);
      const row=(await pool.query(`SELECT storage_key FROM ${entity}_agreements WHERE id=$1`,[root.id])).rows[0];
      const original=path.join(path.dirname(DATA_ROOT),`private-${entity}-agreements`,row.storage_key);
      uploaded.add(original);assert.ok((await fs.stat(original)).isFile());
      assert.equal((await api(entity,`/agreements/${root.id}/file`,admin,json("DELETE",{}))).status,400);
      assert.equal((await api(entity,`/agreements/${root.id}/file`,admin,json("DELETE",{reason:"Duplicate scan"}))).status,204);
      await assert.rejects(fs.stat(original),{code:"ENOENT"});
      assert.equal((await api(entity,`/agreements/${root.id}/download`)).status,410);
      assert.equal((await api(entity,`/agreements/${root.id}/preview`)).status,410);
      assert.equal((await api(entity,`/agreements/${root.id}/file`,admin,json("DELETE",{reason:"Retry"}))).status,204);
      const tomb=(await(await api(entity,"/agreements")).json()).agreements.find((r:any)=>r.id===root.id);
      assert.equal(tomb.fileName,"fixture.pdf");assert.equal(tomb.fileDeleteReason,"Duplicate scan");assert.ok(tomb.fileDeletedAt);assert.ok(tomb.filePurgedAt);
      assert.equal((await api(entity,`/agreements/${versions[0].id}/archive`,admin,json("POST",{reason:"Replacement"}))).status,204);
      assert.ok((await(await api(entity,"/agreements")).json()).agreements.every((r:any)=>r.archivedAt));
      assert.equal((await upload(entity,{parentId:root.id,reason:"Archived"})).status,409);
      assert.equal((await api(entity,`/agreements/${root.id}`,admin,json("PATCH",{title:"Blocked"}))).status,409);
      const fk=entity==="clinic"?"clinic_id":"hospital_id";
      for(const m of [mission,otherMission]){
        const cc=(await pool.query(`INSERT INTO campaign_contacts(campaign_id,${fk},contact_type) VALUES($1,$2,$3) RETURNING id`,[m,owners[entity],entity])).rows[0];
        await pool.query(`INSERT INTO campaign_contact_history(campaign_contact_id,user_id,action,metadata) VALUES($1,$2,'status_list_confirmed',$3)`,[cc.id,admin,JSON.stringify({itemLabel:m===mission?"Allowed":"Hidden",password:"NEVER EXPOSE"})]);
      }
      const history=await(await api(entity,"/record-activity",agent)).json();
      assert.ok(Array.isArray(history.events),JSON.stringify(history));
      assert.ok(history.events.some((r:any)=>r.module==="Nexus Pulse"&&r.details.itemLabel==="Allowed"));
      const allowedMission = (await pool.query("SELECT name FROM campaigns WHERE id=$1",[mission])).rows[0].name;
      assert.ok(history.events.some((r:any)=>r.module==="Nexus Pulse"&&r.details.campaignName===allowedMission),"authorized Mission name replaces its opaque ID");
      assert.ok(history.events.some((r:any)=>r.details.statusListItemLabel==="Allowed"),"historical step labels are preserved");
      assert.ok(!JSON.stringify(history).includes("Hidden"));assert.ok(!JSON.stringify(history).includes("NEVER EXPOSE"));
      const all=await(await api(entity,"/record-activity")).json();
      assert.ok(all.events.some((r:any)=>r.action==="agreement_file_deleted"));
      assert.equal(all.events.filter((r:any)=>r.action==="agreement_file_deleted").length,1,"idempotent purge audit");
      assert.equal((await api(entity,"/record-activity?before=bad")).status,400);
    });
    assert.throws(()=>parseActivityCursor("bad"));
  }finally{
    for(const entity of ["clinic","hospital"]as const){
      const rows=await pool.query(`SELECT storage_key FROM ${entity}_agreements WHERE ${entity}_id=$1`,[owners[entity]]);
      rows.rows.forEach(r=>uploaded.add(path.join(path.dirname(DATA_ROOT),`private-${entity}-agreements`,r.storage_key)));
      await pool.query("DELETE FROM activity_logs WHERE entity_type=$1 AND entity_id=$2",[entity,owners[entity]]);
    }
    await pool.query("DELETE FROM campaign_contact_history WHERE campaign_contact_id IN(SELECT id FROM campaign_contacts WHERE campaign_id=ANY($1))",[[mission,otherMission]]);
    await pool.query("DELETE FROM campaign_contacts WHERE campaign_id=ANY($1)",[[mission,otherMission]]);
    await pool.query("DELETE FROM campaign_agents WHERE campaign_id=ANY($1)",[[mission,otherMission]]);
    await pool.query("DELETE FROM campaigns WHERE id=ANY($1)",[[mission,otherMission]]);
    await pool.query("DELETE FROM clinics WHERE id=$1",[owners.clinic]);await pool.query("DELETE FROM hospitals WHERE id=$1",[owners.hospital]);
    await pool.query("DELETE FROM users WHERE id=ANY($1)",[[admin,manager,agent,foreign]]);
    for(const file of uploaded)await fs.unlink(file).catch(()=>{});
    await new Promise<void>(r=>server.close(()=>r()));await pool.end();
  }
});
