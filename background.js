// Background script - uses webRequest to capture ALL network traffic

let schemaData = {
  queries: {},
  mutations: {},
  types: {},
  endpoints: new Set(),
  requestCount: 0
};

// Log to console for debugging
console.log('[GraphQL Schema Digger] Background script loaded');

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    console.log('[GraphQL Schema Digger] Request:', details.method, details.url);
    
    if (details.method !== 'POST') return;
    
    try {
      const body = details.requestBody;
      if (!body) {
        console.log('[GraphQL Schema Digger] No request body');
        return;
      }
      
      let queryStr = '';
      
      // Handle different body formats
      if (body.formData) {
        queryStr = body.formData.query?.[0] || body.formData.variables?.[0];
      } else if (body.raw) {
        // raw body is an array of bytes
        const raw = body.raw[0];
        if (raw && raw.bytes) {
          const decoder = new TextDecoder('utf-8');
          queryStr = decoder.decode(new Uint8Array(raw.bytes));
        }
      }
      
      if (!queryStr) {
        console.log('[GraphQL Schema Digger] No query in body');
        return;
      }
      
      console.log('[GraphQL Schema Digger] Query found:', queryStr.substring(0, 100));
      
      if (!queryStr.includes('query') && !queryStr.includes('mutation')) return;
      
      let operationName = '';
      let operationType = 'query';
      let variables = {};
      
      try {
        const parsed = JSON.parse(queryStr);
        queryStr = parsed.query || queryStr;
        operationName = parsed.operationName || '';
        variables = parsed.variables || {};
        
        if (queryStr.trim().startsWith('mutation')) {
          operationType = 'mutation';
        } else if (queryStr.trim().startsWith('subscription')) {
          operationType = 'subscription';
        }
      } catch (e) {
        console.log('[GraphQL Schema Digger] Parse error:', e);
      }
      
      const fields = extractFields(queryStr);
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
      
      chrome.action.setBadgeText({ text: String(schemaData.requestCount) });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      
      console.log('[GraphQL Schema Digger] Captured:', operationType, opName);
      
    } catch (e) {
      console.log('[GraphQL Schema Digger] Error:', e);
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
