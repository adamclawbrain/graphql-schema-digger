// Popup script - displays captured GraphQL schema

let currentTab = 'queries';
let schemas = {};
let currentOrigin = '';

document.addEventListener('DOMContentLoaded', () => {
  loadSchemas();
  
  // Origin selector
  document.getElementById('originSelect').addEventListener('change', (e) => {
    currentOrigin = e.target.value;
    renderContent();
  });
  
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      renderContent();
    });
  });
  
  // Clear button
  document.getElementById('clearBtn').addEventListener('click', () => {
    const originToClear = currentOrigin || undefined;
    chrome.runtime.sendMessage({ type: 'clear-schema', origin: originToClear }, () => {
      loadSchemas();
    });
  });
});

function loadSchemas() {
  chrome.runtime.sendMessage({ type: 'get-schema' }, (response) => {
    schemas = response || {};
    updateOriginSelector();
  });
}

function updateOriginSelector() {
  const select = document.getElementById('originSelect');
  const origins = Object.keys(schemas).sort();
  
  if (origins.length === 0) {
    select.innerHTML = '<option value="">No sites captured yet</option>';
    return;
  }
  
  // Keep current selection if still valid
  const currentValue = currentOrigin;
  
  select.innerHTML = origins.map(origin => {
    const count = schemas[origin].requestCount || 0;
    return `<option value="${origin}">${origin} (${count})</option>`;
  }).join('');
  
  // Select first or restore
  if (currentValue && origins.includes(currentValue)) {
    select.value = currentValue;
    currentOrigin = currentValue;
  } else if (origins.length > 0) {
    currentOrigin = origins[0];
    select.value = currentOrigin;
  }
  
  renderContent();
}

function renderContent() {
  const requestCount = document.getElementById('requestCount');
  const queryCount = document.getElementById('queryCount');
  const mutationCount = document.getElementById('mutationCount');
  const content = document.getElementById('content');
  
  if (!currentOrigin || !schemas[currentOrigin]) {
    requestCount.textContent = '0';
    queryCount.textContent = '0';
    mutationCount.textContent = '0';
    content.innerHTML = '<div class="empty">No schema data for this site</div>';
    return;
  }
  
  const schema = schemas[currentOrigin];
  requestCount.textContent = schema.requestCount || 0;
  queryCount.textContent = Object.keys(schema.queries || {}).length;
  mutationCount.textContent = Object.keys(schema.mutations || {}).length;
  
  if (currentTab === 'raw') {
    content.innerHTML = `<pre>${JSON.stringify(schema, null, 2)}</pre>`;
    return;
  }
  
  const items = currentTab === 'queries' ? schema.queries : schema.mutations;
  const keys = Object.keys(items || {});
  
  if (keys.length === 0) {
    content.innerHTML = '<div class="empty">No ' + currentTab + ' captured yet.</div>';
    return;
  }
  
  content.innerHTML = keys.map(name => {
    const item = items[name];
    const fields = item.fields.join(', ') || '(fields hidden)';
    return `
      <div class="${currentTab === 'mutations' ? 'mutation' : 'query'}">
        <span class="query-name">${name}</span>
        <span class="count">×${item.count}</span>
        <div class="fields">Fields: <span>${fields}</span></div>
      </div>
    `;
  }).join('');
}
