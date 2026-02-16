// Popup script - displays captured GraphQL schema

let currentTab = 'queries';
let schemaData = null;

document.addEventListener('DOMContentLoaded', () => {
  loadSchema();
  
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
    chrome.runtime.sendMessage({ type: 'clear-schema' }, () => {
      schemaData = { queries: {}, mutations: {}, types: {}, endpoints: [], requestCount: 0 };
      renderContent();
    });
  });
});

function loadSchema() {
  chrome.runtime.sendMessage({ type: 'get-schema' }, (response) => {
    schemaData = response;
    renderContent();
  });
}

function renderContent() {
  if (!schemaData) return;
  
  document.getElementById('requestCount').textContent = schemaData.requestCount;
  document.getElementById('queryCount').textContent = Object.keys(schemaData.queries).length;
  document.getElementById('mutationCount').textContent = Object.keys(schemaData.mutations).length;
  
  const content = document.getElementById('content');
  
  if (currentTab === 'raw') {
    content.innerHTML = `<pre>${JSON.stringify(schemaData, null, 2)}</pre>`;
    return;
  }
  
  const items = currentTab === 'queries' ? schemaData.queries : schemaData.mutations;
  const keys = Object.keys(items);
  
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
