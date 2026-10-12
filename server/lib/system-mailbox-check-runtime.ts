import { storage } from "../storage";
import { getValidAccessToken } from "./ms365";
import { decryptTokenSafe, encryptTokenWithMarker } from "./token-crypto";
import { MailboxCheckError, SystemMailboxChecks } from "./system-mailbox-check";

export const systemMailboxChecks = new SystemMailboxChecks({
  connection: (country) => storage.getSystemMs365Connection(country),
  sender: async (country) => (await storage.getCountrySystemSettingsByCountry(country))?.systemEmailAddress,
  token: async (country) => {
    const c = await storage.getSystemMs365Connection(country);
    if (!c?.accessToken) throw new MailboxCheckError(409, "not_connected");
    const tokens = await getValidAccessToken(decryptTokenSafe(c.accessToken), c.tokenExpiresAt,
      c.refreshToken ? decryptTokenSafe(c.refreshToken) : null, { quiet: true });
    if (!tokens?.accessToken) throw new MailboxCheckError(409, "token_unavailable");
    if (tokens.refreshed) {
      const saved = await storage.updateSystemMs365Connection(country, {
        accessToken: encryptTokenWithMarker(tokens.accessToken),
        ...(tokens.refreshToken ? { refreshToken: encryptTokenWithMarker(tokens.refreshToken) } : {}),
        ...(tokens.expiresOn ? { tokenExpiresAt: tokens.expiresOn } : {}),
      }, c.accessToken);
      if (!saved) throw new MailboxCheckError(409, "mailbox_changed");
    }
    return tokens.accessToken;
  },
  fetch: (...args) => fetch(...args),
});
