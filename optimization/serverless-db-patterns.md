# Skill Plan: serverless-db-patterns

## Origin Story

The feed API was timing out (504) on Vercel because:
- Supabase DB in Seoul (ap-northeast-2) had **2.1s round-trip latency**
- `getEffectiveConfig()` fired 9 individual DB queries (7 `getSetting` + 2 sources)
- With pool max=5, this took 2 rounds = ~4.2s just for config
- SWR responses weren't cached, so every concurrent request re-ran all queries
- No lock on background refresh — N simultaneous requests spawned N refresh jobs
- Settings cache TTL was 30s, causing frequent cache misses on serverless cold starts

**Fix:** Batched 9 queries into 2, added refresh lock, cached SWR responses, raised cache TTL.
**Result:** 28.8s -> 1.2s first load, 46ms cached.

## Skill Identity

| Field | Value |
|-------|-------|
| **Name** | `serverless-db-patterns` |
| **Description** | Patterns for using remote databases (Supabase, PlanetScale, Neon) from serverless functions with high latency. Use when building Next.js API routes, Vercel functions, or any serverless backend that queries a remote DB. |
| **Tags** | `serverless`, `database`, `performance`, `caching`, `supabase`, `vercel` |
| **Capabilities** | `query-batching`, `connection-pooling`, `cache-strategy`, `swr-patterns`, `stampede-prevention`, `cold-start-optimization` |

## Sections

### 1. The Latency Problem
- Why remote DBs (Supabase, Neon, PlanetScale) have 50-2000ms round-trips
- How serverless amplifies this (cold starts, no persistent connections, short timeouts)
- Mental model: every query = 1 round-trip. N queries = N * latency (or N/pool_max rounds)

### 2. Query Batching
- **Rule: Minimize round-trips, not query count**
- Anti-pattern: N individual `getSetting(key)` calls
- Pattern: One `SELECT * FROM settings` + parse in memory
- Anti-pattern: Separate queries for related data from same table
- Pattern: Fetch once with wider SELECT, derive multiple values in-memory
- Code example: `getAllSettings()` bulk loader that populates per-key cache

### 3. Connection Pooling for Serverless
- Supabase: port 6543 (transaction pooler) vs 5432 (direct)
- `prepare: false` required for transaction pooler
- Pool size: `max: 3-5` for serverless (not 10+, functions are ephemeral)
- Timeouts: `connect_timeout: 5`, `idle_timeout: 20`, `max_lifetime: 300`
- Why `max_lifetime` matters: Supabase pooler reclaims idle connections
- Statement timeout awareness: Supabase default is 2min

### 4. Caching Strategy
- **Cache TTL should reflect DB latency, not just freshness needs**
- If round-trip = 2s and you have 5 queries, cache miss costs 4-10s
- Rule of thumb: cache TTL >= 10x cold-start query time
- Module-level caches persist across warm serverless invocations
- Feed cache (large payloads, 5min TTL) vs Settings cache (small payloads, 5min TTL)
- Always cache SWR responses — they're valid for concurrent requests during refresh

### 5. SWR (Stale-While-Revalidate) Patterns
- Return stale data immediately, refresh in background
- **Critical: Always cache the stale response** — otherwise every concurrent request during refresh re-queries DB
- Distinguish "stale but have data" vs "no data at all" (first-ever visit)
- The `hasAnyContent` pattern: check if ANY data exists (even outside time range)
- Background refresh must be fire-and-forget with `.catch()`

### 6. Cache Stampede Prevention
- Problem: cache expires, N concurrent requests all miss cache, all hit DB
- Solution 1: Module-level lock (simple string key comparison)
- Solution 2: Probabilistic early expiration
- Code example: `activeRefreshKey` lock pattern from feed route
- Clean up lock in `.finally()` to prevent deadlocks

### 7. Cold Start Checklist
- [ ] How many DB queries on first request?
- [ ] Can any queries be batched?
- [ ] Is cache TTL appropriate for DB latency?
- [ ] Are SWR responses cached?
- [ ] Is there a refresh lock?
- [ ] Is `maxDuration` configured (route export + vercel.json)?
- [ ] Is connection pool sized for serverless?

## Reference Material
- Pool configuration for Supabase, Neon, PlanetScale
- Quick-reference checklist for code review
