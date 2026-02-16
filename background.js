// Background script - coordinates between content script and popup

// Store for collected schema data
let schemaData = {
  queries: {},      // Query name -> { fields, variables }
  mutations: {},   // Mutation name -> { fields, variables }
  types: {},       // Inferred types from responses
  endpoints: new Set(),
  requestCount: 0
};

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'graphql-request') {
    handleGraphQLRequest(message.data, sender.tab);
  } else if (message.type === 'get-schema') {
    sendResponse(formatSchema());
  } else if (message.type === 'clear-schema') {
    schemaData = {
      queries: {},
      mutations: {},
      types: {},
      endpoints: new Set(),
      requestCount: 0
    };
    sendResponse({ success: true });
  }
  return true;
});

function handleGraphQLRequest(data, tab) {
  schemaData.requestCount++;
  schemaData.endpoints.add(data.endpoint);
  
  const operationType = data.operationType || 'query';
  const operationName = data.operationName || 'anonymous';
  
  // Extract fields from the query
  const fields = extractFields(data.query);
  
  // Store by operation name (deduplicates repeated queries)
  const store = operationType === 'mutation' ? schemaData.mutations : schemaData.queries;
  
  if (!store[operationName]) {
    store[operationName] = {
      fields: fields,
      variables: data.variables || {},
      count: 0,
      firstSeen: new Date().toISOString()
    };
  }
  
  store[operationName].count++;
  store[operationName].lastSeen = new Date().toISOString();
  
  // Try to infer types from response
  if (data.response) {
    inferTypes(data.response, operationName, operationType);
  }
  
  // Update badge to show activity
  chrome.action.setBadgeText({ 
    text: String(schemaData.requestCount),
    tabId: tab.id
  });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
}

function extractFields(query) {
  // Simple field extraction from GraphQL query string
  const fields = new Set();
  
  // Match field names at the top level (simple approach)
  const fieldRegex = /^\s*(\w+)\s*[{(]/gm;
  let match;
  while ((match = fieldRegex.exec(query)) !== null) {
    fields.add(match[1]);
  }
  
  // Also capture simple field names
  const simpleFieldRegex = /^\s*(\w+)\s*$/gm;
  while ((match = simpleFieldRegex.exec(query)) !== null) {
    fields.add(match[1]);
  }
  
  return Array.from(fields);
}

function inferTypes(response, operationName, operationType) {
  // Try to extract type information from response
  if (!response.data) return;
  
  function traverse(obj, path = '') {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object') {
          schemaData.types[key] = {
            kind: 'list',
            ofType: inferType(value[0])
          };
          traverse(value[0], currentPath);
        } else {
          schemaData.types[key] = { kind: 'list', ofType: typeof value[0] };
        }
      } else if (typeof value === 'object') {
        schemaData.types[key] = { kind: 'object', fields: Object.keys(value) };
        traverse(value, currentPath);
      } else {
        schemaData.types[key] = { kind: typeof value, value: String(value).slice(0, 50) };
      }
    }
  }
  
  traverse(response.data);
}

function inferType(obj) {
  if (!obj) return 'null';
  if (Array.isArray(obj)) return 'list';
  if (typeof obj === 'object') return 'object';
  return typeof obj;
}

function formatSchema() {
  return {
    endpoints: Array.from(schemaData.endpoints),
    requestCount: schemaData.requestCount,
    queries: schemaData.queries,
    mutations: schemaData.mutations,
    types: schemaData.types
  };
}
