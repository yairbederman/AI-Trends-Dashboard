# Caching & Database Architecture

## System Overview

```mermaid
graph TB
    subgraph "Client Layer"
        Client[Client Request]
    end

    subgraph "Memory Cache Layer (60s TTL)"
        MemCache{In-Memory Cache<br/>feedCache}
        MemHit[Cache Hit<br/>Return Immediately]
    end

    subgraph "Source Freshness Layer"
        FreshnessCheck{Check Per-Source<br/>Freshness}
        StaleCheck[Query sources.lastFetchedAt<br/>vs Category TTL]

        subgraph "Category TTLs"
            TTL1[Community: 5min]
            TTL2[Social/News/AI-Labs: 15min]
            TTL3[Newsletters: 30min]
            TTL4[Leaderboards: 60min]
        end
    end

    subgraph "Fetch Decision"
        AllFresh{All Sources<br/>Fresh?}
        SelectiveFetch[Fetch ONLY<br/>Stale Sources]
    end

    subgraph "External APIs"
        API1[Reddit RSS]
        API2[HackerNews API]
        API3[OpenAI Blog RSS]
        API4[GitHub Trending]
        APIMore[+30 more sources...]
    end

    subgraph "Database Layer (SQLite)"
        BatchUpsert[Batch Upsert<br/>chunks of 100<br/>INSERT...ON CONFLICT]
        UpdateTimestamp[Update<br/>sources.lastFetchedAt]
        QueryAll[Query ALL items<br/>from content_items<br/>WHERE sourceId IN (...)]

        DB[(SQLite Database)]

        subgraph "Tables"
            SourcesTable[sources<br/>- id<br/>- enabled<br/>- lastFetchedAt<br/>- priority]
            ContentTable[content_items<br/>- id<br/>- sourceId<br/>- title, url, etc<br/>- publishedAt<br/>- engagement]
            SnapshotsTable[engagement_snapshots<br/>- contentId<br/>- velocityScore<br/>- snapshotAt]
        end
    end

    subgraph "Scoring Layer"
        Score[Score & Sort Items<br/>by Feed Mode]
        FeedModes[Hot: engagement + velocity<br/>Rising: high velocity<br/>Top: total engagement]
    end

    Client --> MemCache
    MemCache -->|Hit| MemHit
    MemCache -->|Miss| FreshnessCheck

    FreshnessCheck --> StaleCheck
    StaleCheck -.-> TTL1
    StaleCheck -.-> TTL2
    StaleCheck -.-> TTL3
    StaleCheck -.-> TTL4

    StaleCheck --> AllFresh
    AllFresh -->|Yes| QueryAll
    AllFresh -->|No| SelectiveFetch

    SelectiveFetch -.->|Parallel Fetch| API1
    SelectiveFetch -.->|Parallel Fetch| API2
    SelectiveFetch -.->|Parallel Fetch| API3
    SelectiveFetch -.->|Parallel Fetch| API4
    SelectiveFetch -.->|Parallel Fetch| APIMore

    API1 --> BatchUpsert
    API2 --> BatchUpsert
    API3 --> BatchUpsert
    API4 --> BatchUpsert
    APIMore --> BatchUpsert

    BatchUpsert --> DB
    BatchUpsert --> UpdateTimestamp
    UpdateTimestamp --> DB

    DB --> SourcesTable
    DB --> ContentTable
    DB --> SnapshotsTable

    BatchUpsert --> QueryAll
    QueryAll --> DB

    QueryAll --> Score
    Score -.-> FeedModes
    Score --> MemCache
    MemCache -.->|Store for 60s| Client

    style MemCache fill:#e1f5ff
    style DB fill:#ffe1e1
    style BatchUpsert fill:#e1ffe1
    style SelectiveFetch fill:#fff4e1
```

## Request Flow (Detailed)

