import { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

export interface UdidRecord {
  id: string;
  udid: string;
  product: string;
  version: string;
  serial: string;
  status: "pending" | "approved" | "rejected";
  note: string;
  collectedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "uploads");
const UDID_FILE = path.join(DATA_DIR, "udid-registrations.json");

function loadUdids(): UdidRecord[] {
  try {
    if (fs.existsSync(UDID_FILE)) {
      return JSON.parse(fs.readFileSync(UDID_FILE, "utf-8"));
    }
  } catch {}
  return [];
}

function saveUdids(records: UdidRecord[]) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(UDID_FILE, JSON.stringify(records, null, 2));
}

function extractPlistFromBody(raw: Buffer): string {
  const str = raw.toString("utf-8");
  const plistStart = str.indexOf("<?xml");
  if (plistStart !== -1) {
    const plistEnd = str.indexOf("</plist>");
    if (plistEnd !== -1) {
      return str.substring(plistStart, plistEnd + "</plist>".length);
    }
  }

  const binaryStr = raw.toString("binary");
  const bStart = binaryStr.indexOf("<?xml");
  if (bStart !== -1) {
    const bEnd = binaryStr.indexOf("</plist>");
    if (bEnd !== -1) {
      return binaryStr.substring(bStart, bEnd + "</plist>".length);
    }
  }

  for (let i = 0; i < raw.length - 5; i++) {
    if (
      raw[i] === 0x3c &&
      raw[i + 1] === 0x3f &&
      raw[i + 2] === 0x78 &&
      raw[i + 3] === 0x6d &&
      raw[i + 4] === 0x6c
    ) {
      const endMarker = Buffer.from("</plist>");
      for (let j = i; j < raw.length - endMarker.length; j++) {
        let found = true;
        for (let k = 0; k < endMarker.length; k++) {
          if (raw[j + k] !== endMarker[k]) {
            found = false;
            break;
          }
        }
        if (found) {
          return raw.subarray(i, j + endMarker.length).toString("utf-8");
        }
      }
    }
  }

  return str;
}

