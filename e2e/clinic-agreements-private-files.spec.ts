import { test, expect } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("unauthenticated Vite filesystem requests cannot read private agreement documents", async ({ request }) => {
  const publicFixture = await request.get(`/@fs${resolve(root, "client/test-fixtures/clinic-agreements.html")}`);
  expect(publicFixture.status()).toBe(200);

  const privateRoot = resolve(root, "private-clinic-agreements");
  const privatePath = resolve(privateRoot, `release-check-${randomUUID()}.txt`);
  const marker = "AGREEMENT_PRIVATE_DELIVERY_TEST_ONLY";
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await writeFile(privatePath, marker, { flag: "wx", mode: 0o600 });
  try {
    const privateDocument = await request.get(`/@fs${privatePath}`);
    expect(privateDocument.status()).toBe(403);
    expect(await privateDocument.text()).not.toContain(marker);

    // A rejected private-file request must not kill the development server.
    const after = await request.get("/test-fixtures/clinic-agreements.html");
    expect(after.status()).toBe(200);
  } finally {
    await unlink(privatePath);
  }
});