```mermaid
sequenceDiagram
    participant C as Client
    participant MC as Memory Cache<br/>(60s TTL)
    participant API as Feed API Route
    participant DB as SQLite DB
    participant Adapters as Source Adapters
    participant External as External APIs

    C->>API: GET /api/feed?mode=hot

    rect rgb(225, 245, 255)
        Note over API,MC: Phase 3: Memory Cache Check
        API->>MC: get("feed:sourceIds:24h:hot")
        alt Cache Hit
            MC-->>API: Cached Response
            API-->>C: Return Immediately ⚡
        end
    end

    rect rgb(255, 244, 225)
        Note over API,DB: Phase 1: Per-Source Freshness Check
        API->>DB: SELECT id, lastFetchedAt FROM sources
        DB-->>API: [{id: "reddit-ml", lastFetchedAt: 10min ago}, ...]

        API->>API: Check each source against category TTL:<br/>- reddit-ml (community): stale if >5min<br/>- openai-blog (ai-labs): stale if >15min<br/>- import-ai (newsletters): stale if >30min

        API->>API: Result: {stale: ["reddit-ml", "hackernews"], fresh: ["openai-blog", ...]}
    end

    alt Has Stale Sources
        rect rgb(225, 255, 225)
            Note over API,External: Selective Fetching (Only Stale)

            par Parallel Fetch
                API->>Adapters: Create adapters for STALE sources only
                Adapters->>External: Fetch reddit-ml
                Adapters->>External: Fetch hackernews
            end

            External-->>Adapters: New content items
            Adapters-->>API: [{id, title, url, engagement, ...}, ...]
        end

        rect rgb(225, 255, 225)
            Note over API,DB: Phase 2: Batch Upsert

            loop Chunks of 100
                API->>DB: INSERT INTO content_items (...)
                API->>DB: ON CONFLICT (id) DO UPDATE SET ...
            end

            API->>DB: UPDATE sources SET lastFetchedAt = NOW()<br/>WHERE id IN ("reddit-ml", "hackernews")
        end
    end

    rect rgb(255, 225, 225)
        Note over API,DB: Query All Items (Fresh + Newly Cached)
        API->>DB: SELECT * FROM content_items<br/>WHERE sourceId IN (all enabled)<br/>AND publishedAt >= cutoff
        DB-->>API: All items (fresh + newly cached)
    end

    API->>DB: SELECT velocityScore FROM engagement_snapshots
    DB-->>API: Velocity data

    API->>API: Score items by feed mode:<br/>- Hot: engagement × recency × velocity<br/>- Rising: velocity boost<br/>- Top: total engagement

    rect rgb(225, 245, 255)
        Note over API,MC: Store in Memory Cache
        API->>MC: set("feed:sourceIds:24h:hot", response, 60s)
    end

    API-->>C: Scored & sorted items
```

## Cache Key Strategy

```mermaid
graph LR
    subgraph "OLD Approach (Removed)"
        OldKey["Cache Key:<br/>feed_cache_source1_source2_..._source30_24h"]
        OldProblem1[Toggle 1 source = invalidate ALL]
        OldProblem2[Cache miss = refetch ALL 30 sources]
        OldProblem3[Settings table pollution]

        OldKey -.->|Problem| OldProblem1
        OldKey -.->|Problem| OldProblem2
        OldKey -.->|Problem| OldProblem3

        style OldKey fill:#ffcccc,stroke:#ff0000,stroke-width:3px
        style OldProblem1 fill:#ffeeee
        style OldProblem2 fill:#ffeeee
        style OldProblem3 fill:#ffeeee
    end

    subgraph "NEW Approach"
        NewMem["Memory Cache Key:<br/>feed:sourceIds:timeRange:mode"]
        NewDB["DB: sources.lastFetchedAt<br/>(per-source timestamp)"]
        NewTTL["Category-based TTLs<br/>(5min - 60min)"]

        Benefit1[Toggle 1 source = only refetch that 1]
        Benefit2[Stale check = individual per source]
        Benefit3[Clean settings table]

        NewMem -.->|Benefit| Benefit1
        NewDB -.->|Benefit| Benefit2
        NewTTL -.->|Benefit| Benefit3

        style NewMem fill:#ccffcc,stroke:#00ff00,stroke-width:3px
        style NewDB fill:#ccffcc,stroke:#00ff00,stroke-width:3px
        style NewTTL fill:#ccffcc,stroke:#00ff00,stroke-width:3px
        style Benefit1 fill:#eeffee
        style Benefit2 fill:#eeffee
        style Benefit3 fill:#eeffee
    end
```

## Database Operations: Before vs After

```mermaid
graph TB
    subgraph "OLD: N+1 Query Pattern"
        OldStart[Receive 150 items]
        OldLoop[FOR EACH item]
        OldSelect[SELECT to check existence]
        OldDecision{Exists?}
        OldInsert[INSERT]
        OldUpdate[UPDATE]
        OldNext[Next item]

        OldStart --> OldLoop
        OldLoop --> OldSelect
        OldSelect --> OldDecision
        OldDecision -->|No| OldInsert
        OldDecision -->|Yes| OldUpdate
        OldInsert --> OldNext
        OldUpdate --> OldNext
        OldNext -.->|150 iterations| OldLoop

        OldCount["Total Queries:<br/>SELECT: 150<br/>INSERT/UPDATE: 150<br/>= 300 queries"]

        style OldCount fill:#ffcccc
    end

    subgraph "NEW: Batch Upsert Pattern"
        NewStart[Receive 150 items]
        NewChunk[Chunk into groups of 100]
        NewBatch1[Chunk 1: 100 items]
        NewBatch2[Chunk 2: 50 items]
        NewUpsert1[INSERT ... ON CONFLICT DO UPDATE<br/>100 items in 1 query]
        NewUpsert2[INSERT ... ON CONFLICT DO UPDATE<br/>50 items in 1 query]

        NewStart --> NewChunk
        NewChunk --> NewBatch1
        NewChunk --> NewBatch2
        NewBatch1 --> NewUpsert1
        NewBatch2 --> NewUpsert2

        NewCount["Total Queries:<br/>Batch upserts: 2<br/>= 2 queries<br/><br/>150x improvement! 🚀"]

        style NewCount fill:#ccffcc
    end
```

## Category TTL Decision Tree

