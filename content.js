// Content script - intercepts GraphQL requests on the page

(function() {
  // Track if we've already injected
  if (window.__graphqlSchemaDiggerInjected) return;
  window.__graphqlSchemaDiggerInjected = true;

  // Helper to detect GraphQL
  function isGraphQLRequest(url, options) {
    const urlStr = String(url).toLowerCase();
    if (urlStr.includes('graphql') || 
        urlStr.includes('api/graphql') ||
        urlStr.includes('/api/v1/graphql') ||
        urlStr.includes('proxy/graphql')) {
      return true;
    }
    
    const body = options.body;
    if (!body) return false;
    
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    return bodyStr.includes('query') || bodyStr.includes('mutation');
  }

  // Parse GraphQL request body
  function parseGraphQLBody(body) {
    let query = '';
    let operationName = '';
    let operationType = 'query';
    let variables = {};
    
    try {
      if (typeof body === 'string') {
        const parsed = JSON.parse(body);
        query = parsed.query || '';
        operationName = parsed.operationName || '';
        variables = parsed.variables || {};
        
        if (query.trim().startsWith('mutation')) {
          operationType = 'mutation';
        } else if (query.trim().startsWith('subscription')) {
          operationType = 'subscription';
        }
      }
    } catch (e) {
      query = String(body);
    }
    
    return { query, operationName, operationType, variables };
  }

  // Send to background
  function captureGraphQLRequest(url, options, response) {
    const { query, operationName, operationType, variables } = parseGraphQLBody(options.body);
    
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

  // Override fetch to catch GraphQL requests
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      const options = args[1] || {};
      
      if (isGraphQLRequest(url, options)) {
        captureGraphQLRequest(url, options, response.clone());
      }
    } catch (e) {}
    
    return response;
  };

  // Override XMLHttpRequest
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

  // Intercept Apollo Client requests
  function setupApolloInterceptor() {
    // Wait for Apollo to be available
    const checkApollo = () => {
      // Try to find Apollo Client instance
      let apolloClient = null;
      
      // Check common global names
      if (window.apolloClient) apolloClient = window.apolloClient;
      else if (window.__APOLLO_CLIENT__) apolloClient = window.__APOLLO_CLIENT__;
      else if (window.ApolloClient) apolloClient = window.ApolloClient;
      
      // Look for it in the page - check for Apollo's cache or link
      if (!apolloClient) {
        // Try to find by looking at window properties
        for (let key in window) {
          if (key.toLowerCase().includes('apollo')) {
            apolloClient = window[key];
            break;
          }
        }
      }
      
      if (!apolloClient || !apolloClient.link) return false;
      
      // Wrap the Apollo Link chain
      const originalLinkRequest = apolloClient.link.request.bind(apolloClient.link);
      
      apolloClient.link.request = function(operation, forward) {
        // Extract query info from operation
        const query = operation.query ? operation.loc?.source?.body || operation.query.loc?.source?.body || '' : '';
        const operationName = operation.operationName || '';
        const operationType = operation.query?.definitions?.[0]?.operation || 'query';
        
        // Wrap forward to capture response
        const originalForward = forward;
        forward = function(obs) {
          return originalForward(obs).map(response => {
            // Capture the response
            const responseData = response.data ? JSON.parse(JSON.stringify(response.data)) : {};
            
            chrome.runtime.sendMessage({
              type: 'graphql-request',
              data: {
                url: operation.getContext?.().url || 'apollo',
                endpoint: 'Apollo Client',
                query: query,
                operationName: operationName,
                operationType: operationType,
                variables: operation.variables || {},
                response: { data: responseData }
              }
            });
            
            return response;
          });
        };
        
        return originalLinkRequest(operation, forward);
      };
      
      console.log('[GraphQL Schema Digger] Apollo Client intercepted');
      return true;
    };
    
    // Try immediately and then periodically
    if (!checkApollo()) {
      setTimeout(checkApollo, 1000);
      setTimeout(checkApollo, 3000);
      setTimeout(checkApollo, 5000);
    }
  }

  // Try to intercept Apollo on load
  if (document.readyState === 'complete') {
    setupApolloInterceptor();
  } else {
    window.addEventListener('load', setupApolloInterceptor);
  }
  
  console.log('[GraphQL Schema Digger] Active');
})();
