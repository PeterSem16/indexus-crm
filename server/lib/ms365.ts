/**
 * Microsoft 365 / Entra ID Integration Module
 * Multi-tenant OAuth2.0 authentication with Microsoft Graph API
 */

import { ConfidentialClientApplication, Configuration, AuthorizationCodeRequest, CryptoProvider } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';

// Configuration from environment variables (secrets)
const MS365_CONFIG = {
  tenantId: process.env.MS365_TENANT_ID || '',
  clientId: process.env.MS365_CLIENT_ID || '',
  clientSecret: process.env.MS365_CLIENT_SECRET || '',
  // Secret expiration date for monitoring (December 1, 2028)
  secretExpiresAt: new Date('2028-12-01'),
  redirectUri: process.env.MS365_REDIRECT_URI || 'https://fc828d39-61cd-41d5-ba8d-20e8af9db227-00-7urdqg8tuo0k.worf.replit.dev/api/auth/microsoft/callback',
  postLogoutRedirectUri: process.env.MS365_POST_LOGOUT_URI || 'https://fc828d39-61cd-41d5-ba8d-20e8af9db227-00-7urdqg8tuo0k.worf.replit.dev',
};

// MSAL configuration for multi-tenant app
const msalConfig: Configuration = {
  auth: {
    clientId: MS365_CONFIG.clientId,
    authority: `https://login.microsoftonline.com/${MS365_CONFIG.tenantId}`,
    clientSecret: MS365_CONFIG.clientSecret,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (!containsPii) {
          console.log(`[MSAL] ${message}`);
        }
      },
      piiLoggingEnabled: false,
      logLevel: 3, // Info
    },
  },
};

// Scopes for Microsoft Graph API
// Using .default scope to use all permissions already configured in Azure AD
// This automatically uses whatever permissions were granted during admin consent
const GRAPH_SCOPES = [
  'https://graph.microsoft.com/.default',
  'offline_access',
];

// MSAL client instance
let msalClient: ConfidentialClientApplication | null = null;
const cryptoProvider = new CryptoProvider();

/**
 * Initialize MSAL client
 */
export function initializeMsal(): ConfidentialClientApplication {
  if (!msalClient) {
    if (!MS365_CONFIG.clientId || !MS365_CONFIG.clientSecret || !MS365_CONFIG.tenantId) {
      throw new Error('MS365 credentials not configured. Please set MS365_CLIENT_ID, MS365_CLIENT_SECRET, and MS365_TENANT_ID environment variables.');
    }
    msalClient = new ConfidentialClientApplication(msalConfig);
  }
  return msalClient;
}

/**
 * Get authorization URL for OAuth flow
 * @param state - Optional state parameter for CSRF protection
 * @param useAdminConsent - If true, uses admin consent endpoint for tenant-wide permissions
 */
export async function getAuthorizationUrl(state?: string, useAdminConsent: boolean = false): Promise<{ url: string; codeVerifier: string; state: string }> {
  const client = initializeMsal();
  
  // Generate PKCE codes
  const { verifier, challenge } = await cryptoProvider.generatePkceCodes();
  const generatedState = state || cryptoProvider.createNewGuid();
  
  // If admin consent is needed, redirect to admin consent endpoint first
  if (useAdminConsent) {
    const adminConsentUrl = `https://login.microsoftonline.com/${MS365_CONFIG.tenantId}/adminconsent?client_id=${MS365_CONFIG.clientId}&redirect_uri=${encodeURIComponent(MS365_CONFIG.redirectUri)}&state=${generatedState}`;
    return {
      url: adminConsentUrl,
      codeVerifier: verifier,
      state: generatedState,
    };
  }
  
  const authCodeUrlParameters = {
    scopes: GRAPH_SCOPES,
    redirectUri: MS365_CONFIG.redirectUri,
    codeChallenge: challenge,
    codeChallengeMethod: 'S256' as const,
    state: generatedState,
    prompt: 'select_account' as const, // Allow user to select account without forcing consent
  };
  
  const url = await client.getAuthCodeUrl(authCodeUrlParameters);
  
  return {
    url,
    codeVerifier: verifier,
    state: generatedState,
  };
}

