# AI Trends Dashboard — Product Spec

## What It Is

A real-time AI content aggregation dashboard built with Next.js 16. It pulls from 40+ sources across AI labs, dev platforms, social media, news outlets, communities, newsletters, and leaderboards — scoring and ranking content using multi-algorithm feeds (Hot, Rising, Top). Users can configure custom YouTube channels, subreddits, and add/delete RSS sources. A three-layer caching strategy (memory → database → external APIs) with always-non-blocking refresh keeps the dashboard fast while minimizing external API calls and preventing serverless timeouts.

## Who It's For

AI practitioners, researchers, and enthusiasts who want a single view of what's happening across the AI ecosystem without checking dozens of sites.

## Core Architecture

| Component | Role | Changes When |
|---|---|---|
| Next.js App Router | Page rendering, API routes, server components | New pages or API routes added |
| Source Adapters | Fetch and normalize content from external sources | New source types or APIs integrated |
| Scoring Engine | Rank content using engagement, recency, velocity | Scoring algorithm tuned or new feed modes added |
| Drizzle ORM + PostgreSQL | Persist content, settings, engagement snapshots. FK constraints with CASCADE deletes enforce referential integrity. Connection pooling (max 10, idle 20s, lifetime 30min) | Schema changes, new tables, pool tuning |
| SWR Client Cache | Client-side data fetching with auto-revalidation | Fetch intervals or cache keys change |
| In-Memory Cache | 60s TTL server-side cache layer | TTL or invalidation strategy changes |

## Data Flow

```
User Request
    → SWR (client cache, 5min revalidation)
    → /api/feed or /api/discovery/items route handler
    → Memory Cache (5min TTL)
    → Database Cache (category-based TTL: 5min–60min)
    → If stale: background refresh via after() (non-blocking, Vercel-safe)
        → Source Adapters (only stale sources fetched)
        → External APIs / RSS Feeds
        → Batch upsert to PostgreSQL (chunks of 100, atomic via onConflictDoUpdate)
    → Scored & ranked response returned immediately from existing data (capped at 2000 items per query)
```

The feed API **always returns immediately** with cached/existing data. If sources are stale, a background refresh runs via Next.js `after()` API. This sends the response immediately while keeping the Vercel serverless function alive (via `waitUntil`) until all adapters complete. A module-level lock prevents duplicate concurrent refreshes for the same source set. Daily cleanup also runs inside `after()` to ensure it completes reliably.

### Category TTLs

| Category | TTL | Sources |
|---|---|---|
| Community | 5 min | Reddit, Hacker News |
| AI Labs / News | 15 min | OpenAI, Google AI, Anthropic, etc. |
| Newsletters | 30 min | Import AI, Latent Space, Simon Willison |
| Leaderboards | 60 min | LMSYS Arena, Open LLM Leaderboard |

## Workflows / Features

### Content Aggregation
- Fetches from 40+ sources via 7 adapter types (RSS, HackerNews, Reddit, YouTube, GitHub, HuggingFace, Anthropic scrape)
- HackerNews adapter uses chunked concurrency (10 parallel), 10s timeouts via AbortController, and `Promise.allSettled` for partial failure tolerance
- Anthropic adapter uses cheerio DOM parser (not regex) for resilient HTML parsing
- Shared freshness module (`src/lib/fetching/ensure-fresh.ts`) — used by both feed and discovery endpoints
- Per-source freshness tracking — only stale sources are refetched
- Batch upsert operations for performance

### Source Health Monitoring
- Tracks per-source health after each fetch cycle (stored in `settings.sourceHealth`)
- Records: last fetch time, last success time, item count, consecutive failures, last error
- Sources with 3+ consecutive failures trigger `console.warn`
- Settings UI shows health badges: **OK** (green), **Unstable** (amber, 1-2 failures), **Failing** (red, 3+ failures)
- Tooltips show error details and last success date

### Discovery API
- `GET /api/discovery/items` — multi-category, paginated content view with standardized response shape
- Versioned alias at `GET /api/v1/discovery/items` (thin re-export)
- Required params: `categories` (comma-separated), `timeRange` (1h/12h/24h/48h/7d)
- Optional params: `limit` (default 100, max 500), `offset` (default 0), `search` (text filter on title/description/tags)
- Accepts `social-blogs` as alias for internal `social` category
- Valid categories: `news`, `newsletters`, `social-blogs`, `ai-labs`, `dev-platforms`, `community`, `leaderboards`
- Returns `meta` (totalItems, returnedItems, offset, limit, timeRange, per-category counts) + `items` array
- CORS enabled (`Access-Control-Allow-Origin: *`) with `OPTIONS` preflight handler for cross-origin access
- Rate limited via Vercel Firewall (`@vercel/firewall`) with graceful fallback when rule is unconfigured
- HTTP cache headers: `Cache-Control: public, s-maxage=300, stale-while-revalidate=60` for CDN/edge caching
- Uses shared freshness/caching/scoring pipeline (via `ensureSourcesFresh`) with the feed endpoint
- Designed for both dashboard frontend and external service consumption

### Feed Modes (Multi-Algorithm Scoring)
1. **Hot** — 50% engagement + 30% recency + 20% velocity
2. **Rising** — 70% velocity + 20% recency + 10% engagement (penalizes already-popular)
3. **Top** — Pure engagement score

Scoring uses percentile-based ranking, quality ratios, source-specific baselines, and keyword boosting.

