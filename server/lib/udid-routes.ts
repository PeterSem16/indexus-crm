import { Express, Request, Response } from "express";
import { randomUUID } from "crypto";

const collectedUdids: Array<{
  udid: string;
  product: string;
  version: string;
  serial: string;
  collectedAt: string;
}> = [];

export function registerUdidRoutes(app: Express) {
  app.get("/udid", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>INDEXUS Connect — Registrácia zariadenia</title>
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
    <div class="subtitle">Registrácia zariadenia pre inštaláciu aplikácie</div>
    <div class="safari-warn">⚠️ Túto stránku otvorte v <strong>Safari</strong> na iPhone</div>
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Kliknite na tlačidlo nižšie</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">Povoľte stiahnutie konfiguračného profilu</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">Otvorte <strong>Nastavenia → Stiahnutý profil</strong> a nainštalujte ho</div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-text">Po inštalácii sa zobrazí vaše UDID — pošlite ho administrátorovi</div>
      </div>
    </div>
    <a href="/udid/enroll" class="btn">Získať UDID</a>
    <div class="note">Profil slúži iba na zistenie identifikátora zariadenia.<br>Po zobrazení UDID ho môžete z nastavení odstrániť.</div>
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
    <string>INDEXUS Connect - Registrácia zariadenia</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
    <key>PayloadUUID</key>
    <string>${payloadUUID}</string>
    <key>PayloadIdentifier</key>
    <string>com.cordbloodcenter.udid-enrollment</string>
    <key>PayloadDescription</key>
    <string>Tento profil zistí identifikátor vášho zariadenia (UDID) pre inštaláciu aplikácie INDEXUS Connect.</string>
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
      const bodyStr = body.toString("utf-8");

      let udid = "";
      let product = "";
      let version = "";
      let serial = "";

      const udidMatch = bodyStr.match(/<key>UDID<\/key>\s*<string>([^<]+)<\/string>/);
      if (udidMatch) udid = udidMatch[1];

      const productMatch = bodyStr.match(/<key>PRODUCT<\/key>\s*<string>([^<]+)<\/string>/);
      if (productMatch) product = productMatch[1];

      const versionMatch = bodyStr.match(/<key>VERSION<\/key>\s*<string>([^<]+)<\/string>/);
      if (versionMatch) version = versionMatch[1];

      const serialMatch = bodyStr.match(/<key>SERIAL<\/key>\s*<string>([^<]+)<\/string>/);
      if (serialMatch) serial = serialMatch[1];

      if (!udid) {
        const hexMatch = bodyStr.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{16}/);
        if (hexMatch) udid = hexMatch[0];
        if (!udid) {
          const hex40 = bodyStr.match(/[0-9a-fA-F]{40}/);
          if (hex40) udid = hex40[0];
        }
      }

      if (udid) {
        console.log(`[UDID] Collected: ${udid} | Product: ${product} | Version: ${version} | Serial: ${serial}`);
        collectedUdids.push({
          udid,
          product,
          version,
          serial,
          collectedAt: new Date().toISOString(),
        });
      } else {
        console.log("[UDID] Could not extract UDID from callback");
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
    const udid = (req.query.udid as string) || "Nepodarilo sa zistiť";
    const product = (req.query.product as string) || "";
    const version = (req.query.version as string) || "";

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>INDEXUS Connect — Vaše UDID</title>
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
    <div class="success">✅</div>
    <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">Zariadenie úspešne identifikované</div>
    
    <div class="label">Vaše UDID</div>
    <div class="udid-box" id="udid" onclick="copyUdid()">${udid}</div>
    <div class="copied" id="copied">Skopírované!</div>
    ${product ? `<div class="device-info">Zariadenie: ${product} | iOS ${version}</div>` : ""}
    
    <button class="copy-btn" onclick="copyUdid()">Kopírovať UDID</button>
    
    <div class="instructions">
      <strong>Čo teraz?</strong><br>
      1. Skopírujte UDID a pošlite ho administrátorovi<br>
      2. Po pridaní vášho zariadenia budete môcť nainštalovať INDEXUS Connect<br>
      3. Profil môžete odstrániť v <strong>Nastavenia → Všeobecné → VPN a správa zariadení</strong>
    </div>
  </div>
  <script>
    function copyUdid() {
      const udid = document.getElementById('udid').textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(udid).then(() => showCopied());
      } else {
        const ta = document.createElement('textarea');
        ta.value = udid;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showCopied();
      }
    }
    function showCopied() {
      const el = document.getElementById('copied');
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 2000);
    }
  </script>
</body>
</html>`);
  });

  app.get("/udid/list", (req: Request, res: Response) => {
    res.json(collectedUdids);
  });
}
