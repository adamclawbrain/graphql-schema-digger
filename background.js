// Background script - uses webRequest to capture ALL network traffic

let schemaData = {
  queries: {},
  mutations: {},
  types: {},
  endpoints: new Set(),
  requestCount: 0
};

// Intercept all web requests
chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (details.method !== 'POST') return;
    
    try {
      // Try to parse the request body
      const body = details.requestBody;
      if (!body || !body.formData) return;
      
      const formData = body.formData;
      const queryStr = formData.query?.[0] || formData.variables?.[0];
      
      if (!queryStr || typeof queryStr !== 'string') return;
      
      // Check if it looks like GraphQL
      if (!queryStr.includes('query') && !queryStr.includes('mutation')) return;
      
      // Parse the GraphQL request
      let query = queryStr;
      let operationName = '';
      let operationType = 'query';
      let variables = {};
      
      try {
        const parsed = JSON.parse(queryStr);
        query = parsed.query || queryStr;
        operationName = parsed.operationName || '';
        variables = parsed.variables || {};
        
        if (query.trim().startsWith('mutation')) {
          operationType = 'mutation';
        } else if (query.trim().startsWith('subscription')) {
          operationType = 'subscription';
        }
      } catch (e) {}
      
      // Extract fields from query
      const fields = extractFields(query);
      
      // Store
      const store = operationType === 'mutation' ? schemaData.mutations : schemaData.queries;
      const opName = operationName || 'anonymous';
      
      if (!store[opName]) {
        store[opName] = {
          fields: fields,
          variables: variables,
          count: 0,
          firstSeen: new Date().toISOString()
        };
      }
      
      store[opName].count++;
      store[opName].lastSeen = new Date().toISOString();
      schemaData.requestCount++;
      schemaData.endpoints.add(details.url);
      
      // Update badge
      chrome.action.setBadgeText({ text: String(schemaData.requestCount) });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      
      console.log('[GraphQL Schema Digger] Captured:', operationType, opName);
      
    } catch (e) {
      // Silent fail
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

function extractFields(query) {
  const fields = new Set();
  const fieldRegex = /^\s*(\w+)\s*[{(]/gm;
  let match;
  while ((match = fieldRegex.exec(query)) !== null) {
    fields.add(match[1]);
  }
  return Array.from(fields);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'get-schema') {
    sendResponse(formatSchema());
  } else if (message.type === 'clear-schema') {
    schemaData = {
      queries: {},
      mutations: {},
      types: {},
      endpoints: new Set(),
      requestCount: 0
    };
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ success: true });
  }
  return true;
});

function formatSchema() {
  return {
    endpoints: Array.from(schemaData.endpoints),
    requestCount: schemaData.requestCount,
    queries: schemaData.queries,
    mutations: schemaData.mutations,
    types: schemaData.types
  };
}
