/**
 * Seed SIP Extensions from CSV data
 * Run with: npx tsx server/scripts/seed-sip-extensions.ts
 */

import { db } from "../db";
import { sipExtensions } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET not configured");
  }
  return crypto.scryptSync(secret, "oauth-token-salt", 32);
}

function encryptSipPassword(plainPassword: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainPassword, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  
  return "SIP:" + combined.toString("base64");
}

const SIP_EXTENSIONS_DATA = [
  { country: "SK", extension: "2003", sip_username: "2003", sip_password: "FqsdRipanPqb3q" },
  { country: "SK", extension: "2004", sip_username: "2004", sip_password: "5G62WBfHsnuQR5" },
  { country: "SK", extension: "2005", sip_username: "2005", sip_password: "k0EEeOt8XuBwAp" },
  { country: "SK", extension: "2006", sip_username: "2006", sip_password: "omlK0goUku7njY" },
  { country: "SK", extension: "2007", sip_username: "2007", sip_password: "TuVybt63MKk87E" },
  { country: "SK", extension: "2008", sip_username: "2008", sip_password: "fATcLe1HLPzWoW" },
  { country: "SK", extension: "2009", sip_username: "2009", sip_password: "mSEGOFw3m36whB" },
  { country: "SK", extension: "2010", sip_username: "2010", sip_password: "py2qx3PEH2GItb" },
  { country: "SK", extension: "2011", sip_username: "2011", sip_password: "Hc8c4B3ss5ki8v" },
  { country: "SK", extension: "2012", sip_username: "2012", sip_password: "rskBx7oCJOzSmU" },
  { country: "SK", extension: "2013", sip_username: "2013", sip_password: "US1lRzm4uE5Ehc" },
  { country: "SK", extension: "2014", sip_username: "2014", sip_password: "50P2Xucu08T9DL" },
  { country: "SK", extension: "2015", sip_username: "2015", sip_password: "Mqv4AGVeNPdayZ" },
  { country: "SK", extension: "2016", sip_username: "2016", sip_password: "4AmPne4DRIFbA1" },
  { country: "SK", extension: "2017", sip_username: "2017", sip_password: "50n02KKucvAxUX" },
  { country: "SK", extension: "2018", sip_username: "2018", sip_password: "lWEC2XKuuu3cuO" },
  { country: "SK", extension: "2019", sip_username: "2019", sip_password: "lBGvYxavgbPmA0" },
  { country: "SK", extension: "2020", sip_username: "2020", sip_password: "P6l3wCpX9mifYT" },
  { country: "SK", extension: "2021", sip_username: "2021", sip_password: "IvDJuLvBnKyhp2" },
  { country: "SK", extension: "2022", sip_username: "2022", sip_password: "Tw0xtEe68bAKmb" },
  { country: "SK", extension: "2023", sip_username: "2023", sip_password: "AZamEP8Kg57jca" },
  { country: "SK", extension: "2024", sip_username: "2024", sip_password: "Spdaihsi8J0e5d" },
  { country: "SK", extension: "2025", sip_username: "2025", sip_password: "o6OttxmRlCCC9u" },
  { country: "SK", extension: "2026", sip_username: "2026", sip_password: "EXXR1Vs6b6gbTd" },
  { country: "SK", extension: "2027", sip_username: "2027", sip_password: "NdQLBcIqTbsF0w" },
  { country: "SK", extension: "2028", sip_username: "2028", sip_password: "c14uHbbOlsvK4U" },
  { country: "SK", extension: "2029", sip_username: "2029", sip_password: "gyU1ssUexXtmYZ" },
  { country: "SK", extension: "2030", sip_username: "2030", sip_password: "iTAQkA5TOI1dwF" },
  { country: "CZ", extension: "2100", sip_username: "2100", sip_password: "lztfsL2c6YBnYS" },
  { country: "CZ", extension: "2101", sip_username: "2101", sip_password: "EQd0fs6Tztfikb" },
  { country: "CZ", extension: "2102", sip_username: "2102", sip_password: "2Jb0tkqAXMF4Cb" },
  { country: "CZ", extension: "2103", sip_username: "2103", sip_password: "t9aDpsgMPSZrvH" },
  { country: "CZ", extension: "2104", sip_username: "2104", sip_password: "RvjjnGbDJ52qmP" },
  { country: "CZ", extension: "2105", sip_username: "2105", sip_password: "ux0k5AuCMAN2MJ" },
  { country: "CZ", extension: "2106", sip_username: "2106", sip_password: "vlhta9hteOY0sM" },
  { country: "CZ", extension: "2107", sip_username: "2107", sip_password: "B9oz7Iv4CElmQt" },
  { country: "CZ", extension: "2108", sip_username: "2108", sip_password: "zT394yyXoEUSo0" },
  { country: "CZ", extension: "2109", sip_username: "2109", sip_password: "WglpTUHRDvu8tz" },
  { country: "CZ", extension: "2110", sip_username: "2110", sip_password: "0phGlFqVsX0mf1" },
  { country: "CZ", extension: "2111", sip_username: "2111", sip_password: "YzlawLYferU1cZ" },
  { country: "CZ", extension: "2112", sip_username: "2112", sip_password: "TPciHbTdSZBn3j" },
  { country: "CZ", extension: "2113", sip_username: "2113", sip_password: "JKuRvqTcfXE5Ee" },
  { country: "CZ", extension: "2114", sip_username: "2114", sip_password: "H3rVpweJe5Do8r" },
  { country: "CZ", extension: "2115", sip_username: "2115", sip_password: "epCN121HrIQcQA" },
  { country: "CZ", extension: "2116", sip_username: "2116", sip_password: "p0ahajMX9hOl3A" },
  { country: "CZ", extension: "2117", sip_username: "2117", sip_password: "yH8BtDDK79Fgqu" },
  { country: "CZ", extension: "2118", sip_username: "2118", sip_password: "7TLReKSr8X78ve" },
  { country: "CZ", extension: "2119", sip_username: "2119", sip_password: "uSY5VKE3TACYaJ" },
  { country: "CZ", extension: "2120", sip_username: "2120", sip_password: "ByxHXKCxAjAY0z" },
  { country: "CZ", extension: "2121", sip_username: "2121", sip_password: "6OdPi07NOWTCU9" },
  { country: "CZ", extension: "2122", sip_username: "2122", sip_password: "TIZ9Tr4CNCJsrW" },
  { country: "CZ", extension: "2123", sip_username: "2123", sip_password: "3Ri0HsqYju2PbD" },
  { country: "CZ", extension: "2124", sip_username: "2124", sip_password: "8z9r7AU34URCEI" },
  { country: "CZ", extension: "2125", sip_username: "2125", sip_password: "U9zEcMxzJBB7H1" },
  { country: "CZ", extension: "2126", sip_username: "2126", sip_password: "F06K87VnHxgHCO" },
  { country: "CZ", extension: "2127", sip_username: "2127", sip_password: "2WeMTmAr1z8TWO" },
  { country: "CZ", extension: "2128", sip_username: "2128", sip_password: "Rp9JYjBmAWzvai" },
  { country: "CZ", extension: "2129", sip_username: "2129", sip_password: "QmFA938Sfp274w" },
  { country: "CZ", extension: "2130", sip_username: "2130", sip_password: "8m0sutKKawvu5c" },
  { country: "HU", extension: "3100", sip_username: "3100", sip_password: "84S7HL7X60l0Lk" },
  { country: "HU", extension: "3101", sip_username: "3101", sip_password: "k46z89zkLUWgok" },
  { country: "HU", extension: "3102", sip_username: "3102", sip_password: "XNn96sFgJjmLh9" },
  { country: "HU", extension: "3103", sip_username: "3103", sip_password: "822wwGmHk3Fa6i" },
  { country: "HU", extension: "3104", sip_username: "3104", sip_password: "bL98z4nnmxlG6j" },
  { country: "HU", extension: "3105", sip_username: "3105", sip_password: "1N7setY9yHdiSj" },
  { country: "HU", extension: "3106", sip_username: "3106", sip_password: "5bu4ODcLOpHIqe" },
  { country: "HU", extension: "3107", sip_username: "3107", sip_password: "Gh1JuJ9ooRIbsM" },
  { country: "HU", extension: "3108", sip_username: "3108", sip_password: "0oFmWK64evRcSp" },
  { country: "HU", extension: "3109", sip_username: "3109", sip_password: "cA3HfQAZs1Eo6E" },
  { country: "HU", extension: "3110", sip_username: "3110", sip_password: "48Hs3ZwpcR04Hs" },
];

async function seedSipExtensions() {
  console.log("Starting SIP extensions seed...");
  
  let created = 0;
  let skipped = 0;
  
  for (const ext of SIP_EXTENSIONS_DATA) {
    const [existing] = await db.select()
      .from(sipExtensions)
      .where(eq(sipExtensions.extension, ext.extension));
    
    if (existing) {
      console.log(`Skipping ${ext.extension} - already exists`);
      skipped++;
      continue;
    }
    
    const encryptedPassword = encryptSipPassword(ext.sip_password);
    
    await db.insert(sipExtensions).values({
      countryCode: ext.country,
      extension: ext.extension,
      sipUsername: ext.sip_username,
      sipPasswordHash: encryptedPassword,
      assignedToUserId: null,
      assignedAt: null,
    });
    
    console.log(`Created extension ${ext.extension} (${ext.country})`);
    created++;
  }
  
  console.log(`\nSeed complete: ${created} created, ${skipped} skipped`);
  process.exit(0);
}

seedSipExtensions().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
