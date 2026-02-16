# GraphQL Schema Digger 🐾

A Chrome extension that passively watches network traffic for GraphQL requests and builds a schema over time — helping agents understand APIs without needing to use the UI.

## How It Works

1. **Install** the extension in Chrome
2. **Browse** any website with a GraphQL API
3. The extension **captures** every query and mutation
4. Over time, you build a **picture of the schema** from actual traffic

## Features

- 🚀 **Passive capture** - Just browse, no manual input needed
- 📊 **Query tracking** - See all queries your app makes
- ✏️ **Mutation tracking** - Watch what data modifications happen
- 🔍 **Field extraction** - Shows which fields are queried
- 📈 **Usage stats** - Count how often each operation runs
- 💾 **Persistent storage** - Data survives browser restarts

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `graphql-schema-digger` folder

## Usage

1. Navigate to any site with GraphQL (or use the site normally)
2. Click the extension icon to see captured queries/mutations
3. The more you browse, the more complete your schema becomes

## For Agents

The extension stores schema data that can be accessed programmatically:

```javascript
// Get schema from background script
chrome.runtime.sendMessage({ type: 'get-schema' }, (response) => {
  console.log(response.queries);   // All captured queries
  console.log(response.mutations); // All captured mutations
  console.log(response.types);     // Inferred types
});
```

## Example Output

```json
{
  "endpoints": ["https://api.example.com/graphql"],
  "requestCount": 47,
  "queries": {
    "GetUser": {
      "fields": ["id", "name", "email", "avatar"],
      "count": 12
    },
    "ListProjects": {
      "fields": ["id", "title", "status", "tasks"],
      "count": 8
    }
  }
}
```

## Privacy

- All data stays local in your browser
- No data is sent anywhere
- Only captures GraphQL traffic from sites you visit

## License

MIT
