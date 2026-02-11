# AI Trends Dashboard — Product Spec

## What It Is

A real-time AI content aggregation dashboard built with Next.js 16. It pulls from 40+ sources across AI labs, dev platforms, social media, news outlets, communities, newsletters, and leaderboards — scoring and ranking content using multi-algorithm feeds (Hot, Rising, Top). A three-layer caching strategy (memory → database → external APIs) keeps the dashboard fast while minimizing external API calls.

## Who It's For

AI practitioners, researchers, and enthusiasts who want a single view of what's happening across the AI ecosystem without checking dozens of sites.

## Core Architecture

| Component | Role | Changes When |
|---|---|---|
| Next.js App Router | Page rendering, API routes, server components | New pages or API routes added |
| Source Adapters | Fetch and normalize content from external sources | New source types or APIs integrated |
| Scoring Engine | Rank content using engagement, recency, velocity | Scoring algorithm tuned or new feed modes added |
| Drizzle ORM + PostgreSQL | Persist content, settings, engagement snapshots | Schema changes, new tables |
| SWR Client Cache | Client-side data fetching with auto-revalidation | Fetch intervals or cache keys change |
| In-Memory Cache | 60s TTL server-side cache layer | TTL or invalidation strategy changes |

## Data Flow

```
User Request
    → SWR (client cache, 5min revalidation)
    → /api/feed route handler
    → Memory Cache (60s TTL)
    → Database Cache (category-based TTL: 5min–60min)
    → Source Adapters (only stale sources fetched)
    → External APIs / RSS Feeds
    → Batch upsert to PostgreSQL (chunks of 100)
    → Scored & ranked response returned
```

### Category TTLs

| Category | TTL | Sources |
|---|---|---|
| Community | 5 min | Reddit, Hacker News |
| AI Labs / News | 15 min | OpenAI, Google AI, Anthropic, etc. |
| Newsletters | 30 min | Import AI, Latent Space, Simon Willison |
| Leaderboards | 60 min | LMSYS Arena, Open LLM Leaderboard |

## Workflows / Features

### Content Aggregation
- Fetches from 40+ sources via 6 adapter types (RSS, HackerNews, Reddit, YouTube, GitHub, HuggingFace)
- Per-source freshness tracking — only stale sources are refetched
- Batch upsert operations for performance

### Feed Modes (Multi-Algorithm Scoring)
1. **Hot** — 50% engagement + 30% recency + 20% velocity
2. **Rising** — 70% velocity + 20% recency + 10% engagement (penalizes already-popular)
3. **Top** — Pure engagement score

Scoring uses percentile-based ranking, quality ratios, source-specific baselines, and keyword boosting.

### Dashboard Views
- Overview with KPIs (Top Source, Hottest Topic, Biggest Mover, Driving Category)
- Category filters (AI Labs, Community, News, Dev Platforms, etc.)
- Source-level filtering
- Time range selection (1h, 12h, 24h, 48h, 7d)
- Trend charts via Recharts

### User Settings
- Enable/disable sources
- Adjust source priorities (1–5)
- Theme selection (light/dark/system)
- Time range preferences

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

## File Map

```
src/
├── app/
│   ├── api/
│   │   ├── feed/            # Main aggregation endpoint
│   │   ├── settings/        # Settings CRUD
│   │   ├── sources/         # Source management
│   │   └── youtube/         # YouTube channel resolution
│   ├── settings/            # Settings page
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Dashboard home
│   └── globals.css          # Global styles + design tokens
├── components/
│   ├── dashboard/           # Dashboard-specific components
│   └── ui/                  # Reusable UI (shadcn/ui-based)
├── lib/
│   ├── adapters/            # Source adapters (RSS, HN, Reddit, YouTube, GitHub, HF)
│   ├── cache/               # In-memory feed cache
│   ├── config/              # Source configurations (40+ sources)
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
