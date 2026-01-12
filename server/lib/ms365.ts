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
 * Exchange authorization code for tokens using direct OAuth2 token endpoint
 * This bypasses MSAL to get the refresh token which MSAL doesn't expose
 */
export async function acquireTokenByCode(code: string, codeVerifier: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresOn: Date | null;
  account: any;
  accountId?: string;
}> {
  const tokenEndpoint = `https://login.microsoftonline.com/${MS365_CONFIG.tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: MS365_CONFIG.clientId,
    client_secret: MS365_CONFIG.clientSecret,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: MS365_CONFIG.redirectUri,
    code_verifier: codeVerifier,
    scope: GRAPH_SCOPES.join(' '),
  });
  
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[MS365] Token exchange failed:', errorData);
    throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error || 'Unknown error'}`);
  }
  
  const data = await response.json();
  
  // Calculate expiration date
  const expiresOn = new Date(Date.now() + (data.expires_in * 1000));
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token, // Now we get the actual refresh token!
    expiresOn,
    account: null, // Not using MSAL account
    accountId: undefined,
  };
}

/**
 * Refresh access token using refresh token via direct OAuth2 token endpoint
 * This bypasses MSAL cache and works after server restarts
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresOn: Date;
} | null> {
  if (!refreshToken) {
    console.log('[MS365] No refresh token provided');
    return null;
  }
  
  try {
    const tokenEndpoint = `https://login.microsoftonline.com/${MS365_CONFIG.tenantId}/oauth2/v2.0/token`;
    
    const params = new URLSearchParams({
      client_id: MS365_CONFIG.clientId,
      client_secret: MS365_CONFIG.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: GRAPH_SCOPES.join(' '),
    });
    
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[MS365] Token refresh failed:', errorData);
      return null;
    }
    
    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Use new if provided, else keep old
      expiresOn: new Date(Date.now() + (data.expires_in * 1000)),
    };
  } catch (error) {
    console.error('[MS365] Token refresh error:', error);
    return null;
  }
}

/**
 * Check if token is expired or expiring soon (within 5 minutes)
 */
export function isTokenExpiringSoon(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return new Date(expiresAt) < fiveMinutesFromNow;
}

/**
 * Get valid access token, refreshing if necessary using stored refresh token
 * Returns null if token cannot be obtained
 */
export async function getValidAccessToken(
  storedAccessToken: string | null,
  tokenExpiresAt: Date | null,
  storedRefreshToken: string | null
): Promise<{ accessToken: string; refreshToken?: string; expiresOn: Date | null; refreshed: boolean } | null> {
  // If we have a valid token that's not expiring soon, use it
  if (storedAccessToken && tokenExpiresAt && !isTokenExpiringSoon(tokenExpiresAt)) {
    return { accessToken: storedAccessToken, expiresOn: tokenExpiresAt, refreshed: false };
  }
  
  // Try to refresh using the refresh token
  if (storedRefreshToken) {
    const freshToken = await refreshAccessToken(storedRefreshToken);
    if (freshToken) {
      return { 
        accessToken: freshToken.accessToken, 
        refreshToken: freshToken.refreshToken,
        expiresOn: freshToken.expiresOn, 
        refreshed: true 
      };
    }
  }
  
  // Cannot obtain valid token
  return null;
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
 * Send email from a shared mailbox via Microsoft Graph
 * Uses /me/sendMail endpoint with 'from' set to shared mailbox address
 * Requires Mail.Send permission and SendAs/SendOnBehalf permission on the shared mailbox
 */
export async function sendEmailFromSharedMailbox(
  accessToken: string,
  sharedMailboxEmail: string,
  to: string[],
  subject: string,
  body: string,
  isHtml: boolean = true,
  cc?: string[],
  attachments?: Array<{ name: string; contentType: string; contentBase64: string }>
): Promise<void> {
  const client = createGraphClient(accessToken);
  
  const message: any = {
    subject,
    body: {
      contentType: isHtml ? 'HTML' : 'Text',
      content: body,
    },
    toRecipients: to.map(email => ({
      emailAddress: { address: email },
    })),
    // Set 'from' to shared mailbox - user must have SendAs permission
    from: {
      emailAddress: { address: sharedMailboxEmail },
    },
  };
  
  if (cc && cc.length > 0) {
    message.ccRecipients = cc.map(email => ({
      emailAddress: { address: email },
    }));
  }
  
  if (attachments && attachments.length > 0) {
    message.attachments = attachments.map(att => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: att.name,
      contentType: att.contentType,
      contentBytes: att.contentBase64,
    }));
  }
  
  // Send using /me/sendMail with 'from' set to shared mailbox
  // This works when user has SendAs or SendOnBehalf permission on the shared mailbox
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
 * Get unread email count for a mailbox
 * @param accessToken - Access token
 * @param mailboxEmail - Optional shared mailbox email. If not provided, uses user's own mailbox.
 */