### Cross-Category Score Normalization
After feed-mode scoring, a normalization pass re-maps scores within each category to a common 15–85 range using min-max normalization, then blends 80% normalized + 20% original. This compresses inter-category score gaps (e.g., GitHub stars vs. newsletter baselines) while preserving within-category ordering. Categories with fewer than 3 items or identical scores are skipped.

### Dashboard Views
- Overview with KPIs (Top Source, Hottest Topic, Biggest Mover, Driving Category)
  - "Driving the Feed" KPI uses average score per category (not total), so high-volume categories don't always win
- Must-Read Highlights sorted by average score of top-3 picks per category, with a daily rotation offset so a different category leads each day
- Content grid uses weighted round-robin interleaving in multi-category views (All tab, Dashboard): picks the top unpicked item from each category per round, sorts within each round by score. Single-category tabs keep pure score ordering.
- Category filters (AI Labs, Community, News, Dev Platforms, etc.) — client-side filtering for instant tab switching
- Source-level filtering
- Time range selection (1h, 12h, 24h, 48h, 7d)
- Trend charts via Recharts
- Mobile: info icon tooltips on CategoryHighlights (replaces long-press)

### Neural Constellation Loading Visualization
- Replaces traditional skeleton/progress bar with an animated "source constellation" SVG visualization
- **SourceConstellation** component: radial layout where each source is a favicon logo node clustered by category around a central progress hub. SVG connection lines link nodes to the hub and within category clusters. Node status animations cycle through pending, fetching, done, and failed states. Phase transitions (active -> completing -> fading) animate the exit.
- **Two modes**: `skeleton` (initial page load — simulated random fetch animation loop) and `refresh` (background refresh — real per-source status from API)
- **ConstellationRefreshWrapper**: polling wrapper that fetches per-source refresh status from `/api/feed/refresh-status` every 1.5s and maps live source statuses into the constellation
- Responsive layout via ResizeObserver with CSS breakpoints and `prefers-reduced-motion` support
- Accessible: `role="status"`, `aria-label`, and `.sr-only` screen-reader text

### User Settings
- Enable/disable sources
- Adjust source priorities (1–5)
- Theme selection (light/dark/system)
- Time range preferences
- Custom YouTube channels (add/remove via @handle or channel ID)
- Custom subreddits (add/remove, fetched via Reddit public JSON API)
- Add custom RSS sources (URL auto-detection via `/api/sources/detect`)
- Delete/hide sources (predefined sources can be restored, custom sources are permanently removed)
- Deleted sources section with restore functionality

### Engagement Velocity Tracking
- Hourly engagement snapshots
- Velocity = engagement change per hour
- 7-day retention with auto-cleanup

## External Dependencies

| Dependency | Type | Auth Required |
|---|---|---|
| Supabase PostgreSQL | Database | Yes (`DATABASE_URL`) |
| YouTube Data API v3 | Content API | Yes (`YOUTUBE_API_KEY`, optional — falls back to RSS) |
| HackerNews Firebase API | Content API | No |
| Reddit JSON feeds | Content API | No |
| GitHub Trending | Web scraping | No |
| HuggingFace API | Content API | No |
| 30+ RSS/Atom feeds | Content feeds | No |
| Vercel Firewall | Rate limiting | No (runs at edge) |

## File Map

```
src/
├── app/
│   ├── api/
│   │   ├── discovery/items/ # Multi-category paginated discovery endpoint
│   │   ├── v1/discovery/items/ # Versioned alias (re-exports canonical route)
│   │   ├── feed/            # Main aggregation endpoint + /refresh-status polling
│   │   ├── settings/        # Settings CRUD
│   │   ├── sources/         # Source management + RSS feed detection
│   │   └── youtube/         # YouTube channel resolution
│   ├── settings/            # Settings page
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Dashboard home
│   └── globals.css          # Global styles + design tokens + constellation animations
├── components/
│   ├── dashboard/           # Dashboard-specific components
│   │   ├── SourceConstellation.tsx        # SVG constellation loading visualization
│   │   ├── ConstellationRefreshWrapper.tsx # Polling wrapper for live refresh status
│   │   └── ...              # ContentCard, TrendCharts, InsightCharts, etc.
│   └── ui/                  # Reusable UI (shadcn/ui-based)
├── lib/
│   ├── adapters/            # Source adapters (RSS, HN, Reddit, YouTube, GitHub, HF, Anthropic)
│   ├── cache/               # In-memory feed cache
│   ├── config/              # Source configurations + user-configurable lists (YouTube channels, subreddits)
│   ├── fetching/            # Shared freshness check + fetch orchestration (ensureSourcesFresh)
│   ├── contexts/            # React contexts
│   ├── db/
│   │   ├── schema/          # Drizzle ORM table definitions
│   │   ├── actions.ts       # Database operations
│   │   └── index.ts         # DB connection (Supabase pooler)
│   └── scoring/             # Scoring algorithms & feed modes
├── types/                   # TypeScript type definitions
scripts/
├── setup-database.ts        # Schema + migration + seed script
drizzle/                     # Generated migrations
docs/                        # Documentation
vercel.json                  # Serverless function config (maxDuration per route)
```

## Keeping This Current

Update this spec and the architecture diagram after:

- Source adapters added, removed, or changed
- New API routes or pages created
- Scoring algorithm changes
- Database schema changes (new tables, columns)
- New external dependencies or API integrations
- Caching strategy changes
- New feed modes or dashboard views added
