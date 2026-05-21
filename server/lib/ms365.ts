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
  isHtml: boolean = true,
  cc?: string[],
  attachments?: Array<{ name: string; contentType: string; contentBase64: string }>,
  bcc?: string[]
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
  };
  
  if (cc && cc.length > 0) {
    message.ccRecipients = cc.map(email => ({
      emailAddress: { address: email },
    }));
  }

  if (bcc && bcc.length > 0) {
    message.bccRecipients = bcc.map(email => ({
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

export async function searchPeople(accessToken: string, query: string, top: number = 10): Promise<any[]> {
  const client = createGraphClient(accessToken);
  const mapPerson = (p: any) => ({
    displayName: p.displayName || '',
    email: p.emailAddresses?.[0]?.address || p.mail || p.userPrincipalName || '',
    givenName: p.givenName || '',
    surname: p.surname || '',
  });

  try {
    const result = await client.api('/me/people')
      .search(query)
      .top(top)
      .select('displayName,emailAddresses,userPrincipalName,givenName,surname')
      .get();
    const people = (result?.value || []).map(mapPerson).filter((p: any) => p.email);
    if (people.length > 0) return people;
  } catch (error: any) {
    console.log('[MS365] /me/people search failed, trying /users fallback:', error?.message);
  }

  try {
    const result = await client.api('/users')
      .filter(`startsWith(displayName,'${query.replace(/'/g, "''")}') or startsWith(mail,'${query.replace(/'/g, "''")}')`)
      .top(top)
      .select('displayName,mail,userPrincipalName,givenName,surname')
      .get();
    return (result?.value || []).map((u: any) => ({
      displayName: u.displayName || '',
      email: u.mail || u.userPrincipalName || '',
      givenName: u.givenName || '',
      surname: u.surname || '',
    })).filter((p: any) => p.email);
  } catch (error: any) {
    console.log('[MS365] /users search also failed:', error?.message);
  }

  try {
    const contacts = await client.api('/me/contacts')
      .filter(`startsWith(displayName,'${query.replace(/'/g, "''")}')`)
      .top(top)
      .select('displayName,emailAddresses,givenName,surname')
      .get();
    return (contacts?.value || []).map(mapPerson).filter((p: any) => p.email);
  } catch (error: any) {
    console.log('[MS365] /me/contacts search also failed:', error?.message);
    return [];
  }
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

/**
 * Get inbox folder ID reliably using Graph API well-known folder path
 */
export async function getInboxFolderId(accessToken: string, mailboxEmail?: string): Promise<string | null> {
  const client = createGraphClient(accessToken);
  const basePath = mailboxEmail ? `/users/${mailboxEmail}` : '/me';
  
  try {
    const result = await client.api(`${basePath}/mailFolders/inbox`)
      .select('id')
      .get();
    return result?.id || null;
  } catch (error) {
    console.error(`[MS365] Error getting inbox folder ID:`, error);
    return null;
  }
}

/**
 * Get mail folders (inbox, sent, drafts, etc.) - includes child folders recursively up to specified depth
 */
export async function getMailFolders(accessToken: string, mailboxEmail?: string, includeChildren: boolean = true, maxDepth: number = 3): Promise<any[]> {
  const client = createGraphClient(accessToken);
  const basePath = mailboxEmail ? `/users/${mailboxEmail}` : '/me';
  
  // Recursive function to fetch child folders
  async function fetchChildFolders(parentId: string, parentDisplayName: string, depth: number): Promise<any[]> {
    if (depth > maxDepth) return [];
    
    try {
      const childResult = await client.api(`${basePath}/mailFolders/${parentId}/childFolders`)
        .select('id,displayName,parentFolderId,childFolderCount,unreadItemCount,totalItemCount')
        .top(50)
        .get();
      
      const children = (childResult.value || []).map((child: any) => ({
        ...child,
        isChildFolder: true,
        parentDisplayName: parentDisplayName,
        depth: depth,
        hasChildren: child.childFolderCount > 0,
      }));
      
      // Recursively fetch grandchildren
      const grandchildrenPromises = children
        .filter((c: any) => c.childFolderCount > 0)
        .map((child: any) => fetchChildFolders(child.id, child.displayName, depth + 1));
      
      const grandchildren = (await Promise.all(grandchildrenPromises)).flat();
      
      return [...children, ...grandchildren];
    } catch (err) {
      console.warn(`[MS365] Could not fetch child folders for ${parentDisplayName}`);
      return [];
    }
  }
  
  try {
    const result = await client.api(`${basePath}/mailFolders`)
      .select('id,displayName,parentFolderId,childFolderCount,unreadItemCount,totalItemCount')
      .top(100)
      .get();
    
    const folders = result.value || [];
    
    // If includeChildren is true, fetch child folders recursively
    if (includeChildren) {
      const foldersWithChildren = folders.filter((f: any) => f.childFolderCount > 0);
      
      const childFolderPromises = foldersWithChildren.map(async (parent: any) => 
        fetchChildFolders(parent.id, parent.displayName, 1)
      );
      
      const allChildFolders = (await Promise.all(childFolderPromises)).flat();
      
      // Mark parent folders and combine
      const markedFolders = folders.map((f: any) => ({
        ...f,
        hasChildren: f.childFolderCount > 0,
        isChildFolder: false,
        depth: 0,
      }));
      
      return [...markedFolders, ...allChildFolders];
    }
    
    return folders;
  } catch (error) {
    console.error(`[MS365] Error getting mail folders:`, error);
    return [];
  }
}

/**
 * Get emails from a specific folder
 */
export async function getMailFolderMessages(
  accessToken: string,
  folderId: string,
  mailboxEmail?: string,
  top: number = 50,
  skip: number = 0
): Promise<{ emails: any[]; totalCount: number }> {
  const client = createGraphClient(accessToken);
  const basePath = mailboxEmail ? `/users/${mailboxEmail}` : '/me';
  
  try {
    const countResult = await client.api(`${basePath}/mailFolders/${folderId}/messages/$count`).get();
    
    const result = await client.api(`${basePath}/mailFolders/${folderId}/messages`)
      .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isRead,bodyPreview,hasAttachments,importance,flag')
      .orderby('receivedDateTime desc')
      .top(top)
      .skip(skip)
      .get();
    
    return { emails: result.value || [], totalCount: countResult || 0 };
  } catch (error) {
    console.error(`[MS365] Error getting folder messages:`, error);
    return { emails: [], totalCount: 0 };
  }
}

/**
 * Search emails across mailbox using Graph $search with KQL
 */
export async function searchEmails(
  accessToken: string,
  searchQuery: string,
  mailboxEmail?: string,
  top: number = 50,
  dateFrom?: string,
  dateTo?: string,
  fetchAll: boolean = false
): Promise<{ emails: any[]; totalCount: number }> {
  const client = createGraphClient(accessToken);
  const basePath = mailboxEmail ? `/users/${mailboxEmail}` : '/me';
  
  const sanitizedQuery = searchQuery
    .replace(/["\\\n\r\t]/g, ' ')
    .trim();
  
  const hasDateFilter = dateFrom || dateTo;
  
  if (!sanitizedQuery && !hasDateFilter) {
    return { emails: [], totalCount: 0 };
  }
  
  try {
    let allEmails: any[] = [];
    const pageSize = fetchAll ? 250 : Math.min(top, 250);
    const maxPages = fetchAll ? 20 : 1;
    
    let request = client.api(`${basePath}/messages`)
      .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isRead,bodyPreview,hasAttachments,importance,flag,parentFolderId')
      .top(pageSize);
    
    if (sanitizedQuery) {
      request = request.search(`"${sanitizedQuery}"`);
    } else {
      request = request.orderby('receivedDateTime desc');
    }
    
    if (hasDateFilter && !sanitizedQuery) {
      const filters: string[] = [];
      if (dateFrom) {
        filters.push(`receivedDateTime ge ${dateFrom}T00:00:00Z`);
      }
      if (dateTo) {
        filters.push(`receivedDateTime le ${dateTo}T23:59:59Z`);
      }
      request = request.filter(filters.join(' and '));
    }
    
    let page = 0;
    let nextLink: string | null = null;
    
    const firstResult = await request.get();
    allEmails.push(...(firstResult.value || []));
    nextLink = firstResult['@odata.nextLink'] || null;
    page++;
    
    while (fetchAll && nextLink && page < maxPages) {
      try {
        const nextResult = await client.api(nextLink).get();
        allEmails.push(...(nextResult.value || []));
        nextLink = nextResult['@odata.nextLink'] || null;
        page++;
      } catch (pageError) {
        console.error(`[MS365] Error fetching search page ${page}:`, pageError);
        break;
      }
    }
    
    if (hasDateFilter && sanitizedQuery) {
      allEmails = allEmails.filter(email => {
        const received = new Date(email.receivedDateTime);
        if (dateFrom && received < new Date(`${dateFrom}T00:00:00Z`)) return false;
        if (dateTo && received > new Date(`${dateTo}T23:59:59Z`)) return false;
        return true;
      });
    }
    
    return { emails: allEmails, totalCount: allEmails.length, hasMore: !!nextLink } as any;
  } catch (error) {
    console.error(`[MS365] Error searching emails:`, error);
    return { emails: [], totalCount: 0 };
  }
}

/**
 * Get single email with full body
 */
export async function getEmailById(
  accessToken: string,
  emailId: string,
  mailboxEmail?: string
): Promise<any | null> {
  const client = createGraphClient(accessToken);
  const basePath = mailboxEmail ? `/users/${mailboxEmail}` : '/me';
  
  try {
    const result = await client.api(`${basePath}/messages/${emailId}`)
      .select('id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,isRead,body,bodyPreview,hasAttachments,importance,flag,conversationId,internetMessageId')
      .get();
    return result;
  } catch (error) {
    console.error(`[MS365] Error getting email by ID:`, error);
    return null;
  }
}

/**
 * Mark email as read/unread
 */
export async function markEmailAsRead(
  accessToken: string,
  emailId: string,
  isRead: boolean = true,
  mailboxEmail?: string
): Promise<boolean> {
  const client = createGraphClient(accessToken);
  const basePath = mailboxEmail ? `/users/${mailboxEmail}` : '/me';
  
  try {
    await client.api(`${basePath}/messages/${emailId}`)
      .update({ isRead });
    return true;
  } catch (error) {
    console.error(`[MS365] Error marking email as read:`, error);
    return false;
  }
}

/**
 * Send email with optional HTML signature
 */
export async function sendEmailWithSignature(
  accessToken: string,
  to: string[],
  subject: string,
  body: string,
  signature: string = '',
  isHtml: boolean = true,
  cc: string[] = [],
  bcc: string[] = [],
  mailboxEmail?: string,
  importance?: string,
  attachments?: Array<{ name: string; contentType: string; contentBytes: string }>
): Promise<boolean> {
  const client = createGraphClient(accessToken);
  const basePath = mailboxEmail ? `/users/${mailboxEmail}` : '/me';
  
  let finalBody = body;
  const bodyAlreadyHasSignature = body.includes('class="email-signature"');
  if (signature && !bodyAlreadyHasSignature) {
    if (isHtml) {
      finalBody = `${body}<br/><br/>--<br/>${signature}`;
    } else {
      finalBody = `${body}\n\n--\n${signature}`;
    }
  }
  
  const message: any = {
    subject,
    body: {
      contentType: isHtml ? 'HTML' : 'Text',
      content: finalBody,
    },
    toRecipients: to.map(email => ({ emailAddress: { address: email } })),
    ccRecipients: cc.map(email => ({ emailAddress: { address: email } })),
    bccRecipients: bcc.map(email => ({ emailAddress: { address: email } })),
  };

  if (importance && ['low', 'normal', 'high'].includes(importance)) {
    message.importance = importance;
  }

  if (attachments && attachments.length > 0) {
    message.attachments = attachments.map(att => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: att.name,
      contentType: att.contentType,
      contentBytes: att.contentBytes,
    }));
  }
  
  try {
    await client.api(`${basePath}/sendMail`).post({ message, saveToSentItems: true });
    return true;
  } catch (error) {
    console.error('[MS365] Error sending email with signature:', error);
    return false;
  }
}

/**
 * Reply to an email
 */
export async function replyToEmail(
  accessToken: string,
  emailId: string,
  body: string,
  signature: string = '',
  isHtml: boolean = true,
  replyAll: boolean = false,
  mailboxEmail?: string,
  cc?: string[],
  bcc?: string[],
  attachments?: Array<{ name: string; contentType: string; contentBytes: string }>
): Promise<boolean> {
  const client = createGraphClient(accessToken);
  const basePath = mailboxEmail ? `/users/${mailboxEmail}` : '/me';
  
  let finalBody = body;
  const bodyAlreadyHasSignature = body.includes('class="email-signature"');
  if (signature && !bodyAlreadyHasSignature) {
    if (isHtml) {
      finalBody = `${body}<br/><br/>--<br/>${signature}`;
    } else {
      finalBody = `${body}\n\n--\n${signature}`;
    }
  }

  if (attachments && attachments.length > 0) {
    try {
      const endpoint = replyAll ? 'createReplyAll' : 'createReply';
      const draft = await client.api(`${basePath}/messages/${emailId}/${endpoint}`).post({});
      const draftId = draft.id;

      const updateBody: any = {
        body: { contentType: isHtml ? 'HTML' : 'Text', content: finalBody },
      };
      if (cc && cc.length > 0) {
        updateBody.ccRecipients = cc.map((email: string) => ({ emailAddress: { address: email } }));
      }
      if (bcc && bcc.length > 0) {
        updateBody.bccRecipients = bcc.map((email: string) => ({ emailAddress: { address: email } }));
      }
      await client.api(`${basePath}/messages/${draftId}`).patch(updateBody);

      for (const att of attachments) {
        await client.api(`${basePath}/messages/${draftId}/attachments`).post({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: att.name,
          contentType: att.contentType,
          contentBytes: att.contentBytes,
        });
      }

      await client.api(`${basePath}/messages/${draftId}/send`).post({});
      return true;
    } catch (error) {
      console.error('[MS365] Error replying with attachments:', error);
      return false;
    }
  }
  
  const message: any = {};
  if (cc && cc.length > 0) {
    message.ccRecipients = cc.map(email => ({ emailAddress: { address: email } }));
  }
  if (bcc && bcc.length > 0) {
    message.bccRecipients = bcc.map(email => ({ emailAddress: { address: email } }));
  }

  const reply = {
    message,
    comment: finalBody,
  };
  
  try {
    const endpoint = replyAll ? 'replyAll' : 'reply';
    await client.api(`${basePath}/messages/${emailId}/${endpoint}`).post(reply);
    return true;
  } catch (error) {
    console.error('[MS365] Error replying to email:', error);
    return false;
  }
}

/**
 * Forward an email
 */
export async function forwardEmail(
  accessToken: string,
  emailId: string,
  to: string[],
  body: string,
  signature: string = '',
  isHtml: boolean = true,
  mailboxEmail?: string,
  cc?: string[],
  bcc?: string[],
  attachments?: Array<{ name: string; contentType: string; contentBytes: string }>
): Promise<boolean> {
  const client = createGraphClient(accessToken);
  const basePath = mailboxEmail ? `/users/${mailboxEmail}` : '/me';
  
  let finalBody = body;
  const bodyAlreadyHasSignature = body.includes('class="email-signature"');
  if (signature && !bodyAlreadyHasSignature) {
    if (isHtml) {
      finalBody = `${body}<br/><br/>--<br/>${signature}`;
    } else {
      finalBody = `${body}\n\n--\n${signature}`;
    }
  }

  if (attachments && attachments.length > 0) {
    try {
      const draft = await client.api(`${basePath}/messages/${emailId}/createForward`).post({});
      const draftId = draft.id;

      const updateBody: any = {
        body: { contentType: isHtml ? 'HTML' : 'Text', content: finalBody },
        toRecipients: to.map((email: string) => ({ emailAddress: { address: email } })),
      };
      if (cc && cc.length > 0) {
        updateBody.ccRecipients = cc.map((email: string) => ({ emailAddress: { address: email } }));
      }
      if (bcc && bcc.length > 0) {
        updateBody.bccRecipients = bcc.map((email: string) => ({ emailAddress: { address: email } }));
      }
      await client.api(`${basePath}/messages/${draftId}`).patch(updateBody);

      for (const att of attachments) {
        await client.api(`${basePath}/messages/${draftId}/attachments`).post({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: att.name,
          contentType: att.contentType,
          contentBytes: att.contentBytes,
        });
      }

      await client.api(`${basePath}/messages/${draftId}/send`).post({});
      return true;
    } catch (error) {
      console.error('[MS365] Error forwarding with attachments:', error);
      return false;
    }
  }
  
  const forward: any = {
    toRecipients: to.map(email => ({ emailAddress: { address: email } })),
    comment: finalBody,
  };
  if (cc && cc.length > 0) {
    forward.ccRecipients = cc.map(email => ({ emailAddress: { address: email } }));
  }
  if (bcc && bcc.length > 0) {
    forward.bccRecipients = bcc.map(email => ({ emailAddress: { address: email } }));
  }
  
  try {
    await client.api(`${basePath}/messages/${emailId}/forward`).post(forward);
    return true;
  } catch (error) {
    console.error('[MS365] Error forwarding email:', error);
    return false;
  }
}

/**
 * Delete email (move to deleted items)
 */
export async function deleteEmail(
  accessToken: string,
  emailId: string,
  mailboxEmail?: string
): Promise<boolean> {
  const client = createGraphClient(accessToken);
  const basePath = mailboxEmail ? `/users/${mailboxEmail}` : '/me';
  
  try {
    await client.api(`${basePath}/messages/${emailId}`).delete();
    return true;
  } catch (error) {
    console.error('[MS365] Error deleting email:', error);
    return false;
  }
}

export async function getEmailAttachments(
  accessToken: string,
  emailId: string,
  mailboxEmail?: string
): Promise<any[]> {
  const client = createGraphClient(accessToken);
  const basePath = mailboxEmail ? `/users/${mailboxEmail}` : '/me';
  try {
    const result = await client.api(`${basePath}/messages/${emailId}/attachments`).get();
    return result.value || [];
  } catch (error) {
    console.error('[MS365] Error getting attachments:', error);
    return [];
  }
}

export async function getEmailAttachmentContent(
  accessToken: string,
  emailId: string,
  attachmentId: string,
  mailboxEmail?: string
): Promise<any | null> {
  const client = createGraphClient(accessToken);
  const basePath = mailboxEmail ? `/users/${mailboxEmail}` : '/me';
  try {
    const result = await client.api(`${basePath}/messages/${emailId}/attachments/${attachmentId}`).get();
    return result;
  } catch (error) {
    console.error('[MS365] Error getting attachment content:', error);
    return null;
  }
}

export async function getTeamsChats(
  accessToken: string
): Promise<{ chats: any[] }> {
  const client = createGraphClient(accessToken);
  let result: any;
  try {
    result = await client.api('/me/chats')
      .select('id,topic,chatType,createdDateTime,lastUpdatedDateTime,webUrl')
      .expand('members,lastMessagePreview')
      .top(50)
      .get();
  } catch (expandError: any) {
    console.warn('[MS365] Chats expand(members) failed, trying without expand:', expandError?.code || expandError?.message);
    try {
      result = await client.api('/me/chats')
        .select('id,topic,chatType,createdDateTime,lastUpdatedDateTime,webUrl')
        .expand('lastMessagePreview')
        .top(50)
        .get();
    } catch (fallbackError: any) {
      console.warn('[MS365] Chats expand(lastMessagePreview) also failed, basic fetch:', fallbackError?.code);
      result = await client.api('/me/chats')
        .select('id,topic,chatType,createdDateTime,lastUpdatedDateTime,webUrl')
        .top(50)
        .get();
    }
  }
  const rawChats = result.value || [];

  const chats = await Promise.all(rawChats.map(async (chat: any) => {
    let members = (chat.members || []).map((m: any) => ({
      id: m.id,
      userId: m.userId,
      displayName: m.displayName,
      email: m.email,
    })).filter((m: any) => m.displayName);

    if (members.length === 0) {
      try {
        const membersResult = await client.api(`/me/chats/${chat.id}/members`).get();
        members = (membersResult.value || []).map((m: any) => ({
          id: m.id,
          userId: m.userId,
          displayName: m.displayName,
          email: m.email,
        })).filter((m: any) => m.displayName);
      } catch {
      }
    }

    const memberNames = members.map((m: any) => m.displayName).filter(Boolean);
    const displayTopic = chat.topic || memberNames.join(', ') || 
      (chat.lastMessagePreview?.from?.user?.displayName ? chat.lastMessagePreview.from.user.displayName : null) ||
      (chat.chatType === 'oneOnOne' ? 'Direct Chat' : chat.chatType === 'group' ? 'Group Chat' : 'Chat');

    return {
      id: chat.id,
      topic: displayTopic,
      chatType: chat.chatType,
      createdDateTime: chat.createdDateTime,
      lastUpdatedDateTime: chat.lastUpdatedDateTime,
      webUrl: chat.webUrl || null,
      lastMessagePreview: chat.lastMessagePreview ? {
        body: chat.lastMessagePreview.body?.content || '',
        from: chat.lastMessagePreview.from?.user?.displayName || null,
        createdDateTime: chat.lastMessagePreview.createdDateTime,
      } : null,
      members,
    };
  }));

  chats.sort((a: any, b: any) => {
    const dateA = a.lastUpdatedDateTime ? new Date(a.lastUpdatedDateTime).getTime() : 0;
    const dateB = b.lastUpdatedDateTime ? new Date(b.lastUpdatedDateTime).getTime() : 0;
    return dateB - dateA;
  });
  return { chats };
}

export async function getTeamsChatMessages(
  accessToken: string,
  chatId: string,
  top: number = 30
): Promise<{ messages: any[] }> {
  const client = createGraphClient(accessToken);
  const result = await client.api(`/me/chats/${chatId}/messages`)
    .top(top)
    .orderby('createdDateTime desc')
    .get();
  const messages = (result.value || [])
    .filter((m: any) => m.messageType === 'message')
    .map((msg: any) => ({
      id: msg.id,
      body: msg.body?.content || '',
      contentType: msg.body?.contentType || 'text',
      from: msg.from?.user?.displayName || 'Neznámy',
      fromEmail: msg.from?.user?.email || null,
      createdDateTime: msg.createdDateTime,
      importance: msg.importance,
      attachments: (msg.attachments || []).map((att: any) => ({
        id: att.id,
        name: att.name,
        contentType: att.contentType,
        contentUrl: att.contentUrl,
        thumbnailUrl: att.thumbnailUrl,
      })),
    }));
  return { messages };
}

export async function uploadFileToOneDriveAndAttachToChat(
  accessToken: string,
  chatId: string,
  fileName: string,
  fileBuffer: Buffer,
  fileMimeType: string,
  messageText?: string
): Promise<any> {
  const client = createGraphClient(accessToken);
  const uploadPath = `/me/drive/root:/Teams Chat Files/${fileName}:/content`;
  const uploaded = await client.api(uploadPath)
    .header('Content-Type', fileMimeType)
    .put(fileBuffer);

  const attachmentId = uploaded.id;
  const webUrl = uploaded.webUrl;
  const eTag = uploaded.eTag?.replace(/[{}]/g, '') || uploaded.id;

  const messageBody: any = {
    body: {
      contentType: 'html',
      content: messageText
        ? `${messageText}<br/><attachment id="${attachmentId}"></attachment>`
        : `<attachment id="${attachmentId}"></attachment>`,
    },
    attachments: [{
      id: attachmentId,
      contentType: 'reference',
      contentUrl: webUrl,
      name: fileName,
    }],
  };

  const result = await client.api(`/me/chats/${chatId}/messages`).post(messageBody);
  return result;
}

export async function getJoinedTeams(
  accessToken: string
): Promise<{ teams: any[] }> {
  const client = createGraphClient(accessToken);
  const result = await client.api('/me/joinedTeams')
    .select('id,displayName,description')
    .get();
  return { teams: result.value || [] };
}

export async function getTeamChannels(
  accessToken: string,
  teamId: string
): Promise<{ channels: any[] }> {
  const client = createGraphClient(accessToken);
  const result = await client.api(`/teams/${teamId}/channels`)
    .select('id,displayName,description,membershipType')
    .get();
  return { channels: result.value || [] };
}

export async function getChannelMessages(
  accessToken: string,
  teamId: string,
  channelId: string,
  top: number = 30
): Promise<{ messages: any[] }> {
  const client = createGraphClient(accessToken);
  const result = await client.api(`/teams/${teamId}/channels/${channelId}/messages`)
    .top(top)
    .get();
  const messages = (result.value || [])
    .filter((m: any) => m.messageType === 'message')
    .map((msg: any) => ({
      id: msg.id,
      body: msg.body?.content || '',
      contentType: msg.body?.contentType || 'text',
      from: msg.from?.user?.displayName || 'Neznámy',
      fromEmail: msg.from?.user?.email || null,
      createdDateTime: msg.createdDateTime,
      importance: msg.importance,
      subject: msg.subject || null,
    }));
  return { messages };
}

export async function sendTeamsChatMessage(
  accessToken: string,
  chatId: string,
  content: string
): Promise<any> {
  const client = createGraphClient(accessToken);
  const result = await client.api(`/me/chats/${chatId}/messages`).post({
    body: { contentType: 'html', content },
  });
  return result;
}

export async function createOnlineMeeting(
  accessToken: string,
  subject: string,
  startDateTime?: string,
  endDateTime?: string,
  participantEmails?: string[]
): Promise<any> {
  const client = createGraphClient(accessToken);
  const now = new Date();
  const startRaw = startDateTime || now.toISOString();
  const endRaw = endDateTime || new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const start = startRaw.replace('Z', '').replace(/\.\d{3}$/, '');
  const end = endRaw.replace('Z', '').replace(/\.\d{3}$/, '');

  try {
    const eventPayload: any = {
      subject,
      start: {
        dateTime: start,
        timeZone: 'UTC',
      },
      end: {
        dateTime: end,
        timeZone: 'UTC',
      },
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
      allowNewTimeProposals: true,
    };

    if (participantEmails && participantEmails.length > 0) {
      eventPayload.attendees = participantEmails.map(email => ({
        emailAddress: { address: email },
        type: 'required',
      }));
    }

    let calendarEvent: any;
    try {
      calendarEvent = await client.api('/me/events').post(eventPayload);
    } catch (e: any) {
      if (e?.statusCode === 400 || e?.code === 'ErrorInvalidOnlineMeetingProvider') {
        eventPayload.onlineMeetingProvider = 'teamsForBusiness';
        delete eventPayload.allowNewTimeProposals;
        calendarEvent = await client.api('/me/events').post(eventPayload);
      } else {
        throw e;
      }
    }

    const joinUrl = calendarEvent.onlineMeeting?.joinUrl || calendarEvent.onlineMeetingUrl;
    const onlineMeetingId = calendarEvent.onlineMeeting?.conferenceId;

    return {
      id: onlineMeetingId || calendarEvent.id,
      calendarEventId: calendarEvent.id,
      joinUrl,
      subject: calendarEvent.subject,
      startDateTime: calendarEvent.start?.dateTime,
      endDateTime: calendarEvent.end?.dateTime,
      videoTeleconferenceId: onlineMeetingId,
    };
  } catch (calendarError: any) {
    console.warn('[MS365] Calendar event approach failed, trying /me/onlineMeetings fallback:', calendarError?.message || calendarError?.code);

    try {
      const meetingPayload: any = {
        subject,
        startDateTime: startRaw,
        endDateTime: endRaw,
      };

      if (participantEmails && participantEmails.length > 0) {
        meetingPayload.participants = {
          attendees: participantEmails.map(email => ({
            upn: email,
            role: 'attendee',
          })),
        };
      }

      const meeting = await client.api('/me/onlineMeetings').post(meetingPayload);
      const joinUrl = meeting.joinWebUrl || meeting.joinUrl;

      let calendarEventId: string | null = null;
      try {
        const calEventPayload: any = {
          subject,
          start: { dateTime: start, timeZone: 'UTC' },
          end: { dateTime: end, timeZone: 'UTC' },
          body: {
            contentType: 'HTML',
            content: `<p>Teams Meeting</p><p><a href="${joinUrl}">Join Microsoft Teams Meeting</a></p>`,
          },
        };
        if (participantEmails && participantEmails.length > 0) {
          calEventPayload.attendees = participantEmails.map(email => ({
            emailAddress: { address: email },
            type: 'required',
          }));
        }
        const calEvent = await client.api('/me/events').post(calEventPayload);
        calendarEventId = calEvent.id;
        console.log('[MS365] Calendar event created alongside online meeting');
      } catch (calErr: any) {
        console.warn('[MS365] Could not create calendar event (no Calendars.ReadWrite?), meeting link still available:', calErr?.message || calErr?.code);
      }

      return {
        id: meeting.id,
        calendarEventId,
        joinUrl,
        subject: meeting.subject,
        startDateTime: meeting.startDateTime,
        endDateTime: meeting.endDateTime,
        videoTeleconferenceId: meeting.videoTeleconferenceId,
      };
    } catch (onlineMeetingError: any) {
      console.error('[MS365] Both meeting creation approaches failed.');
      console.error('[MS365] Calendar event error:', calendarError?.message || calendarError);
      console.error('[MS365] OnlineMeetings error:', onlineMeetingError?.message || onlineMeetingError);
      throw onlineMeetingError;
    }
  }
}

export async function getChatMembers(
  accessToken: string,
  chatId: string
): Promise<any[]> {
  const client = createGraphClient(accessToken);
  try {
    const result = await client.api(`/me/chats/${chatId}/members`).get();
    return (result.value || []).map((m: any) => ({
      id: m.id,
      userId: m.userId,
      displayName: m.displayName,
      email: m.email,
      roles: m.roles || [],
    }));
  } catch (error) {
    console.error('[MS365] Error fetching chat members:', error);
    return [];
  }
}

// ============ Teams Meetings & Transcripts ============

export async function getRecentMeetings(
  accessToken: string,
  top: number = 50
): Promise<any[]> {
  const client = createGraphClient(accessToken);
  try {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const result = await client.api('/me/onlineMeetings')
      .filter(`startDateTime ge ${pastDate.toISOString()} and startDateTime le ${now.toISOString()}`)
      .top(top)
      .orderby('startDateTime desc')
      .get();
    return (result?.value || []).map((m: any) => ({
      id: m.id,
      subject: m.subject || 'Meeting',
      startDateTime: m.startDateTime,
      endDateTime: m.endDateTime,
      joinUrl: m.joinWebUrl || m.joinUrl,
      participants: m.participants?.attendees?.map((a: any) => ({
        email: a.upn || a.identity?.user?.id,
        displayName: a.identity?.user?.displayName,
      })) || [],
    }));
  } catch (error) {
    console.error('[MS365] Error fetching recent meetings:', error);
    return [];
  }
}

export async function getMeetingTranscripts(
  accessToken: string,
  meetingId: string
): Promise<any[]> {
  const client = createGraphClient(accessToken);
  try {
    const result = await client.api(`/me/onlineMeetings/${meetingId}/transcripts`).get();
    return (result?.value || []).map((t: any) => ({
      id: t.id,
      createdDateTime: t.createdDateTime,
      meetingId,
    }));
  } catch (error) {
    console.error('[MS365] Error fetching meeting transcripts:', error);
    return [];
  }
}

export async function getMeetingTranscriptContent(
  accessToken: string,
  meetingId: string,
  transcriptId: string
): Promise<string> {
  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content?$format=text/vtt`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    console.error('[MS365] Error fetching transcript content:', error);
    throw error;
  }
}

export async function getMeetingRecordings(
  accessToken: string,
  meetingId: string
): Promise<any[]> {
  const client = createGraphClient(accessToken);
  try {
    const result = await client.api(`/me/onlineMeetings/${meetingId}/recordings`).get();
    return (result?.value || []).map((r: any) => ({
      id: r.id,
      createdDateTime: r.createdDateTime,
      meetingId,
    }));
  } catch (error) {
    console.error('[MS365] Error fetching meeting recordings:', error);
    return [];
  }
}

// ============ SharePoint / NexusPoint functions ============

export async function getSharePointSites(accessToken: string): Promise<any[]> {
  const client = createGraphClient(accessToken);
  try {
    const allSites: any[] = [];
    let response = await client.api('/sites?search=*').select('id,displayName,webUrl,description').top(100).get();
    while (response) {
      if (response?.value) allSites.push(...response.value);
      const nextLink = response['@odata.nextLink'];
      if (nextLink) {
        response = await client.api(nextLink).get();
      } else {
        break;
      }
    }
    return allSites;
  } catch (error) {
    console.error('[MS365] Error fetching SharePoint sites:', error);
    return [];
  }
}

export async function moveSharePointItem(accessToken: string, driveId: string, itemId: string, targetFolderId: string | null, targetDriveId?: string | null): Promise<any> {
  const destDriveId = targetDriveId || driveId;
  const isCrossDrive = !!targetDriveId && targetDriveId !== driveId;
  console.log(`[SharePoint] moveItem: driveId=${driveId} itemId=${itemId} destDriveId=${destDriveId} targetFolderId=${targetFolderId} isCrossDrive=${isCrossDrive}`);

  // Resolve destination folder id — required by Graph API PATCH move
  let destFolderId = targetFolderId;
  if (!destFolderId) {
    // Fetch root folder id of destination drive
    const rootResp = await fetch(`https://graph.microsoft.com/v1.0/drives/${destDriveId}/root?$select=id`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    if (!rootResp.ok) {
      const errText = await rootResp.text().catch(() => "");
      throw new Error(`Cannot resolve root of dest drive: HTTP ${rootResp.status} ${errText}`);
    }
    const rootData = await rootResp.json() as any;
    destFolderId = rootData?.id || null;
    console.log(`[SharePoint] Resolved dest root folder id: ${destFolderId}`);
  }

  if (isCrossDrive) {
    // Cross-drive: try PATCH first (works within same tenant in SharePoint Online)
    // Fall back to copy+delete if PATCH returns 400/501
    const patchBody = {
      parentReference: { driveId: destDriveId, id: destFolderId },
    };
    console.log(`[SharePoint] Cross-drive PATCH attempt:`, JSON.stringify(patchBody));
    const patchResp = await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    });
    console.log(`[SharePoint] PATCH status: ${patchResp.status}`);
    if (patchResp.ok) {
      const result = await patchResp.json();
      return result;
    }
    // PATCH not supported cross-drive — fall back to copy+delete
    const patchErrText = await patchResp.text().catch(() => "");
    console.warn(`[SharePoint] Cross-drive PATCH failed (${patchResp.status}), falling back to copy+delete: ${patchErrText.slice(0, 200)}`);

    const copyBody = {
      parentReference: { driveId: destDriveId, id: destFolderId },
    };
    console.log(`[SharePoint] Copy body:`, JSON.stringify(copyBody));
    const copyResp = await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/copy`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(copyBody),
    });
    console.log(`[SharePoint] Copy HTTP status: ${copyResp.status}`);
    if (copyResp.status !== 202 && copyResp.status !== 200 && copyResp.status !== 201) {
      const errBody = await copyResp.text().catch(() => "");
      throw new Error(`Copy failed: HTTP ${copyResp.status} — ${errBody.slice(0, 300)}`);
    }
    // Poll for completion
    const locationUrl = copyResp.headers.get("Location");
    if (locationUrl) {
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const pollResp = await fetch(locationUrl);
          const pollData = await pollResp.json() as any;
          console.log(`[SharePoint] Copy poll ${i + 1}: status=${pollData?.status} pct=${pollData?.percentageComplete}`);
          if (pollData?.status === "completed" || pollData?.percentageComplete === 100) break;
          if (pollData?.status === "failed") throw new Error(`Copy failed: ${pollData?.error?.message || "unknown"}`);
        } catch (e: any) {
          if (e?.message?.startsWith("Copy failed")) throw e;
          break;
        }
      }
    } else {
      await new Promise(r => setTimeout(r, 8000));
    }
    try {
      const delResp = await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      console.log(`[SharePoint] Delete original status: ${delResp.status}`);
    } catch (delErr: any) {
      console.warn(`[SharePoint] Delete original failed (non-critical): ${delErr?.message}`);
    }
    return { success: true };
  }

  // Same-drive move via PATCH
  const body = {
    parentReference: { driveId: destDriveId, id: destFolderId },
  };
  console.log(`[SharePoint] Same-drive PATCH body:`, JSON.stringify(body));
  const resp = await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`, {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`PATCH move failed: HTTP ${resp.status} — ${errText.slice(0, 300)}`);
  }
  return await resp.json();
}

export async function getSiteDrives(accessToken: string, siteId: string): Promise<any[]> {
  const client = createGraphClient(accessToken);
  try {
    const result = await client.api(`/sites/${siteId}/drives`).select('id,name,driveType,webUrl').get();
    return result?.value || [];
  } catch (error) {
    console.error('[MS365] Error fetching site drives:', error);
    return [];
  }
}

export async function getDriveItems(accessToken: string, driveId: string, folderId?: string): Promise<any[]> {
  const client = createGraphClient(accessToken);
  try {
    const path = folderId
      ? `/drives/${driveId}/items/${folderId}/children`
      : `/drives/${driveId}/root/children`;
    const result = await client.api(path)
      .select('id,name,size,lastModifiedDateTime,lastModifiedBy,file,folder,webUrl,parentReference')
      .orderby('name')
      .top(200)
      .get();
    return result?.value || [];
  } catch (error) {
    console.error('[MS365] Error fetching drive items:', error);
    return [];
  }
}

export async function createSharePointFolder(accessToken: string, driveId: string, parentFolderId: string | null, folderName: string): Promise<any> {
  const client = createGraphClient(accessToken);
  const path = parentFolderId
    ? `/drives/${driveId}/items/${parentFolderId}/children`
    : `/drives/${driveId}/root/children`;
  console.log('[MS365] createSharePointFolder path:', path, 'name:', folderName);
  try {
    const result = await client.api(path).post({
      name: folderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "rename"
    });
    return result;
  } catch (error: any) {
    console.error('[MS365] createSharePointFolder error details:', error?.statusCode, error?.code, error?.message, error?.body);
    throw error;
  }
}

export async function uploadSharePointFile(accessToken: string, driveId: string, parentFolderId: string | null, fileName: string, content: Buffer): Promise<any> {
  const SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024; // 4 MB
  const client = createGraphClient(accessToken);
  const itemPath = parentFolderId
    ? `/drives/${driveId}/items/${parentFolderId}:/${encodeURIComponent(fileName)}`
    : `/drives/${driveId}/root:/${encodeURIComponent(fileName)}`;

  if (content.length <= SIMPLE_UPLOAD_LIMIT) {
    return await client.api(`${itemPath}:/content`)
      .headers({ "Content-Type": "application/octet-stream" })
      .put(content);
  }

  // Large file — use upload session with 10 MB chunks
  const CHUNK_SIZE = 10 * 1024 * 1024;
  const sessionResp = await client.api(`${itemPath}:/createUploadSession`).post({
    item: { "@microsoft.graph.conflictBehavior": "rename" }
  });
  const uploadUrl: string = sessionResp.uploadUrl;
  const totalSize = content.length;
  let result: any;
  for (let start = 0; start < totalSize; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, totalSize - 1);
    const chunk = content.slice(start, end + 1);
    const resp = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Content-Type": "application/octet-stream",
      },
      body: chunk,
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Upload session chunk failed: ${resp.status} ${errText}`);
    }
    if (resp.status === 200 || resp.status === 201) {
      result = await resp.json();
    }
  }
  return result;
}

export async function deleteSharePointItem(accessToken: string, driveId: string, itemId: string): Promise<boolean> {
  const client = createGraphClient(accessToken);
  try {
    await client.api(`/drives/${driveId}/items/${itemId}`).delete();
    return true;
  } catch (error) {
    console.error('[MS365] Error deleting item:', error);
    return false;
  }
}

export async function getSharePointDownloadUrl(accessToken: string, driveId: string, itemId: string): Promise<string | null> {
  try {
    // Fetch full item — @microsoft.graph.downloadUrl is included for file items
    const metaResp = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (metaResp.ok) {
      const item = await metaResp.json();
      const url = item['@microsoft.graph.downloadUrl'];
      if (url) return url;
    }
    // Fallback: get redirect location via Node.js https (avoids opaque-redirect issue)
    const location = await new Promise<string | null>((resolve) => {
      const { request } = require('https');
      const req = request(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`,
        { headers: { Authorization: `Bearer ${accessToken}` }, method: 'GET' },
        (res: any) => {
          resolve(res.headers['location'] || null);
          res.destroy();
        }
      );
      req.on('error', () => resolve(null));
      req.end();
    });
    if (location) return location;
    console.warn('[MS365] Could not get download URL for item', itemId);
    return null;
  } catch (error) {
    console.error('[MS365] Error getting download URL:', error);
    return null;
  }
}

