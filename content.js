// Content script - intercepts GraphQL requests on the page

(function() {
  // Track if we've already injected
  if (window.__graphqlSchemaDiggerInjected) return;
  window.__graphqlSchemaDiggerInjected = true;

  // Override fetch to catch GraphQL requests
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      const options = args[1] || {};
      
      // Check if this looks like a GraphQL request
      if (isGraphQLRequest(url, options)) {
        captureGraphQLRequest(url, options, response.clone());
      }
    } catch (e) {
      // Ignore errors in capture
    }
    
    return response;
  };

  // Override XMLHttpRequest to catch GraphQL requests
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._graphqlUrl = url;
    this._graphqlMethod = method;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    this._graphqlBody = body;
    
    this.addEventListener('load', () => {
      try {
        if (isGraphQLRequest(this._graphqlUrl, { body: this._graphqlBody })) {
          captureGraphQLRequest(
            this._graphqlUrl, 
            { method: this._graphqlMethod, body: this._graphqlBody },
            { data: JSON.parse(this.responseText) }
          );
        }
      } catch (e) {}
    });
    
    return originalXHRSend.apply(this, [body]);
  };

  function isGraphQLRequest(url, options) {
    // Check URL for graphql endpoint indicators
    const urlStr = url.toLowerCase();
    if (urlStr.includes('graphql') || 
        urlStr.includes('api/graphql') ||
        urlStr.includes('/api/v1/graphql') ||
        urlStr.includes('proxy/graphql')) {
      return true;
    }
    
    // Check body for GraphQL query
    const body = options.body;
    if (!body) return false;
    
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    return bodyStr.includes('query') || bodyStr.includes('mutation');
  }

  function captureGraphQLRequest(url, options, response) {
    let body = options.body;
    let query = '';
    let operationName = '';
    let operationType = 'query';
    let variables = {};
    
    try {
      // Parse the body
      if (typeof body === 'string') {
        const parsed = JSON.parse(body);
        query = parsed.query || '';
        operationName = parsed.operationName || '';
        variables = parsed.variables || {};
        
        // Determine operation type
        if (query.trim().startsWith('mutation')) {
          operationType = 'mutation';
        } else if (query.trim().startsWith('subscription')) {
          operationType = 'subscription';
        }
      }
    } catch (e) {
      query = String(body);
    }
    
    // Send to background script
    chrome.runtime.sendMessage({
      type: 'graphql-request',
      data: {
        url: url,
        endpoint: url,
        query: query,
        operationName: operationName,
        operationType: operationType,
        variables: variables,
        response: response
      }
    });
  }
  
  console.log('[GraphQL Schema Digger] Active');
})();
