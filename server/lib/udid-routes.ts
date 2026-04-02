import { Express, Request, Response } from "express";
import { randomUUID } from "crypto";

const collectedUdids: Array<{
  udid: string;
  product: string;
  version: string;
  serial: string;
  collectedAt: string;
}> = [];

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
  <title>INDEXUS Connect — Device Registration</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #1e293b; border-radius: 16px; padding: 40px 30px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
    .logo { font-size: 28px; font-weight: 700; color: #60a5fa; margin-bottom: 8px; }
    .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 30px; }
    .steps { text-align: left; margin-bottom: 30px; }
    .step { display: flex; align-items: flex-start; margin-bottom: 16px; }
    .step-num { background: #3b82f6; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; flex-shrink: 0; margin-right: 12px; margin-top: 2px; }
    .step-text { font-size: 15px; line-height: 1.5; color: #cbd5e1; }
    .btn { display: inline-block; background: #3b82f6; color: white; padding: 14px 36px; border-radius: 12px; text-decoration: none; font-size: 17px; font-weight: 600; transition: background 0.2s; }
    .btn:hover { background: #2563eb; }
    .note { margin-top: 20px; font-size: 12px; color: #64748b; line-height: 1.5; }
    .safari-warn { background: #fef3c7; color: #92400e; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">INDEXUS Connect</div>
    <div class="subtitle">Device registration for app installation</div>
    <div class="safari-warn">This page must be opened in <strong>Safari</strong> on your iPhone</div>
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Tap the button below</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">Allow the configuration profile to download</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">Open <strong>Settings &rarr; Downloaded Profile</strong> and install it</div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-text">After installation, your UDID will be displayed — send it to the administrator</div>
      </div>
    </div>
    <a href="/udid/enroll" class="btn">Get My UDID</a>
    <div class="note">This profile only retrieves your device identifier.<br>You can remove it from Settings after the UDID is displayed.</div>
  </div>
</body>
</html>`);
  });

  app.get("/udid/enroll", (req: Request, res: Response) => {
    const host = req.headers.host || "indexus.cordbloodcenter.com";
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const callbackUrl = `${protocol}://${host}/udid/callback`;
    const payloadUUID = randomUUID().toUpperCase();
    const profileUUID = randomUUID().toUpperCase();

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
    <string>INDEXUS Connect - Device Registration</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
    <key>PayloadUUID</key>
    <string>${payloadUUID}</string>
    <key>PayloadIdentifier</key>
    <string>com.cordbloodcenter.udid-enrollment</string>
    <key>PayloadDescription</key>
    <string>This profile retrieves your device identifier (UDID) for INDEXUS Connect app installation.</string>
    <key>PayloadType</key>
    <string>Profile Service</string>
</dict>
</plist>`;

    res.setHeader("Content-Type", "application/x-apple-aspen-config");
    res.setHeader("Content-Disposition", 'attachment; filename="INDEXUSConnect-UDID.mobileconfig"');
    res.send(mobileconfig);
  });

  app.post("/udid/callback", (req: Request, res: Response) => {
    try {
      const body = req.body as Buffer;
      console.log(`[UDID] Callback received, body length: ${body.length}, content-type: ${req.headers["content-type"]}`);

      const plistXml = extractPlistFromBody(body);
      console.log(`[UDID] Extracted plist (${plistXml.length} chars): ${plistXml.substring(0, 300)}...`);

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
        console.log(`[UDID] Collected: ${udid} | Product: ${product} | Version: ${version} | Serial: ${serial}`);
        const existing = collectedUdids.find((d) => d.udid === udid);
        if (!existing) {
          collectedUdids.push({
            udid,
            product,
            version,
            serial,
            collectedAt: new Date().toISOString(),
          });
        }
      } else {
        console.log("[UDID] Could not extract UDID from callback body");
        console.log(`[UDID] Raw body hex (first 200 bytes): ${body.subarray(0, 200).toString("hex")}`);
      }

      const host = req.headers.host || "indexus.cordbloodcenter.com";
      const protocol = req.headers["x-forwarded-proto"] || "https";
      res.redirect(301, `${protocol}://${host}/udid/result?udid=${encodeURIComponent(udid)}&product=${encodeURIComponent(product)}&version=${encodeURIComponent(version)}`);
    } catch (error: any) {
      console.error("[UDID] Callback error:", error.message);
      res.status(500).send("Error processing device information");
    }
  });

  app.get("/udid/result", (req: Request, res: Response) => {
    const udid = (req.query.udid as string) || "Could not retrieve";
    const product = (req.query.product as string) || "";
    const version = (req.query.version as string) || "";

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>INDEXUS Connect — Your UDID</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #1e293b; border-radius: 16px; padding: 40px 30px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
    .logo { font-size: 28px; font-weight: 700; color: #60a5fa; margin-bottom: 8px; }
    .success { font-size: 48px; margin-bottom: 16px; }
    .label { font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; margin-top: 20px; }
    .udid-box { background: #0f172a; border: 2px solid #3b82f6; border-radius: 10px; padding: 14px; font-family: 'SF Mono', 'Courier New', monospace; font-size: 13px; word-break: break-all; color: #60a5fa; cursor: pointer; position: relative; }
    .udid-box:active { background: #1a2744; }
    .device-info { font-size: 14px; color: #94a3b8; margin-top: 8px; }
    .copy-btn { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; border-radius: 10px; border: none; font-size: 15px; font-weight: 600; margin-top: 20px; cursor: pointer; }
    .copy-btn:active { background: #2563eb; }
    .instructions { margin-top: 24px; text-align: left; font-size: 13px; color: #64748b; line-height: 1.6; }
    .instructions strong { color: #94a3b8; }
    .copied { color: #22c55e; font-size: 14px; margin-top: 8px; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">INDEXUS Connect</div>
    <div class="success">${udid && udid !== "Could not retrieve" ? "&#x2705;" : "&#x274C;"}</div>
    <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">${udid && udid !== "Could not retrieve" ? "Device successfully identified" : "Could not identify device"}</div>
    
    <div class="label">Your UDID</div>
    <div class="udid-box" id="udid" onclick="copyUdid()">${udid}</div>
    <div class="copied" id="copied">Copied!</div>
    ${product ? `<div class="device-info">Device: ${product} | iOS ${version}</div>` : ""}
    
    <button class="copy-btn" onclick="copyUdid()">Copy UDID</button>
    
    <div class="instructions">
      <strong>What's next?</strong><br>
      1. Copy the UDID and send it to the administrator<br>
      2. Once your device is registered, you can install INDEXUS Connect<br>
      3. You can remove this profile in <strong>Settings &rarr; General &rarr; VPN & Device Management</strong>
    </div>
  </div>
  <script>
    function copyUdid() {
      var udid = document.getElementById('udid').textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(udid).then(function() { showCopied(); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = udid;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showCopied();
      }
    }
    function showCopied() {
      var el = document.getElementById('copied');
      el.style.display = 'block';
      setTimeout(function() { el.style.display = 'none'; }, 2000);
    }
  </script>
</body>
</html>`);
  });

  app.get("/udid/list", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>INDEXUS Connect — Collected UDIDs</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; padding: 40px 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 24px; color: #60a5fa; margin-bottom: 8px; }
    .count { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 12px; overflow: hidden; }
    th { background: #334155; padding: 12px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
    td { padding: 12px 16px; border-top: 1px solid #334155; font-size: 13px; }
    .udid-cell { font-family: 'SF Mono', 'Courier New', monospace; color: #60a5fa; word-break: break-all; }
    .empty { text-align: center; padding: 60px 20px; color: #64748b; }
    .json-link { margin-top: 16px; }
    .json-link a { color: #3b82f6; font-size: 13px; text-decoration: none; }
    .json-link a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>INDEXUS Connect — Collected UDIDs</h1>
    <div class="count">${collectedUdids.length} device(s) registered</div>
    ${collectedUdids.length === 0 ? '<div class="empty">No devices registered yet.<br>Share the registration link with users: <strong>/udid</strong></div>' : `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>UDID</th>
          <th>Device</th>
          <th>iOS</th>
          <th>Serial</th>
          <th>Collected</th>
        </tr>
      </thead>
      <tbody>
        ${collectedUdids.map((d, i) => `
        <tr>
          <td>${i + 1}</td>
          <td class="udid-cell">${d.udid}</td>
          <td>${d.product || "-"}</td>
          <td>${d.version || "-"}</td>
          <td>${d.serial || "-"}</td>
          <td>${new Date(d.collectedAt).toLocaleString("en-US")}</td>
        </tr>`).join("")}
      </tbody>
    </table>`}
    <div class="json-link"><a href="/udid/list.json">View as JSON</a></div>
  </div>
</body>
</html>`);
  });

  app.get("/udid/list.json", (_req: Request, res: Response) => {
    res.json(collectedUdids);
  });
}
