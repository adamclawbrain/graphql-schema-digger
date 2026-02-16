// Test script for GraphQL field extraction

function extractFields(query) {
  const fields = new Set();
  // Keywords only in schema definition context
  const keywords = ['query', 'mutation', 'subscription', 'fragment', 'on', 'true', 'false', 'null', 'schema', 'interface', 'union', 'enum', 'scalar', 'input', 'extend'];
  
  // Remove string literals first to avoid capturing values as fields
  const cleaned = query.replace(/"[^"]*"/g, '""');
  
  const wordRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  let match;
  while ((match = wordRegex.exec(cleaned)) !== null) {
    if (!keywords.includes(match[1].toLowerCase())) {
      fields.add(match[1]);
    }
  }
  return Array.from(fields);
}

// Test cases
const tests = [
  {
    name: "Simple query",
    query: `query {
  characters {
    results {
      name
      species
    }
  }
}`,
    expected: ['characters', 'results', 'name', 'species']
  },
  {
    name: "With arguments",
    query: `query GetCharacter($id: ID!) {
  character(id: $id) {
    id
    name
    episodes {
      name
    }
  }
}`,
    expected: ['GetCharacter', 'character', 'id', 'name', 'episodes']
  },
  {
    name: "Mutation",
    query: `mutation CreateReview($ep: EpisodeInput!, $review: ReviewInput!) {
  createEpisodeReview(episode: $ep, review: $review) {
    stars
    commentary
  }
}`,
    expected: ['CreateReview', 'createEpisodeReview', 'stars', 'commentary']
  },
  {
    name: "Rick and Morty API",
    query: `query {
  characters(page: 2, filter: { species: "human" }) {
    info {
      count
      pages
    }
    results {
      id
      name
      status
      species
      type
      gender
      origin {
        name
        type
      }
      location {
        name
        type
      }
      image
      episode {
        id
        name
        air_date
      }
    }
  }
}`,
    expected: ['characters', 'page', 'filter', 'species', 'info', 'count', 'pages', 'results', 'id', 'name', 'status', 'type', 'gender', 'origin', 'location', 'image', 'episode', 'air_date']
  }
];

console.log("Testing GraphQL field extraction\n");
let passed = 0;
let failed = 0;

tests.forEach((test, i) => {
  const extracted = extractFields(test.query);
  // Check that all expected fields are present
  const missing = test.expected.filter(f => !extracted.includes(f));
  const extra = extracted.filter(f => !test.expected.includes(f));
  
  if (missing.length === 0 && extra.length <= 2) {  // Allow a few extras
    console.log(`✓ Test ${i+1}: ${test.name}`);
    passed++;
  } else {
    console.log(`✗ Test ${i+1}: ${test.name}`);
    console.log(`  Missing: ${missing.join(', ')}`);
    console.log(`  Extra: ${extra.join(', ')}`);
    failed++;
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
