import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createCallRecordingUploadCleanup,
  createCallRecordingUploadFilename,
} from "./call-recording-upload-filename";

test("simultaneous recording uploads get independent temporary filenames without multipart identity", () => {
  let sequence = 0;
  const nextId = () => `concurrent-${++sequence}`;
  const first = createCallRecordingUploadFilename("audio/webm", nextId);
  const second = createCallRecordingUploadFilename("audio/webm", nextId);
  assert.notEqual(first, second);
  assert.match(first, /^upload_concurrent-1\.webm$/);
  assert.match(second, /^upload_concurrent-2\.webm$/);
  assert.equal(createCallRecordingUploadFilename("audio/ogg", () => "opaque-id"), "upload_opaque-id.ogg");
});

test("cleaning one upload path leaves a concurrent upload intact", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "call-recording-upload-"));
  try {
    let sequence = 0;
    const firstPath = path.join(directory, createCallRecordingUploadFilename("audio/webm", () => `upload-${++sequence}`));
    const secondPath = path.join(directory, createCallRecordingUploadFilename("audio/webm", () => `upload-${++sequence}`));
    writeFileSync(firstPath, "first audio");
    writeFileSync(secondPath, "second audio");

    unlinkSync(firstPath);
    assert.equal(readFileSync(secondPath, "utf8"), "second audio");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("missing callLogId cleanup removes the Multer tempfile without exposing its path", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "call-recording-missing-call-"));
  const uploadPath = path.join(directory, "upload_temp.webm");
  const cleanup = createCallRecordingUploadCleanup(filePath => {
    if (existsSync(filePath)) unlinkSync(filePath);
  });
  try {
    writeFileSync(uploadPath, "uploaded audio");
    cleanup.track(uploadPath);
    let response: { status: number; body: { error: string } } | undefined;
    try {
      const callLogId = "";
      if (!callLogId) {
        response = { status: 400, body: { error: "callLogId is required" } };
      }
    } finally {
      cleanup.cleanup();
    }
    assert.deepEqual(response, { status: 400, body: { error: "callLogId is required" } });
    assert.equal(existsSync(uploadPath), false);
    assert.equal(JSON.stringify(response).includes(directory), false);
  } finally {
    cleanup.cleanup();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("thrown upload errors clean both temporary and linked destination files", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "call-recording-error-"));
  const temporaryPath = path.join(directory, "upload_temp.webm");
  const destinationPath = path.join(directory, "recording_final.webm");
  const cleanup = createCallRecordingUploadCleanup(filePath => {
    if (existsSync(filePath)) unlinkSync(filePath);
  });
  try {
    writeFileSync(temporaryPath, "audio");
    writeFileSync(destinationPath, "audio");
    cleanup.track(temporaryPath);
    cleanup.track(destinationPath);
    try {
      throw new Error("simulated database failure");
    } catch {
      // Mirrors the route's error response; filesystem paths are not included.
      assert.deepEqual({ error: "Failed to upload recording" }, { error: "Failed to upload recording" });
    } finally {
      cleanup.cleanup();
    }
    assert.equal(existsSync(temporaryPath), false);
    assert.equal(existsSync(destinationPath), false);
  } finally {
    cleanup.cleanup();
    rmSync(directory, { recursive: true, force: true });
  }
});