# Node.js Performance & Resource Management Skill

## Background

On 2026-02-13, a memory leak was discovered in the AI Trends Dashboard: the
`MemoryCache` class (`src/lib/cache/memory-cache.ts`) used an unbounded `Map`
with no max size, no LRU eviction, and only lazy TTL expiry. A long-running dev
server consumed 1.6 GB RAM and 720s CPU time as a result.

The fix (commit `000c3aa`) added max-size caps, LRU eviction, and a periodic
sweep timer. A skills-hub gap analysis revealed there is no Node.js equivalent
of the existing `python-performance-optimization` skill. This document captures
the plan for that skill so it can be installed later.

## Skill Metadata

| Field | Value |
|---|---|
| Name | `nodejs-performance` |
| Path | `engineering/nodejs-performance` |
| Tags | `nodejs`, `performance`, `memory`, `profiling`, `optimization`, `nextjs` |
| Capabilities | `memory-leak-prevention`, `heap-profiling`, `cache-design`, `resource-cleanup`, `process-monitoring` |

## Sections to Include

### 1. In-Memory Caches

- Always set a `maxSize` on any custom cache
- Always add an eviction strategy (LRU, LFU, or FIFO)
- Add periodic sweep for TTL-based caches (don't rely on lazy-only expiry)
- Never use a bare `Map` or `Set` as an unbounded cache in a long-running process
- Reference implementation: `lru-cache` npm package patterns
  - `max`, `ttl`, `ttlAutopurge`, `updateAgeOnGet`, `dispose`
- For small projects, a lightweight custom LRU (like our `MemoryCache`) is fine
  when max entries < 100

### 2. Timers & Intervals

- Always `clearInterval` / `clearTimeout` in cleanup paths
- Use `.unref()` on timers that shouldn't block process exit
- Pair every `setInterval` with a documented teardown path
- In React components: always return cleanup function from `useEffect`
- Watch for: intervals that restart without clearing the previous one

### 3. Event Listeners

- Always pair `addEventListener` with `removeEventListener`
- In React `useEffect`: return a cleanup that removes the listener
- Consolidate multiple listeners on the same event when possible
- Debounce/throttle resize and scroll handlers

### 4. Module-Level State

- Flag any module-level `Map`, `Set`, array, or object that can grow
- Document the cleanup lifecycle for every singleton
- Next.js specific: module-level state persists across requests in dev and
  standalone mode but does NOT persist across serverless cold starts
- Design state that works correctly in both environments

### 5. Heap Profiling

- Quick check: `process.memoryUsage()` — log `heapUsed` periodically
- Dev profiling: `--inspect` flag + Chrome DevTools Memory tab
- Production profiling: `clinic.js` (doctor, flame, bubbleprof) or `0x`
- When to profile: if `heapUsed` grows monotonically over time without plateau

### 6. Serverless vs Long-Running

- Module-level caches work in dev/standalone but are ephemeral in serverless
- Don't rely on in-process cache for correctness — only for performance
- For shared state across instances: use Redis, Upstash, or database
- Design cache so a miss just means a slightly slower response, never an error

### 7. Common Antipatterns

| Antipattern | Why it leaks | Fix |
|---|---|---|
| Unbounded `Map` as cache | Entries never evicted | Add `maxSize` + eviction |
| `setInterval` without cleanup | Timer holds references | `clearInterval` + `.unref()` |
| Fire-and-forget promises without backpressure | Overlapping runs accumulate | Queue or mutex |
| Closures capturing large objects in event handlers | GC can't collect | Extract and minimize captured scope |
| Large objects stored in global/module scope | Never released | Scope to request or add TTL |
| String concatenation in hot loops | O(n^2) memory churn | Use `Array.join()` or `Buffer` |

### 8. Pre-Merge Checklist

Before merging any PR that touches backend/server code:

- [ ] Does any new `Map`, `Set`, or array grow without a size bound?
- [ ] Are all `setInterval`/`setTimeout` calls cleaned up?
- [ ] Are all event listeners removed in cleanup?
- [ ] Do module-level singletons have a documented lifecycle?
- [ ] Is any cache storing full response objects when IDs would suffice?
- [ ] Are fire-and-forget promises guarded against overlapping runs?

## Relationship to Existing Skills

| Existing skill | Relationship |
|---|---|
| `python-performance-optimization` | Direct Node.js counterpart |
| `backend-patterns` | Complements (backend-patterns covers API design, not memory/perf) |
| `nextjs-cache-components` | No overlap (that skill covers framework `'use cache'` directive) |
| `systematic-debugging` | Complementary (debugging is reactive; this skill is preventive) |

## Installation

Install via the `install-skill` workflow:

```
Read and follow: C:\Users\YairBederman\.gemini\antigravity\scratch\skills-hub\meta\install-skill\SKILL.md
```

Skill should be placed at: `engineering/nodejs-performance/SKILL.md`