export async function searchSharePointFiles(accessToken: string, siteId: string, query: string): Promise<any[]> {
  const client = createGraphClient(accessToken);
  try {
    const result = await client.api(`/sites/${siteId}/drive/root/search(q='${encodeURIComponent(query)}')`).top(50).get();
    return result?.value || [];
  } catch (error) {
    console.error('[MS365] Error searching files:', error);
    return [];
  }
}

export async function getFileThumbnail(accessToken: string, driveId: string, itemId: string): Promise<string | null> {
  const client = createGraphClient(accessToken);
  try {
    const result = await client.api(`/drives/${driveId}/items/${itemId}/thumbnails`).get();
    const thumb = result?.value?.[0];
    return thumb?.large?.url || thumb?.medium?.url || thumb?.small?.url || null;
  } catch {
    return null;
  }
}

export async function getFileVersions(accessToken: string, driveId: string, itemId: string): Promise<any[]> {
  const client = createGraphClient(accessToken);
  try {
    const result = await client.api(`/drives/${driveId}/items/${itemId}/versions`).get();
    return result?.value || [];
  } catch (error) {
    console.error('[MS365] Error fetching versions:', error);
    return [];
  }
}

export async function restoreFileVersion(accessToken: string, driveId: string, itemId: string, versionId: string): Promise<boolean> {
  const client = createGraphClient(accessToken);
  try {
    await client.api(`/drives/${driveId}/items/${itemId}/versions/${versionId}/restoreVersion`).post({});
    return true;
  } catch (error) {
    console.error('[MS365] Error restoring version:', error);
    return false;
  }
}