export function registerUdidRoutes(app: Express) {
  app.get("/udid", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>INDEXUS Connect — Register Your iPhone</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #1e293b; border-radius: 16px; padding: 40px 30px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
    .logo { font-size: 28px; font-weight: 700; color: #60a5fa; margin-bottom: 8px; }
    .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
    .steps { text-align: left; margin-bottom: 30px; }
    .step { display: flex; align-items: flex-start; margin-bottom: 16px; }
    .step-num { background: #3b82f6; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; flex-shrink: 0; margin-right: 12px; margin-top: 2px; }
    .step-text { font-size: 15px; line-height: 1.5; color: #cbd5e1; }
    .btn { display: inline-block; background: #3b82f6; color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-size: 18px; font-weight: 600; transition: background 0.2s; }
    .btn:hover { background: #2563eb; }
    .note { margin-top: 20px; font-size: 12px; color: #64748b; line-height: 1.5; }
    .safari-warn { background: #fef3c7; color: #92400e; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 24px; }
    .auto-badge { background: #059669; color: white; display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">INDEXUS Connect</div>
    <div class="subtitle">Register your iPhone to install the app</div>
    <div class="auto-badge">Fully automatic — no technical knowledge needed</div>
    <div class="safari-warn">Please open this page in <strong>Safari</strong></div>
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Tap <strong>"Register My iPhone"</strong> below</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">When prompted, tap <strong>"Allow"</strong></div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">Go to <strong>Settings</strong> &rarr; you will see <strong>"Profile Downloaded"</strong> at the top &rarr; tap <strong>"Install"</strong></div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-text"><strong>Done!</strong> Your device is automatically registered. You will be notified when the app is ready to install.</div>
      </div>
    </div>
    <a href="/udid/enroll" class="btn">Register My iPhone</a>
    <div class="note">This is a one-time registration. Your device information is sent securely and automatically to the administrator. No action needed on your part after step 3.</div>
  </div>
</body>
</html>`);
  });

  app.get("/udid/enroll", (req: Request, res: Response) => {
    const host = req.headers.host || "indexus.cordbloodcenter.com";
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const callbackUrl = `${protocol}://${host}/udid/callback`;
    const payloadUUID = randomUUID().toUpperCase();

    const mobileconfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <dict>
        <key>URL</key>
        <string>${callbackUrl}</string>
        <key>DeviceAttributes</key>
        <array>
            <string>UDID</string>
            <string>PRODUCT</string>
            <string>VERSION</string>
            <string>SERIAL</string>
        </array>
    </dict>
    <key>PayloadOrganization</key>
    <string>Cord Blood Center</string>
    <key>PayloadDisplayName</key>
    <string>INDEXUS Connect</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
    <key>PayloadUUID</key>
    <string>${payloadUUID}</string>
    <key>PayloadIdentifier</key>
    <string>com.cordbloodcenter.udid-enrollment</string>
    <key>PayloadDescription</key>
    <string>Registers your iPhone for INDEXUS Connect app installation.</string>
    <key>PayloadType</key>
    <string>Profile Service</string>
</dict>
</plist>`;

    res.setHeader("Content-Type", "application/x-apple-aspen-config");
    res.setHeader("Content-Disposition", 'attachment; filename="INDEXUSConnect.mobileconfig"');
    res.send(mobileconfig);
  });

  app.post("/udid/callback", (req: Request, res: Response) => {
    try {
      const body = req.body as Buffer;
      console.log(`[UDID] Callback received, body length: ${body.length}, content-type: ${req.headers["content-type"]}`);

      const plistXml = extractPlistFromBody(body);
      console.log(`[UDID] Extracted plist (${plistXml.length} chars): ${plistXml.substring(0, 500)}`);

      let udid = "";
      let product = "";
      let version = "";
      let serial = "";

      const udidMatch = plistXml.match(/<key>UDID<\/key>\s*<string>([^<]+)<\/string>/);
      if (udidMatch) udid = udidMatch[1];

      const productMatch = plistXml.match(/<key>PRODUCT<\/key>\s*<string>([^<]+)<\/string>/);
      if (productMatch) product = productMatch[1];

      const versionMatch = plistXml.match(/<key>VERSION<\/key>\s*<string>([^<]+)<\/string>/);
      if (versionMatch) version = versionMatch[1];

      const serialMatch = plistXml.match(/<key>SERIAL<\/key>\s*<string>([^<]+)<\/string>/);
      if (serialMatch) serial = serialMatch[1];

      if (!udid) {
        const hexMatch = plistXml.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{16}/);
        if (hexMatch) udid = hexMatch[0];
        if (!udid) {
          const hex40 = plistXml.match(/[0-9a-fA-F]{40}/);
          if (hex40) udid = hex40[0];
        }
      }

      if (udid) {
        console.log(`[UDID] SUCCESS - Collected: ${udid} | Product: ${product} | Version: ${version} | Serial: ${serial}`);
        const records = loadUdids();
        const existing = records.find((d) => d.udid === udid);
        if (!existing) {
          records.push({
            id: randomUUID(),
            udid,
            product,
            version,
            serial,
            status: "pending",
            note: "",
            collectedAt: new Date().toISOString(),
          });
          saveUdids(records);
          console.log(`[UDID] Saved to file. Total registrations: ${records.length}`);
        } else {
          console.log(`[UDID] Device already registered (duplicate)`);
        }
      } else {
        console.log("[UDID] FAILED - Could not extract UDID from callback body");
        console.log(`[UDID] Raw body hex (first 500 bytes): ${body.subarray(0, 500).toString("hex")}`);
        console.log(`[UDID] Raw body string (first 500 chars): ${body.toString("utf-8").substring(0, 500)}`);
      }

      const host = req.headers.host || "indexus.cordbloodcenter.com";
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const success = udid ? "true" : "false";
      res.redirect(301, `${protocol}://${host}/udid/result?success=${success}&product=${encodeURIComponent(product)}&version=${encodeURIComponent(version)}`);
    } catch (error: any) {
      console.error("[UDID] Callback error:", error.message, error.stack);
      const host = req.headers.host || "indexus.cordbloodcenter.com";
      const protocol = req.headers["x-forwarded-proto"] || "https";
      res.redirect(301, `${protocol}://${host}/udid/result?success=false&error=server`);
    }
  });

  app.get("/udid/result", (req: Request, res: Response) => {
    const success = req.query.success === "true";
    const product = (req.query.product as string) || "";
    const version = (req.query.version as string) || "";

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>INDEXUS Connect — ${success ? "Registration Complete" : "Registration Issue"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #1e293b; border-radius: 16px; padding: 40px 30px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
    .logo { font-size: 28px; font-weight: 700; color: #60a5fa; margin-bottom: 8px; }
    .icon { font-size: 64px; margin: 20px 0; }
    .title { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    .message { font-size: 15px; color: #94a3b8; line-height: 1.6; margin-bottom: 20px; }
    .device-info { font-size: 13px; color: #64748b; margin-bottom: 16px; }
    .success-box { background: #064e3b; border: 1px solid #059669; border-radius: 10px; padding: 16px; margin: 20px 0; }
    .success-box p { color: #6ee7b7; font-size: 14px; line-height: 1.5; }
    .error-box { background: #7f1d1d; border: 1px solid #dc2626; border-radius: 10px; padding: 16px; margin: 20px 0; }
    .error-box p { color: #fca5a5; font-size: 14px; line-height: 1.5; }
    .cleanup { margin-top: 20px; font-size: 12px; color: #64748b; line-height: 1.6; text-align: left; background: #0f172a; border-radius: 8px; padding: 12px 16px; }
    .cleanup strong { color: #94a3b8; }
    .retry-btn { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">INDEXUS Connect</div>
    ${success ? `
    <div class="icon">&#x2705;</div>
    <div class="title">Registration successful!</div>
    ${product ? `<div class="device-info">${product}${version ? " &middot; iOS " + version : ""}</div>` : ""}
    <div class="success-box">
      <p>Your iPhone has been <strong>automatically registered</strong>. The administrator will add your device and you will be notified when the app is ready to install.</p>
    </div>
    <div class="message">There is nothing else you need to do.</div>
    <div class="cleanup">
      <strong>Optional cleanup:</strong> You can remove the registration profile from<br>
      <strong>Settings &rarr; General &rarr; VPN & Device Management</strong><br>
      It is no longer needed.
    </div>
    ` : `
    <div class="icon">&#x26A0;&#xFE0F;</div>
    <div class="title">Registration could not be completed</div>
    <div class="error-box">
      <p>We could not read your device information. This can happen if the profile was not fully installed, or if it was cancelled.</p>
    </div>
    <div class="message">Please try again — make sure to tap "Allow" and then install the profile in Settings.</div>
    <a href="/udid" class="retry-btn">Try Again</a>
    `}
  </div>
</body>
</html>`);
  });

  app.get("/api/udid-registrations", (_req: Request, res: Response) => {
    const records = loadUdids();
    res.json(records);
  });

  app.patch("/api/udid-registrations/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, note } = req.body;
    const records = loadUdids();
    const record = records.find((r) => r.id === id);
    if (!record) {
      return res.status(404).json({ error: "Not found" });
    }
    if (status) record.status = status;
    if (note !== undefined) record.note = note;
    saveUdids(records);
    res.json(record);
  });

  app.delete("/api/udid-registrations/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    let records = loadUdids();
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Not found" });
    }
    records.splice(idx, 1);
    saveUdids(records);
    res.json({ ok: true });
  });
}
