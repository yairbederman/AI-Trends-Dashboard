# Skill Plan: safe-refactoring

## Origin Story

I removed a "redundant" `hasAnyContent` DB query from the feed route to reduce query count. This introduced a regression:
- The query distinguished "returning user with stale data" from "first-ever visit with no data"
- Without it, the SWR path never triggered — every request took the blocking fetch path (28.8s)
- The removal looked safe in isolation but broke an invariant the SWR logic depended on

Similarly, changing `if (!staleRefreshing) { feedCache.set(...) }` to always-cache required understanding WHY the guard existed. Distinguishing "intentional guard" from "accidental omission" requires reading the full data flow.

## Skill Identity

| Field | Value |
|-------|-------|
| **Name** | `safe-refactoring` |
| **Description** | Prevent regressions when modifying existing code. Checklist for mapping data flows, identifying invariants, and verifying behavior before and after changes. Use when removing code, changing query patterns, modifying caching logic, or refactoring API routes. |
| **Tags** | `refactoring`, `regression-prevention`, `code-review`, `safety`, `debugging` |
| **Capabilities** | `data-flow-mapping`, `invariant-identification`, `before-after-verification`, `impact-analysis`, `timing-instrumentation` |

## Sections

### 1. The Refactoring Trap
- "This query looks redundant" — but it guards an invariant 3 functions downstream
- "This cache guard is unnecessary" — but it prevents stampedes during refresh
- Code that looks dead may be load-bearing for edge cases (first visit, empty DB, stale data)
- **Rule: Never remove code you don't fully understand the purpose of**

### 2. Before You Change — Impact Mapping
1. **Find all callers**: Grep for the function/variable being modified
2. **Trace the data flow**: Follow the return value through all consumers
3. **Identify branching conditions**: What downstream logic depends on this value?
4. **Check edge cases**: Empty arrays, null/undefined, first-ever vs returning, cold vs warm cache
5. **Document the invariant**: Write a one-line comment explaining WHY the code exists

Decision matrix:

| Understanding | Action |
|---|---|
| Know why it exists AND it's safe to remove | Remove + add test |
| Know why it exists AND it's NOT safe to remove | Keep + add comment |
| Don't know why it exists | **STOP. Investigate before touching.** |

### 3. Timing Instrumentation
- Add timing logs before AND after changes
- Compare timing to verify no performance regression
- Template:
  ```typescript
  const t0 = Date.now();
  const result = await someQuery();
  console.log(`[TIMING] someQuery: ${Date.now() - t0}ms`);
  ```
- Keep timing logs during development, strip before final commit (or keep if valuable)

### 4. The SWR Invariant Checklist
When modifying any stale-while-revalidate or caching code:
- [ ] Is the stale response still cached for concurrent requests?
- [ ] Is the "has any data" vs "no data" distinction preserved?
- [ ] Is the background refresh locked (one at a time)?
- [ ] Is the cache cleared after refresh completes?
- [ ] Does the blocking path still work for first-ever visits?

### 5. Safe Removal Checklist
Before removing any code:
- [ ] Grep for all references to the function/variable/query
- [ ] Trace the return value through all consumers
- [ ] Check if any conditional logic depends on this value
- [ ] Check if any OTHER code was written ASSUMING this code exists
- [ ] Add a timing log to measure before/after performance
- [ ] Test the happy path AND edge cases (empty state, first visit, error case)

### 6. Post-Change Verification
- Run the same request twice: 1st (cold) and 2nd (cached)
- Compare timings to baseline
- Test with empty DB / empty time range / single source / all sources
- If serverless: test cold start separately from warm invocation