export async function createSharingLink(accessToken: string, driveId: string, itemId: string, type: 'view' | 'edit' = 'view', scope: 'anonymous' | 'organization' = 'organization'): Promise<any> {
  const client = createGraphClient(accessToken);
  try {
    const result = await client.api(`/drives/${driveId}/items/${itemId}/createLink`).post({
      type,
      scope,
    });
    return result;
  } catch (error) {
    console.error('[MS365] Error creating sharing link:', error);
    return null;
  }
}

export async function getFilePermissions(accessToken: string, driveId: string, itemId: string): Promise<any[]> {
  const client = createGraphClient(accessToken);
  try {
    const result = await client.api(`/drives/${driveId}/items/${itemId}/permissions`).get();
    return result?.value || [];
  } catch (error) {
    console.error('[MS365] Error fetching permissions:', error);
    return [];
  }
}

export async function removeFilePermission(accessToken: string, driveId: string, itemId: string, permissionId: string): Promise<boolean> {
  const client = createGraphClient(accessToken);
  try {
    await client.api(`/drives/${driveId}/items/${itemId}/permissions/${permissionId}`).delete();
    return true;
  } catch (error) {
    console.error('[MS365] Error removing permission:', error);
    return false;
  }
}

export async function getFilePreviewUrl(accessToken: string, driveId: string, itemId: string): Promise<string | null> {
  const client = createGraphClient(accessToken);
  try {
    const result = await client.api(`/drives/${driveId}/items/${itemId}/preview`).post({});
    return result?.getUrl || null;
  } catch {
    return null;
  }
}