export async function getUnreadEmailCount(accessToken: string, mailboxEmail?: string): Promise<{ count: number; accessible: boolean }> {
  const client = createGraphClient(accessToken);
  
  // For shared mailboxes, we need to use a different approach
  // Using /me/mailFolders with shared mailbox requires Full Access delegation in Exchange
  const basePath = mailboxEmail ? `/users/${mailboxEmail}` : '/me';
  
  try {
    const result = await client.api(`${basePath}/mailFolders/inbox`)
      .select('unreadItemCount')
      .get();
    
    return { count: result.unreadItemCount || 0, accessible: true };
  } catch (error: any) {
    // Check if this is a permission/access error for shared mailbox
    if (mailboxEmail && (error.code === 'ErrorItemNotFound' || error.code === 'ErrorAccessDenied' || error.statusCode === 404 || error.statusCode === 403)) {
      console.warn(`[MS365] No access to shared mailbox ${mailboxEmail} - user may need Full Access delegation`);
      return { count: -1, accessible: false };
    }
    console.error(`[MS365] Error getting unread count for ${mailboxEmail || 'me'}:`, error);
    return { count: 0, accessible: true };
  }
}

/**
 * Get recent emails from a mailbox
 * @param accessToken - Access token
 * @param mailboxEmail - Optional shared mailbox email. If not provided, uses user's own mailbox.
 * @param top - Number of emails to fetch (default 10)
 * @param onlyUnread - Only fetch unread emails
 */
export async function getRecentEmails(
  accessToken: string,
  mailboxEmail?: string,
  top: number = 10,
  onlyUnread: boolean = false
): Promise<any[]> {
  const client = createGraphClient(accessToken);
  
  const basePath = mailboxEmail ? `/users/${mailboxEmail}` : '/me';
  
  try {
    let request = client.api(`${basePath}/mailFolders/inbox/messages`)
      .select('id,subject,from,receivedDateTime,isRead,bodyPreview')
      .orderby('receivedDateTime desc')
      .top(top);
    
    if (onlyUnread) {
      request = request.filter('isRead eq false');
    }
    
    const result = await request.get();
    return result.value || [];
  } catch (error) {
    console.error(`[MS365] Error getting emails for ${mailboxEmail || 'me'}:`, error);
    return [];
  }
}

/**
 * Get combined unread counts for user's own mailbox and all shared mailboxes
 */
export async function getAllMailboxUnreadCounts(
  accessToken: string, 
  sharedMailboxEmails: string[]
): Promise<{ mailbox: string; unreadCount: number; accessible: boolean }[]> {
  const results: { mailbox: string; unreadCount: number; accessible: boolean }[] = [];
  
  // Get user's own mailbox count
  const personalResult = await getUnreadEmailCount(accessToken);
  results.push({ mailbox: 'personal', unreadCount: personalResult.count, accessible: personalResult.accessible });
  
  // Get shared mailbox counts
  for (const email of sharedMailboxEmails) {
    const sharedResult = await getUnreadEmailCount(accessToken, email);
    results.push({ mailbox: email, unreadCount: sharedResult.count, accessible: sharedResult.accessible });
  }
  
  return results;
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
