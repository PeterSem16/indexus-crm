import { Version3Client } from 'jira.js';

let connectionSettings: any;
let useEnvVars = false;

function getEnvCredentials(): { host: string; email: string; apiToken: string } | null {
  const host = process.env.JIRA_HOST;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  
  console.log('[Jira] Checking env vars - JIRA_HOST:', !!host, 'JIRA_EMAIL:', !!email, 'JIRA_API_TOKEN:', !!apiToken);
  
  if (host && email && apiToken) {
    return { host, email, apiToken };
  }
  return null;
}

async function getAccessToken() {
  const envCreds = getEnvCredentials();
  if (envCreds) {
    useEnvVars = true;
    console.log('[Jira] Using environment variables for authentication');
    return { 
      hostName: envCreds.host,
      email: envCreds.email,
      apiToken: envCreds.apiToken,
      useBasicAuth: true
    };
  }

  if (connectionSettings && connectionSettings.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return { 
      accessToken: connectionSettings.settings.access_token,
      hostName: connectionSettings.settings.site_url,
      useBasicAuth: false
    };
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Jira integration not available - set JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN environment variables');
  }

  try {
    const url = 'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=jira';
    console.log('[Jira] Fetching connection from:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    });
    
    if (!response.ok) {
      console.error('[Jira] Response not OK:', response.status, response.statusText);
      throw new Error(`Failed to fetch Jira connection: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[Jira] Connection response:', JSON.stringify(data, null, 2));
    connectionSettings = data.items?.[0];
  } catch (error: any) {
    console.error('[Jira] Error fetching connection:', error.message);
    throw new Error('Jira integration not connected - please configure environment variables');
  }

  if (!connectionSettings || !connectionSettings.settings) {
    throw new Error('Jira not connected - no connection found');
  }

  const accessToken = connectionSettings.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
  const hostName = connectionSettings.settings?.site_url;

  if (!accessToken || !hostName) {
    throw new Error('Jira not connected - missing credentials');
  }

  return { accessToken, hostName, useBasicAuth: false };
}

export async function getJiraClient() {
  const creds = await getAccessToken();

  if (creds.useBasicAuth) {
    return new Version3Client({
      host: creds.hostName,
      authentication: {
        basic: { 
          email: creds.email!,
          apiToken: creds.apiToken!
        },
      },
    });
  }

  return new Version3Client({
    host: creds.hostName,
    authentication: {
      oauth2: { accessToken: creds.accessToken! },
    },
  });
}

export async function getJiraProjects() {
  const client = await getJiraClient();
  const projects = await client.projects.getAllProjects();
  return projects;
}

export async function getJiraUsers() {
  const client = await getJiraClient();
  console.log('[Jira] getJiraUsers called');
  
  // Method 1: Try getAllUsers
  try {
    const users = await client.users.getAllUsers({ startAt: 0, maxResults: 100 });
    console.log('[Jira] getAllUsers returned', users?.length || 0, 'users');
    if (users && users.length > 0) {
      return users;
    }
  } catch (e1) {
    console.log('[Jira] getAllUsers failed:', (e1 as Error).message);
  }
  
  // Method 2: Try findUsers with empty query
  try {
    const users = await client.userSearch.findUsers({
      maxResults: 100,
      query: ''
    });
    console.log('[Jira] findUsers (empty query) returned', users?.length || 0, 'users');
    if (users && users.length > 0) {
      return users;
    }
  } catch (e2) {
    console.log('[Jira] findUsers failed:', (e2 as Error).message);
  }
  
  // Method 3: Try findUsers with wildcard query
  try {
    const users = await client.userSearch.findUsers({
      maxResults: 100,
      query: 'a'
    });
    console.log('[Jira] findUsers (query=a) returned', users?.length || 0, 'users');
    if (users && users.length > 0) {
      return users;
    }
  } catch (e3) {
    console.log('[Jira] findUsers (query=a) failed:', (e3 as Error).message);
  }
  
  // Method 4: Get current user as last resort
  try {
    const myself = await client.myself.getCurrentUser();
    console.log('[Jira] getCurrentUser returned:', myself?.displayName || 'unknown');
    return [myself];
  } catch (e4) {
    console.log('[Jira] getCurrentUser failed:', (e4 as Error).message);
    return [];
  }
}

export async function getJiraIssues(projectKey: string) {
  const client = await getJiraClient();
  const issues = await client.issueSearch.searchForIssuesUsingJql({
    jql: `project = ${projectKey} ORDER BY created DESC`,
    maxResults: 50
  });
  return issues;
}

export async function createJiraIssue(data: {
  projectKey: string;
  summary: string;
  description?: string;
  issueType?: string;
  assigneeAccountId?: string;
}) {
  const client = await getJiraClient();
  
  const issueData: any = {
    fields: {
      project: { key: data.projectKey },
      summary: data.summary,
      issuetype: { name: data.issueType || 'Task' }
    }
  };

  if (data.description) {
    issueData.fields.description = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: data.description }
          ]
        }
      ]
    };
  }

  if (data.assigneeAccountId) {
    issueData.fields.assignee = { accountId: data.assigneeAccountId };
  }

  const issue = await client.issues.createIssue(issueData);
  return issue;
}

export async function syncTaskToJira(task: {
  title: string;
  description?: string;
  projectKey: string;
  assigneeAccountId?: string;
}) {
  return createJiraIssue({
    projectKey: task.projectKey,
    summary: task.title,
    description: task.description,
    assigneeAccountId: task.assigneeAccountId
  });
}

export async function checkJiraConnection(): Promise<{ connected: boolean; error?: string; siteUrl?: string }> {
  try {
    const creds = await getAccessToken();
    
    // Check if credentials exist
    if (creds.useBasicAuth) {
      if (!creds.email || !creds.apiToken || !creds.hostName) {
        return { connected: false, error: 'Missing credentials' };
      }
    } else {
      if (!creds.accessToken || !creds.hostName) {
        return { connected: false, error: 'Missing credentials' };
      }
    }
    
    // Actually verify the connection by calling Jira API
    try {
      const client = await getJiraClient();
      const myself = await client.myself.getCurrentUser();
      console.log('[Jira] Connection verified - logged in as:', myself.displayName);
      return { connected: true, siteUrl: creds.hostName };
    } catch (apiError: any) {
      console.error('[Jira] API verification failed:', apiError.message);
      return { 
        connected: false, 
        error: `Authentication failed: ${apiError.message}. Check JIRA_EMAIL and JIRA_API_TOKEN.`,
        siteUrl: creds.hostName
      };
    }
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}
