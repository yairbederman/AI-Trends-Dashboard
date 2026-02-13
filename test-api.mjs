// Quick API test script
const BASE = 'http://localhost:3000';

async function test(label, url) {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
    const elapsed = Date.now() - start;
    const data = await res.json();
    console.log(`\n=== ${label} === (${elapsed}ms, status ${res.status})`);
    if (data.success !== undefined) console.log(`  success: ${data.success}`);
    if (data.count !== undefined) console.log(`  count: ${data.count}`);
    if (data.mode) console.log(`  mode: ${data.mode}`);
    if (data.cached !== undefined) console.log(`  cached: ${data.cached}`);
    if (data.staleRefreshing !== undefined) console.log(`  staleRefreshing: ${data.staleRefreshing}`);
    if (data.failures?.length) console.log(`  failures: ${JSON.stringify(data.failures)}`);
    if (data.error) console.log(`  ERROR: ${data.error} - ${data.details || ''}`);
    if (data.meta) console.log(`  meta: ${JSON.stringify(data.meta)}`);
    // Check items
    if (data.items?.length > 0) {
      const first = data.items[0];
      console.log(`  first item: "${first.title?.substring(0, 60)}..." score=${first.trendingScore?.toFixed(1)}`);
      // Check for null/undefined fields
      const nullFields = Object.entries(first).filter(([k,v]) => v === null || v === undefined).map(([k]) => k);
      if (nullFields.length) console.log(`  WARNING: null fields in first item: ${nullFields.join(', ')}`);
    } else if (data.items?.length === 0) {
      console.log(`  WARNING: 0 items returned!`);
    }
    return data;
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`\n=== ${label} === FAILED (${elapsed}ms)`);
    console.log(`  ${err.message}`);
    return null;
  }
}

async function main() {
  // 1. Time range filters
  console.log('\n\n========== TIME RANGE FILTERS ==========');
  await test('Feed 24h hot (default)', `${BASE}/api/feed?timeRange=24h&mode=hot`);
  await test('Feed 1h hot', `${BASE}/api/feed?timeRange=1h&mode=hot`);
  await test('Feed 12h hot', `${BASE}/api/feed?timeRange=12h&mode=hot`);
  await test('Feed 48h hot', `${BASE}/api/feed?timeRange=48h&mode=hot`);
  await test('Feed 7d hot', `${BASE}/api/feed?timeRange=7d&mode=hot`);

  // 2. Feed modes
  console.log('\n\n========== FEED MODES ==========');
  await test('Feed 24h rising', `${BASE}/api/feed?timeRange=24h&mode=rising`);
  await test('Feed 24h top', `${BASE}/api/feed?timeRange=24h&mode=top`);

  // 3. Category filters
  console.log('\n\n========== CATEGORY FILTERS ==========');
  await test('Category: ai-labs', `${BASE}/api/feed?category=ai-labs&timeRange=24h`);
  await test('Category: dev-platforms', `${BASE}/api/feed?category=dev-platforms&timeRange=24h`);
  await test('Category: social', `${BASE}/api/feed?category=social&timeRange=24h`);
  await test('Category: news', `${BASE}/api/feed?category=news&timeRange=24h`);
  await test('Category: community', `${BASE}/api/feed?category=community&timeRange=24h`);
  await test('Category: newsletters', `${BASE}/api/feed?category=newsletters&timeRange=24h`);
  await test('Category: leaderboards', `${BASE}/api/feed?category=leaderboards&timeRange=24h`);

  // Also test the client-facing category names (social-blogs -> social)
  await test('Category: social-blogs (client name)', `${BASE}/api/feed?category=social-blogs&timeRange=24h`);

  // 4. Invalid filters (edge cases)
  console.log('\n\n========== EDGE CASES ==========');
  await test('Invalid timeRange', `${BASE}/api/feed?timeRange=999d&mode=hot`);
  await test('Invalid mode', `${BASE}/api/feed?timeRange=24h&mode=invalidmode`);
  await test('Invalid category', `${BASE}/api/feed?category=nonexistent&timeRange=24h`);
  await test('No params at all', `${BASE}/api/feed`);

  // 5. Combined filters
  console.log('\n\n========== COMBINED FILTERS ==========');
  await test('Category + timeRange + mode', `${BASE}/api/feed?category=news&timeRange=7d&mode=top`);
  await test('Source filter', `${BASE}/api/feed?source=hackernews&timeRange=24h`);

  // 6. Discovery API
  console.log('\n\n========== DISCOVERY API ==========');
  await test('Discovery: news+ai-labs 24h', `${BASE}/api/discovery/items?categories=news,ai-labs&timeRange=24h`);
  await test('Discovery: search', `${BASE}/api/discovery/items?categories=news&timeRange=24h&search=anthropic`);
  await test('Discovery: pagination', `${BASE}/api/discovery/items?categories=news&timeRange=24h&limit=5&offset=0`);
  await test('Discovery: missing params', `${BASE}/api/discovery/items`);

  // 7. Sources API
  console.log('\n\n========== SOURCES API ==========');
  await test('Sources list', `${BASE}/api/sources`);

  console.log('\n\nDone!');
}

main();