```mermaid
graph TD
    Start[Source needs fetch?]

    Start --> GetCategory{What Category?}

    GetCategory -->|Community| Community[Reddit, HN<br/>TTL: 5 minutes]
    GetCategory -->|Social/News/AI-Labs| Medium[Twitter, Blogs, OpenAI<br/>TTL: 15 minutes]
    GetCategory -->|Newsletters| Slow[Substacks<br/>TTL: 30 minutes]
    GetCategory -->|Leaderboards| VerySlow[LMSYS, Rankings<br/>TTL: 60 minutes]

    Community --> Check1{lastFetchedAt<br/>> 5min ago?}
    Medium --> Check2{lastFetchedAt<br/>> 15min ago?}
    Slow --> Check3{lastFetchedAt<br/>> 30min ago?}
    VerySlow --> Check4{lastFetchedAt<br/>> 60min ago?}

    Check1 -->|Yes| Stale1[Mark STALE<br/>Fetch now]
    Check1 -->|No| Fresh1[Mark FRESH<br/>Use cached]

    Check2 -->|Yes| Stale2[Mark STALE<br/>Fetch now]
    Check2 -->|No| Fresh2[Mark FRESH<br/>Use cached]

    Check3 -->|Yes| Stale3[Mark STALE<br/>Fetch now]
    Check3 -->|No| Fresh3[Mark FRESH<br/>Use cached]

    Check4 -->|Yes| Stale4[Mark STALE<br/>Fetch now]
    Check4 -->|No| Fresh4[Mark FRESH<br/>Use cached]

    style Stale1 fill:#ffe1e1
    style Stale2 fill:#ffe1e1
    style Stale3 fill:#ffe1e1
    style Stale4 fill:#ffe1e1
    style Fresh1 fill:#e1ffe1
    style Fresh2 fill:#e1ffe1
    style Fresh3 fill:#e1ffe1
    style Fresh4 fill:#e1ffe1
```

## Three-Layer Caching Strategy

```mermaid
graph TB
    Request[Client Request]

    subgraph "Layer 1: In-Memory Cache (Fastest)"
        L1{Memory Cache<br/>60s TTL}
        L1Hit[Return immediately<br/>⚡ ~1ms]
    end

    subgraph "Layer 2: Database Cache (Fast)"
        L2Start[Check per-source freshness]
        L2Decision{All sources<br/>fresh?}
        L2Hit[Query cached items from DB<br/>⚡ ~50ms]
    end

    subgraph "Layer 3: External APIs (Slow)"
        L3[Selective fetch stale sources]
        L3Slow[External API calls<br/>🐌 ~2-5 seconds]
        L3Cache[Batch upsert to DB<br/>Update lastFetchedAt]
    end

    Request --> L1
    L1 -->|Hit| L1Hit
    L1 -->|Miss| L2Start

    L2Start --> L2Decision
    L2Decision -->|Yes| L2Hit
    L2Decision -->|No| L3

    L3 --> L3Slow
    L3Slow --> L3Cache
    L3Cache --> L2Hit

    L1Hit --> Response[Response to Client]
    L2Hit --> Store1[Store in Memory Cache]
    Store1 --> Response

    style L1Hit fill:#00ff00
    style L2Hit fill:#90EE90
    style L3Slow fill:#FFB6C1
```

## Performance Comparison

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **API Calls on Toggle** | Refetch all 30 sources | Refetch 1 source | **30x fewer** |
| **API Calls on Stale** | Refetch all 30 sources | Refetch ~6-8 stale | **70-80% reduction** |
| **DB Writes (150 items)** | 300 queries (N+1) | 2 queries (batch) | **150x fewer** |
| **Cache Hit Rate** | ~40% (coarse invalidation) | ~85% (granular + memory) | **2x better** |
| **Response Time (cached)** | ~50ms (SQLite) | ~1ms (memory) | **50x faster** |
| **Settings Table** | Polluted with cache keys | Clean | Quality of life ✨ |

## Future Migration Path to Supabase

```mermaid
graph LR
    subgraph "Current: SQLite"
        SQLite[better-sqlite3]
        SchemaSQL[schema/sqlite.ts]
        DrizzleSQL[drizzle-orm/better-sqlite3]
    end

    subgraph "Future: Supabase (PostgreSQL)"
        Supabase[Supabase PostgreSQL]
        SchemaPG[schema/postgres.ts<br/>NEW]
        DrizzlePG[drizzle-orm/postgres-js]
    end

    subgraph "Migration Steps"
        Step1[1. Create schema/postgres.ts<br/>with pgTable equivalents]
        Step2[2. Switch re-export in<br/>schema/index.ts]
        Step3[3. Swap Drizzle driver<br/>in db/index.ts]
        Step4[4. Update drizzle.config.ts<br/>for PostgreSQL]
        Step5[5. Run drizzle-kit push]
    end

    SQLite -.->|When ready| Step1
    Step1 --> Step2
    Step2 --> Step3
    Step3 --> Step4
    Step4 --> Step5
    Step5 --> Supabase

    style SQLite fill:#e1f5ff
    style Supabase fill:#ffe1f5
```

