import type { Request, Response } from "express";
import { parseWebhookBatch, type BulkGateWebhookData } from "./bulkgate";

interface CallbackDependencies {
  verifyToken: (token: string | undefined) => boolean;
  processRecord: (record: BulkGateWebhookData) => Promise<void>;
}

/** Validate the complete callback before storing anything. Never log its token/body. */
export function createBulkGateCallback({ verifyToken, processRecord }: CallbackDependencies) {
  return async (req: Request, res: Response) => {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ received: false });
    }
    const payload = req.method === "GET" ? req.query : req.body;
    const candidate = req.query.token || (!Array.isArray(payload) && payload?.token);
    const token = typeof candidate === "string" ? candidate : undefined;
    if (!verifyToken(token)) {
      console.warn("[BulkGate DLR] Invalid or missing token");
      return res.status(403).json({ received: false, error: "Invalid token" });
    }
    let records: BulkGateWebhookData[];
    try {
      records = parseWebhookBatch(payload);
    } catch {
      console.warn("[BulkGate DLR] Invalid callback payload");
      return res.status(400).json({ received: false, error: "bulkgate_invalid_payload" });
    }
    console.log(`[BulkGate DLR] Accepted records=${records.length} inbox=${records.filter(r => r.type === "inbox").length}`);
    try {
      for (const record of records) await processRecord(record);
      return res.status(200).json({ received: true, processed: records.length });
    } catch {
      // Do not falsely acknowledge failed persistence and suppress provider retries.
      console.error("[BulkGate DLR] Callback processing failed");
      return res.status(503).json({ received: false, error: "bulkgate_callback_processing_failed" });
    }
  };
}