export async function getTeamsActivityFeed(
  accessToken: string
): Promise<any[]> {
  const client = createGraphClient(accessToken);
  const now = new Date();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const activities: any[] = [];

  try {
    const [chatsResult, eventsResult] = await Promise.allSettled([
      client.api('/me/chats')
        .top(50)
        .orderby('lastMessagePreview/createdDateTime desc')
        .expand('lastMessagePreview')
        .get(),
      client.api('/me/events')
        .filter(`start/dateTime ge '${threeMonthsAgo.toISOString()}' and start/dateTime le '${new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()}'`)
        .top(50)
        .orderby('start/dateTime desc')
        .select('id,subject,start,end,isOnlineMeeting,onlineMeeting,organizer,attendees,bodyPreview,webLink,createdDateTime,lastModifiedDateTime,responseStatus')
        .get(),
    ]);

    if (chatsResult.status === 'fulfilled' && chatsResult.value?.value) {
      for (const chat of chatsResult.value.value) {
        const preview = chat.lastMessagePreview;
        if (!preview) continue;
        const msgTime = new Date(preview.createdDateTime);
        if (msgTime < threeMonthsAgo) continue;
        activities.push({
          type: 'chat_message',
          id: `chat-${chat.id}-${preview.id || Date.now()}`,
          timestamp: preview.createdDateTime,
          chatId: chat.id,
          chatType: chat.chatType,
          chatTopic: chat.topic,
          senderName: preview.from?.user?.displayName || preview.from?.application?.displayName || 'Unknown',
          senderEmail: preview.from?.user?.email,
          messagePreview: preview.body?.content ? preview.body.content.replace(/<[^>]*>/g, '').substring(0, 200) : '',
          messageType: preview.messageType,
          isDeleted: preview.isDeleted,
        });
      }
    }

    if (eventsResult.status === 'fulfilled' && eventsResult.value?.value) {
      for (const event of eventsResult.value.value) {
        const eventStart = new Date(event.start?.dateTime + 'Z');
        const isFuture = eventStart > now;
        activities.push({
          type: isFuture ? 'meeting_invite' : 'meeting_past',
          id: `event-${event.id}`,
          timestamp: event.createdDateTime || event.start?.dateTime,
          subject: event.subject,
          startDateTime: event.start?.dateTime,
          endDateTime: event.end?.dateTime,
          organizerName: event.organizer?.emailAddress?.name,
          organizerEmail: event.organizer?.emailAddress?.address,
          isOnlineMeeting: event.isOnlineMeeting,
          joinUrl: event.onlineMeeting?.joinUrl,
          webLink: event.webLink,
          attendeeCount: event.attendees?.length || 0,
          responseStatus: event.responseStatus?.response,
          bodyPreview: event.bodyPreview?.substring(0, 200),
        });
      }
    }

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return activities.slice(0, 150);
  } catch (error: any) {
    console.error('[MS365] Error fetching activity feed:', error?.message || error);
    return [];
  }
}

export { MS365_CONFIG, GRAPH_SCOPES };
