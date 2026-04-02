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
    .page-wrap { max-width: 820px; width: 100%; }
    .page-header { text-align: center; margin-bottom: 28px; }
    .logo { font-size: 28px; font-weight: 700; color: #60a5fa; margin-bottom: 4px; }
    .subtitle { color: #94a3b8; font-size: 14px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 640px) { .two-col { grid-template-columns: 1fr; } }
    .card { background: #1e293b; border-radius: 16px; padding: 32px 26px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
    .card-title { font-size: 17px; font-weight: 600; margin-bottom: 6px; color: #e2e8f0; }
    .card-sub { font-size: 13px; color: #94a3b8; margin-bottom: 20px; line-height: 1.5; }
    .form-group { text-align: left; margin-bottom: 14px; }
    .form-group label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 5px; font-weight: 500; }
    .form-group input { width: 100%; padding: 11px 13px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; font-size: 16px; outline: none; transition: border-color 0.2s; }
    .form-group input:focus { border-color: #3b82f6; }
    .form-group input::placeholder { color: #475569; }
    .btn { display: inline-block; background: #3b82f6; color: white; padding: 13px 28px; border-radius: 12px; text-decoration: none; font-size: 16px; font-weight: 600; transition: background 0.2s; border: none; cursor: pointer; width: 100%; }
    .btn:hover { background: #2563eb; }
    .btn:disabled { background: #334155; cursor: not-allowed; }
    .safari-warn { background: #fef3c7; color: #92400e; padding: 8px 12px; border-radius: 8px; font-size: 12px; margin-bottom: 16px; }
    .steps { text-align: left; margin: 16px 0; }
    .step { display: flex; align-items: flex-start; margin-bottom: 10px; }
    .step-num { background: #3b82f6; color: white; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; flex-shrink: 0; margin-right: 8px; margin-top: 1px; }
    .step-text { font-size: 13px; line-height: 1.5; color: #cbd5e1; }
    .error { color: #f87171; font-size: 13px; margin-top: 4px; display: none; }
    .note { margin-top: 14px; font-size: 11px; color: #64748b; line-height: 1.5; }
    .dl-card { display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .apple-icon { width: 80px; height: 80px; background: linear-gradient(135deg, #1e293b, #334155); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
    .apple-icon svg { width: 44px; height: 44px; fill: #e2e8f0; }
    .version-badge { background: #059669; color: white; display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-bottom: 16px; }
    .download-btn { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #059669, #047857); color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-size: 16px; font-weight: 600; transition: all 0.2s; width: 100%; justify-content: center; box-shadow: 0 4px 15px rgba(5,150,105,0.3); }
    .download-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(5,150,105,0.4); }
    .download-btn svg { width: 20px; height: 20px; fill: white; }
    .dl-note { font-size: 11px; color: #64748b; margin-top: 12px; line-height: 1.5; }
    .icon { font-size: 64px; margin: 20px 0; }
    .title { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    .message { font-size: 15px; color: #94a3b8; line-height: 1.6; margin-bottom: 20px; }
    .success-box { background: #064e3b; border: 1px solid #059669; border-radius: 10px; padding: 16px; margin: 20px 0; }
    .success-box p { color: #6ee7b7; font-size: 14px; line-height: 1.5; }
    .cleanup { margin-top: 20px; font-size: 12px; color: #64748b; line-height: 1.6; text-align: left; background: #0f172a; border-radius: 8px; padding: 12px 16px; }
    .cleanup strong { color: #94a3b8; }
    .error-box { background: #7f1d1d; border: 1px solid #dc2626; border-radius: 10px; padding: 16px; margin: 20px 0; }
    .error-box p { color: #fca5a5; font-size: 14px; line-height: 1.5; }
    .retry-btn { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600; margin-top: 16px; }
    .timeline { display: flex; flex-direction: column; gap: 0; margin: 20px 0; text-align: left; }
    .tl-item { display: flex; gap: 12px; }
    .tl-line { display: flex; flex-direction: column; align-items: center; width: 28px; flex-shrink: 0; }
    .tl-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
    .tl-dot.done { background: #059669; box-shadow: 0 0 8px rgba(5,150,105,0.4); }
    .tl-dot.wait { background: #f59e0b; box-shadow: 0 0 8px rgba(245,158,11,0.3); animation: pulse-dot 2s ease-in-out infinite; }
    .tl-dot.next { background: #334155; border: 2px solid #475569; }
    .tl-stem { width: 2px; flex-grow: 1; min-height: 20px; }
    .tl-stem.done { background: #059669; }
    .tl-stem.wait { background: linear-gradient(to bottom, #f59e0b, #334155); }
    .tl-content { padding-bottom: 16px; }
    .tl-title { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
    .tl-title.done { color: #6ee7b7; }
    .tl-title.wait { color: #fbbf24; }
    .tl-title.next { color: #64748b; }
    .tl-desc { font-size: 12px; color: #94a3b8; line-height: 1.5; }
    @keyframes pulse-dot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.7; } }
    .reassure { background: linear-gradient(135deg, #1e3a5f, #1e293b); border: 1px solid #2563eb33; border-radius: 12px; padding: 16px 18px; margin: 16px 0; text-align: center; }
    .reassure-icon { font-size: 28px; margin-bottom: 6px; }
    .reassure-text { font-size: 13px; color: #93c5fd; line-height: 1.6; }
    .reassure-text strong { color: #60a5fa; }
`;

const APPLE_SVG = `<svg viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`;
const IOS_DOWNLOAD_URL = "itms-services://?action=download-manifest&url=https://indexus.cordbloodcenter.com/data/mobil-app/indexus-connect-ios-manifest.plist";

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
  <div id="mainView" class="page-wrap">
    <div class="page-header">
      <div class="logo">INDEXUS Connect</div>
      <div class="subtitle">iOS app for Cord Blood Center staff</div>
    </div>

    <div class="two-col">
      <div class="card">
        <div class="card-title">&#128241; Register New Device</div>
        <div class="card-sub">First time? Register your iPhone to get access to the app.</div>
        <div class="safari-warn">&#9888;&#65039; Open this page in <strong>Safari</strong></div>

        <form id="regForm" onsubmit="return startRegistration()">
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

          <div class="steps">
            <div class="step">
              <div class="step-num">1</div>
              <div class="step-text">Fill in your name and tap the button</div>
            </div>
            <div class="step">
              <div class="step-num">2</div>
              <div class="step-text">Tap <strong>&ldquo;Allow&rdquo;</strong> when prompted</div>
            </div>
            <div class="step">
              <div class="step-num">3</div>
              <div class="step-text">Go to <strong>Settings</strong> &rarr; <strong>&ldquo;Profile Downloaded&rdquo;</strong> &rarr; <strong>&ldquo;Install&rdquo;</strong></div>
            </div>
          </div>

          <button type="submit" class="btn">Register My iPhone</button>
        </form>

        <div class="note">Registration is automatic &mdash; your device will be approved by an administrator shortly.</div>
      </div>

      <div class="card dl-card">
        <div class="apple-icon">${APPLE_SVG}</div>
        <div class="card-title">INDEXUS Connect</div>
        <div class="card-sub">iOS App</div>
        <div class="version-badge">Latest Version</div>
        <a href="${IOS_DOWNLOAD_URL}" class="download-btn">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:white"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          Download App
        </a>
        <div class="dl-note">
          Your device must be registered and approved before the app can be installed.
        </div>
      </div>
    </div>
  </div>

  <div id="calmView" style="display:none;">
    <div class="card" style="max-width:480px; margin: 0 auto;">
      <div class="logo">INDEXUS Connect</div>

      <div style="margin: 20px 0 16px;">
        <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 25px rgba(59,130,246,0.3);">
          <svg style="width:32px;height:32px;fill:white" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        </div>
      </div>
      <div class="title" id="calmTitle">Almost there!</div>
      <div style="font-size: 14px; color: #94a3b8; margin-bottom: 16px;">Your registration request has been submitted.</div>

      <div class="timeline">
        <div class="tl-item">
          <div class="tl-line"><div class="tl-dot done"></div><div class="tl-stem done"></div></div>
          <div class="tl-content">
            <div class="tl-title done">&#x2705; Device Registered</div>
            <div class="tl-desc">Your iPhone has been successfully registered in our system.</div>
          </div>
        </div>
        <div class="tl-item">
          <div class="tl-line"><div class="tl-dot wait"></div><div class="tl-stem wait"></div></div>
          <div class="tl-content">
            <div class="tl-title wait">&#x23F3; Waiting for Approval</div>
            <div class="tl-desc">An admin will approve your device &mdash; usually <strong style="color:#fbbf24">within minutes</strong>.</div>
          </div>
        </div>
        <div class="tl-item">
          <div class="tl-line"><div class="tl-dot next"></div></div>
          <div class="tl-content">
            <div class="tl-title next">&#x1F4E6; Download the App</div>
            <div class="tl-desc">Once approved, install INDEXUS Connect on your iPhone.</div>
          </div>
        </div>
      </div>

      <div class="reassure">
        <div class="reassure-icon">&#x1F44D;</div>
        <div class="reassure-text">
          <strong>Don&rsquo;t worry!</strong> Device approvals are usually processed <strong>within minutes</strong>. 
          You&rsquo;ll be able to install the app very soon.
        </div>
      </div>

      <a href="${IOS_DOWNLOAD_URL}" class="download-btn" style="margin-top: 16px;">
        ${APPLE_SVG.replace('<svg', '<svg style="width:20px;height:20px;fill:white"')}
        Download INDEXUS Connect
      </a>
      <div style="margin-top:8px; font-size:12px; color:#64748b;">If the download doesn&rsquo;t start, your device may still need to be approved.</div>

    </div>
  </div>

  <script>
    function startRegistration() {
      var fn = document.getElementById('firstName').value.trim();
      var ln = document.getElementById('lastName').value.trim();
      var ok = true;
      if (!fn) { document.getElementById('fnError').style.display = 'block'; ok = false; }
      else { document.getElementById('fnError').style.display = 'none'; }
      if (!ln) { document.getElementById('lnError').style.display = 'block'; ok = false; }
      else { document.getElementById('lnError').style.display = 'none'; }
      if (!ok) return false;

      document.getElementById('calmTitle').textContent = 'Hi ' + fn + ', almost there!';
      document.getElementById('mainView').style.display = 'none';
      document.getElementById('calmView').style.display = 'block';

      setTimeout(function() {
        window.location.href = '/udid/profile?firstName=' + encodeURIComponent(fn) + '&lastName=' + encodeURIComponent(ln);
      }, 600);

      return false;
    }
  </script>
</body>
</html>`);
  });

  app.get("/udid/profile", (req: Request, res: Response) => {
    const firstName = (req.query.firstName as string || "").trim();
    const lastName = (req.query.lastName as string || "").trim();
    const host = req.headers.host || "indexus.cordbloodcenter.com";
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const nameData = Buffer.from(JSON.stringify({ fn: firstName, ln: lastName })).toString("base64url");
    const callbackUrl = `${protocol}://${host}/udid/callback?n=${nameData}`;
    console.log(`[UDID] Profile download requested for: ${firstName} ${lastName}, callback: ${callbackUrl}`);
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
      let fnParam = "";
      let lnParam = "";
      const nParam = req.query.n as string || "";
      if (nParam) {
        try {
          const decoded = JSON.parse(Buffer.from(nParam, "base64url").toString("utf-8"));
          fnParam = (decoded.fn || "").trim();
          lnParam = (decoded.ln || "").trim();
        } catch (e) {
          console.log(`[UDID] Could not decode name param: ${nParam}`);
        }
      }
      if (!fnParam) fnParam = (req.query.fn as string || "").trim();
      if (!lnParam) lnParam = (req.query.ln as string || "").trim();
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
    const lastName = (req.query.ln as string) || "";
    const displayName = firstName || "there";

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>INDEXUS Connect — ${success ? "Registration Complete" : "Registration Issue"}</title>
  <style>${PAGE_STYLE}
    .result-card { max-width: 480px; }
  </style>
</head>
<body>
  <div class="card result-card">
    <div class="logo">INDEXUS Connect</div>
    ${success ? `
    <div style="margin: 24px 0 16px;">
      <div style="width: 72px; height: 72px; background: linear-gradient(135deg, #059669, #10b981); border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 25px rgba(5,150,105,0.3);">
        <svg style="width:36px;height:36px;fill:white" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
      </div>
    </div>
    <div class="title">Hi ${displayName}, you&rsquo;re all set!</div>
    ${product ? `<div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">${product}${version ? " &middot; iOS " + version : ""}</div>` : ""}

    <div class="timeline">
      <div class="tl-item">
        <div class="tl-line"><div class="tl-dot done"></div><div class="tl-stem done"></div></div>
        <div class="tl-content">
          <div class="tl-title done">&#x2705; Device Registered</div>
          <div class="tl-desc">Your iPhone has been successfully identified and registered in our system.</div>
        </div>
      </div>
      <div class="tl-item">
        <div class="tl-line"><div class="tl-dot wait"></div><div class="tl-stem wait"></div></div>
        <div class="tl-content">
          <div class="tl-title wait">&#x23F3; Waiting for Approval</div>
          <div class="tl-desc">An administrator will review and approve your device. This usually happens <strong style="color:#fbbf24">very quickly</strong>.</div>
        </div>
      </div>
      <div class="tl-item">
        <div class="tl-line"><div class="tl-dot next"></div></div>
        <div class="tl-content">
          <div class="tl-title next">Install the App</div>
          <div class="tl-desc">Once approved, download and install INDEXUS Connect.</div>
        </div>
      </div>
    </div>

    <div class="reassure">
      <div class="reassure-icon">&#x1F44D;</div>
      <div class="reassure-text">
        <strong>Don&rsquo;t worry!</strong> Device approvals are usually processed <strong>within minutes</strong>. 
        You&rsquo;ll be able to install the app very soon.
      </div>
    </div>

    <a href="${IOS_DOWNLOAD_URL}" class="download-btn" style="margin-top: 16px;">
      <svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
      Download INDEXUS Connect
    </a>
    <div style="margin-top:8px; font-size:12px; color:#64748b;">If the download doesn&rsquo;t start, your device may still be waiting for approval.</div>

    <div class="cleanup">
      <strong>&#x1F9F9; Tip:</strong> You can safely remove the registration profile from<br>
      <strong>Settings &rarr; General &rarr; VPN &amp; Device Management</strong>
    </div>
    ` : `
    <div style="margin: 24px 0 16px;">
      <div style="width: 72px; height: 72px; background: linear-gradient(135deg, #dc2626, #ef4444); border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 25px rgba(220,38,38,0.3);">
        <svg style="width:36px;height:36px;fill:white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
      </div>
    </div>
    <div class="title">Registration could not be completed</div>
    <div class="error-box">
      <p>We could not read your device information. This can happen if the profile was not fully installed, or if it was cancelled.</p>
    </div>
    <div class="message">Please try again &mdash; make sure to tap &ldquo;Allow&rdquo; and then install the profile in Settings.</div>
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
