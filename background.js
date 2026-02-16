// Background script - uses webRequest to capture ALL network traffic

// Store schemas keyed by origin (domain)
let schemas = {};

function getSchema(origin) {
  if (!schemas[origin]) {
    schemas[origin] = {
      queries: {},
      mutations: {},
      types: {},
      requestCount: 0,
      firstSeen: new Date().toISOString()
    };
  }
  return schemas[origin];
}

console.log('[GraphQL Schema Digger] Background script loaded');

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method !== 'POST') return;
    
    try {
      const origin = new URL(details.url).origin;
      const schema = getSchema(origin);
      
      const body = details.requestBody;
      if (!body) return;
      
      let queryStr = '';
      
      if (body.formData) {
        queryStr = body.formData.query?.[0] || body.formData.variables?.[0];
      } else if (body.raw) {
        const raw = body.raw[0];
        if (raw && raw.bytes) {
          const decoder = new TextDecoder('utf-8');
          queryStr = decoder.decode(new Uint8Array(raw.bytes));
        }
      }
      
      if (!queryStr) return;
      
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
      } catch (e) {}
      
      const fields = extractFields(queryStr);
      const store = operationType === 'mutation' ? schema.mutations : schema.queries;
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
      schema.requestCount++;
      
      // Update badge with total count for this origin
      chrome.action.setBadgeText({ text: String(schema.requestCount), tabId: details.tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      
      console.log('[GraphQL Schema Digger] Captured:', origin, operationType, opName);
      
    } catch (e) {
      console.log('[GraphQL Schema Digger] Error:', e);
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// Extract all field names from GraphQL query
function extractFields(query) {
  const fields = new Set();
  const keywords = ['query', 'mutation', 'subscription', 'fragment', 'on', 'true', 'false', 'null', 'schema', 'type', 'interface', 'union', 'enum', 'scalar', 'input', 'extend'];
  
  // Match all identifiers that could be field names
  const wordRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  let match;
  while ((match = wordRegex.exec(query)) !== null) {
    if (!keywords.includes(match[1].toLowerCase())) {
      fields.add(match[1]);
    }
  }
  
  return Array.from(fields);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'get-schema') {
    // Return all schemas keyed by origin
    sendResponse(schemas);
  } else if (message.type === 'get-origins') {
    sendResponse(Object.keys(schemas));
  } else if (message.type === 'clear-schema') {
    const origin = message.origin;
    if (origin && schemas[origin]) {
      delete schemas[origin];
    } else {
      schemas = {};
    }
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ success: true });
  }
  return true;
});