/**
 * Exchange authorization code for tokens
 */
export async function acquireTokenByCode(code: string, codeVerifier: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresOn: Date | null;
  account: any;
}> {
  const client = initializeMsal();
  
  const tokenRequest: AuthorizationCodeRequest = {
    code,
    scopes: GRAPH_SCOPES,
    redirectUri: MS365_CONFIG.redirectUri,
    codeVerifier,
  };
  
  const response = await client.acquireTokenByCode(tokenRequest);
  
  return {
    accessToken: response.accessToken,
    refreshToken: undefined, // MSAL handles refresh internally via cache
    expiresOn: response.expiresOn,
    account: response.account,
  };
}

/**
 * Create Microsoft Graph client with access token
 */
export function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

/**
 * Get current user profile from Microsoft Graph
 */
export async function getUserProfile(accessToken: string): Promise<any> {
  const client = createGraphClient(accessToken);
  return client.api('/me').get();
}

/**
 * Get user's emails
 */
export async function getUserEmails(accessToken: string, top: number = 10): Promise<any> {
  const client = createGraphClient(accessToken);
  return client.api('/me/messages')
    .top(top)
    .orderby('receivedDateTime desc')
    .get();
}

/**
 * Send email via Microsoft Graph
 */
export async function sendEmail(
  accessToken: string,
  to: string[],
  subject: string,
  body: string,
  isHtml: boolean = true
): Promise<void> {
  const client = createGraphClient(accessToken);
  
  const message = {
    subject,
    body: {
      contentType: isHtml ? 'HTML' : 'Text',
      content: body,
    },
    toRecipients: to.map(email => ({
      emailAddress: { address: email },
    })),
  };
  
  await client.api('/me/sendMail').post({ message });
}

/**
 * Get user's calendar events
 */
export async function getCalendarEvents(
  accessToken: string,
  startDateTime: Date,
  endDateTime: Date
): Promise<any> {
  const client = createGraphClient(accessToken);
  
  return client.api('/me/calendarview')
    .query({
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
    })
    .orderby('start/dateTime')
    .get();
}

/**
 * Get user's contacts
 */
export async function getContacts(accessToken: string, top: number = 50): Promise<any> {
  const client = createGraphClient(accessToken);
  return client.api('/me/contacts')
    .top(top)
    .get();
}

/**
 * Check if MS365 integration is configured
 */
export function isConfigured(): boolean {
  return !!(MS365_CONFIG.clientId && MS365_CONFIG.clientSecret && MS365_CONFIG.tenantId);
}

/**
 * Get configuration status (without exposing secrets)
 */
export function getConfigStatus(): {
  configured: boolean;
  tenantId: string;
  clientId: string;
  secretExpiration: {
    date: Date;
    daysRemaining: number;
    isExpiringSoon: boolean;
    isExpired: boolean;
  };
} {
  const now = new Date();
  const expirationDate = MS365_CONFIG.secretExpiresAt;
  const daysRemaining = Math.floor((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    configured: isConfigured(),
    tenantId: MS365_CONFIG.tenantId ? `${MS365_CONFIG.tenantId.substring(0, 8)}...` : 'Not set',
    clientId: MS365_CONFIG.clientId ? `${MS365_CONFIG.clientId.substring(0, 8)}...` : 'Not set',
    secretExpiration: {
      date: expirationDate,
      daysRemaining,
      isExpiringSoon: daysRemaining < 90, // Warn 90 days before expiration
      isExpired: daysRemaining < 0,
    },
  };
}

/**
 * Get logout URL for front-channel logout
 */
export function getLogoutUrl(): string {
  return `https://login.microsoftonline.com/${MS365_CONFIG.tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(MS365_CONFIG.postLogoutRedirectUri)}`;
}

export { MS365_CONFIG, GRAPH_SCOPES };
