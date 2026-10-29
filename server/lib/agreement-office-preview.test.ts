import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { Document,Packer,Paragraph } from "docx";
import { agreementPreviewPdf } from "./agreement-workspace";
import { pool } from "../db";

test("private DOCX and DOC previews contain actual source text in converted PDF",async()=>{
  const execute=promisify(execFile),dir=await fs.mkdtemp(path.join(os.tmpdir(),"agreement-office-test-"));
  try {
    const source=path.join(dir,"agreement.docx");
    await fs.writeFile(source,await Packer.toBuffer(new Document({sections:[{children:[new Paragraph("Agreement conversion verification 8472")]}]})));
    for(const extension of ["docx","doc"]) {
      if(extension==="doc")await execute("libreoffice",[`-env:UserInstallation=file://${path.join(dir,"export-profile")}`,"--headless","--convert-to","doc:MS Word 97","--outdir",dir,source],{timeout:45000});
      const bytes=await agreementPreviewPdf(path.join(dir,`agreement.${extension}`),extension==="doc"?"application/msword":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",dir);
      assert.equal(bytes.subarray(0,5).toString(),"%PDF-");
      const output=path.join(dir,`${extension}.pdf`);await fs.writeFile(output,bytes);
      const text=await execute("pdftotext",[output,"-"],{timeout:10000});
      assert.match(text.stdout,/Agreement conversion verification 8472/);
      assert.ok(!(await fs.readdir(dir)).some(name=>name.startsWith(".preview-")),"temporary private conversions cleaned");
    }
  } finally {await fs.rm(dir,{recursive:true,force:true});await pool.end();}
});
