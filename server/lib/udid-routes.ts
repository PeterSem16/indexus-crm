import { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

export interface UdidRecord {
  id: string;
  udid: string;
  firstName: string;
  lastName: string;
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

const PAGE_STYLE = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #1e293b; border-radius: 16px; padding: 40px 30px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
    .logo { font-size: 28px; font-weight: 700; color: #60a5fa; margin-bottom: 8px; }
    .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
    .form-group { text-align: left; margin-bottom: 16px; }
    .form-group label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; font-weight: 500; }
    .form-group input { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; font-size: 16px; outline: none; transition: border-color 0.2s; }
    .form-group input:focus { border-color: #3b82f6; }
    .form-group input::placeholder { color: #475569; }
    .btn { display: inline-block; background: #3b82f6; color: white; padding: 14px 36px; border-radius: 12px; text-decoration: none; font-size: 17px; font-weight: 600; transition: background 0.2s; border: none; cursor: pointer; width: 100%; }
    .btn:hover { background: #2563eb; }
    .btn:disabled { background: #334155; cursor: not-allowed; }
    .note { margin-top: 20px; font-size: 12px; color: #64748b; line-height: 1.5; }
    .safari-warn { background: #fef3c7; color: #92400e; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 24px; }
    .auto-badge { background: #059669; color: white; display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }
    .steps { text-align: left; margin-bottom: 24px; }
    .step { display: flex; align-items: flex-start; margin-bottom: 12px; }
    .step-num { background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0; margin-right: 10px; margin-top: 2px; }
    .step-text { font-size: 14px; line-height: 1.5; color: #cbd5e1; }
    .error { color: #f87171; font-size: 13px; margin-top: 4px; display: none; }
    .icon { font-size: 64px; margin: 20px 0; }
    .title { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    .message { font-size: 15px; color: #94a3b8; line-height: 1.6; margin-bottom: 20px; }
    .success-box { background: #064e3b; border: 1px solid #059669; border-radius: 10px; padding: 16px; margin: 20px 0; }
    .success-box p { color: #6ee7b7; font-size: 14px; line-height: 1.5; }
    .download-btn { display: inline-block; background: #059669; color: white; padding: 16px 36px; border-radius: 12px; text-decoration: none; font-size: 17px; font-weight: 600; transition: background 0.2s; margin-top: 12px; }
    .download-btn:hover { background: #047857; }
    .cleanup { margin-top: 20px; font-size: 12px; color: #64748b; line-height: 1.6; text-align: left; background: #0f172a; border-radius: 8px; padding: 12px 16px; }
    .cleanup strong { color: #94a3b8; }
    .error-box { background: #7f1d1d; border: 1px solid #dc2626; border-radius: 10px; padding: 16px; margin: 20px 0; }
    .error-box p { color: #fca5a5; font-size: 14px; line-height: 1.5; }
    .retry-btn { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600; margin-top: 16px; }
`;

export function registerUdidRoutes(app: Express) {
  app.get("/udid", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>INDEXUS Connect — Register Your iPhone</title>
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <div class="card">
    <div class="logo">INDEXUS Connect</div>
    <div class="subtitle">Register your iPhone to install the app</div>
    <div class="auto-badge">Quick &amp; automatic</div>
    <div class="safari-warn">Please open this page in <strong>Safari</strong></div>

    <form id="regForm" action="/udid/enroll" method="GET" onsubmit="return validateForm()">
      <div class="form-group">
        <label for="firstName">First Name *</label>
        <input type="text" id="firstName" name="firstName" placeholder="e.g. John" required autocomplete="given-name" />
        <div class="error" id="fnError">Please enter your first name</div>
      </div>
      <div class="form-group">
        <label for="lastName">Last Name *</label>
        <input type="text" id="lastName" name="lastName" placeholder="e.g. Smith" required autocomplete="family-name" />
        <div class="error" id="lnError">Please enter your last name</div>
      </div>

      <div class="steps" style="margin-top: 20px;">
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-text">Fill in your name and tap the button</div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-text">Tap <strong>"Allow"</strong> when prompted</div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-text">Go to <strong>Settings</strong> &rarr; tap <strong>"Profile Downloaded"</strong> &rarr; <strong>"Install"</strong></div>
        </div>
      </div>

      <button type="submit" class="btn">Register My iPhone</button>
    </form>

    <div class="note">Your device will be registered automatically. After approval you can install INDEXUS Connect.</div>

    <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #334155;">
      <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">Already registered? Download the latest version:</p>
      <a href="itms-services://?action=download-manifest&url=https://indexus.cordbloodcenter.com/data/mobil-app/indexus-connect-ios-manifest.plist" class="download-btn" style="display: inline-flex; align-items: center; gap: 8px; width: 100%; justify-content: center;">
        <svg style="width:20px;height:20px" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
        Download INDEXUS Connect
      </a>
    </div>
  </div>
  <script>
    function validateForm() {
      var fn = document.getElementById('firstName').value.trim();
      var ln = document.getElementById('lastName').value.trim();
      var ok = true;
      if (!fn) { document.getElementById('fnError').style.display = 'block'; ok = false; }
      else { document.getElementById('fnError').style.display = 'none'; }
      if (!ln) { document.getElementById('lnError').style.display = 'block'; ok = false; }
      else { document.getElementById('lnError').style.display = 'none'; }
      return ok;
    }
  </script>
</body>
</html>`);
  });

  app.get("/udid/enroll", (req: Request, res: Response) => {
    const firstName = (req.query.firstName as string || "").trim();
    const lastName = (req.query.lastName as string || "").trim();
    const host = req.headers.host || "indexus.cordbloodcenter.com";
    const protocol = req.headers["x-forwarded-proto"] || "https";

    const callbackUrl = `${protocol}://${host}/udid/callback?fn=${encodeURIComponent(firstName)}&ln=${encodeURIComponent(lastName)}`;
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
      const fnParam = (req.query.fn as string || "").trim();
      const lnParam = (req.query.ln as string || "").trim();
      console.log(`[UDID] Callback received, body length: ${body.length}, name: ${fnParam} ${lnParam}`);

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

      const firstName = fnParam;
      const lastName = lnParam;

      if (udid) {
        console.log(`[UDID] SUCCESS - ${firstName} ${lastName} | UDID: ${udid} | Product: ${product} | Version: ${version} | Serial: ${serial}`);
        const records = loadUdids();
        const existing = records.find((d) => d.udid === udid);
        if (!existing) {
          records.push({
            id: randomUUID(),
            udid,
            firstName,
            lastName,
            product,
            version,
            serial,
            status: "pending",
            note: "",
            collectedAt: new Date().toISOString(),
          });
          saveUdids(records);
          console.log(`[UDID] Saved. Total registrations: ${records.length}`);
        } else {
          if (firstName && !existing.firstName) {
            existing.firstName = firstName;
            existing.lastName = lastName;
            saveUdids(records);
          }
          console.log(`[UDID] Device already registered (duplicate)`);
        }
      } else {
        console.log("[UDID] FAILED - Could not extract UDID");
        console.log(`[UDID] Raw body hex (first 500 bytes): ${body.subarray(0, 500).toString("hex")}`);
      }

      const host = req.headers.host || "indexus.cordbloodcenter.com";
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const success = udid ? "true" : "false";
      res.redirect(301, `${protocol}://${host}/udid/result?success=${success}&product=${encodeURIComponent(product)}&version=${encodeURIComponent(version)}&fn=${encodeURIComponent(firstName)}&ln=${encodeURIComponent(lastName)}`);
    } catch (error: any) {
      console.error("[UDID] Callback error:", error.message, error.stack);
      const host = req.headers.host || "indexus.cordbloodcenter.com";
      const protocol = req.headers["x-forwarded-proto"] || "https";
      res.redirect(301, `${protocol}://${host}/udid/result?success=false`);
    }
  });

  app.get("/udid/result", (req: Request, res: Response) => {
    const success = req.query.success === "true";
    const product = (req.query.product as string) || "";
    const version = (req.query.version as string) || "";
    const firstName = (req.query.fn as string) || "";

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>INDEXUS Connect — ${success ? "Registration Complete" : "Registration Issue"}</title>
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <div class="card">
    <div class="logo">INDEXUS Connect</div>
    ${success ? `
    <div class="icon">&#x2705;</div>
    <div class="title">${firstName ? firstName + ", your" : "Your"} device is registered!</div>
    ${product ? `<div style="font-size: 13px; color: #64748b; margin-bottom: 12px;">${product}${version ? " &middot; iOS " + version : ""}</div>` : ""}
    <div class="success-box">
      <p>Your iPhone has been <strong>automatically registered</strong>. The administrator will approve your device shortly.</p>
    </div>
    <div class="message">You can now download the app:</div>
    <a href="itms-services://?action=download-manifest&url=https://indexus.cordbloodcenter.com/data/mobil-app/indexus-connect-ios-manifest.plist" class="download-btn" style="display: inline-flex; align-items: center; gap: 8px;">
      <svg style="width:20px;height:20px" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
      Download INDEXUS Connect
    </a>
    <div style="margin-top:8px; font-size:12px; color:#64748b;">If the download doesn't start, your device may need to be approved first.</div>
    <div class="cleanup">
      <strong>Optional:</strong> You can remove the registration profile from<br>
      <strong>Settings &rarr; General &rarr; VPN & Device Management</strong>
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
