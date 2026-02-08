# YouTube Integration Setup

## Overview

The AI Trends Dashboard monitors YouTube channels for AI-related content. This document explains how YouTube channels are stored and managed.

## Architecture

### 1. YouTube Channels Storage

**Location**: PostgreSQL `settings` table
**Key**: `youtubeChannels`
**Format**: JSON array of channel objects

```json
[
  {"channelId": "UCsBjURrPoezykLs9EqgamOA", "name": "Fireship"},
  {"channelId": "UChpleBmo18P08aKCIgti38g", "name": "Matt Wolfe"},
  ...
]
```

**Database Query**:
```sql
SELECT value FROM settings WHERE key = 'youtubeChannels';
```

### 2. YouTube Source Configuration

**Location**: `src/lib/config/sources.ts`
**Source ID**: `youtube`
**Category**: Social
**Method**: API (with RSS fallback)

The YouTube source must be enabled in the `sources` table:

```sql
SELECT * FROM sources WHERE id = 'youtube';
-- Should show: enabled = true
```

### 3. Data Flow

```
User Settings (UI)
    ↓
Settings API (/api/settings)
    ↓
Database (settings.youtubeChannels)
    ↓
YouTube Adapter (reads channels)
    ↓
RSS Feed Fetch (per channel)
    ↓
Content Items (database)
    ↓
Dashboard Feed (UI)
```

## Configuration

### Default Channels (13 AI-focused channels)

Initialized via migration `0001_initialize_default_settings.sql`:

1. **Fireship** - General tech/AI content
2. **Matt Wolfe** - AI tools and news
3. **AI Explained** - Technical AI explanations
4. **Two Minute Papers** - AI research summaries
5. **The AI Advantage** - AI productivity tips
6. **Matthew Berman** - LLM reviews and testing
7. **David Shapiro** - AI philosophy and development
8. **Yannic Kilcher** - Deep dives into AI papers
9. **Andrej Karpathy** - AI education and insights
10. **Wes Roth** - AI news and analysis
11. **WorldofAI** - Daily AI news
12. **All About AI** - AI updates and tools
13. **TheAIGRID** - AI industry coverage

### API Key (Optional)

**Location**: `.env.local`
**Variable**: `YOUTUBE_API_KEY`

```bash
# Get your API key from:
# https://console.cloud.google.com/apis/credentials

YOUTUBE_API_KEY="your_api_key_here"
```

**With API Key**: View counts, likes, and comments are fetched
**Without API Key**: Videos are still fetched via RSS feeds (no engagement metrics)

## User Management

### Adding Channels (Settings Page)

Users can add channels via `/settings` page:

**Supported Formats**:
- `@handle` (e.g., `@Fireship`)
- Channel URL: `https://youtube.com/@Fireship`
- Channel ID: `UCsBjURrPoezykLs9EqgamOA`
- Channel URL: `https://youtube.com/channel/UCsBjURrPoezykLs9EqgamOA`

**Handle Resolution**:
Handles like `@Fireship` are resolved to channel IDs via `/api/youtube/resolve`

### Editing/Removing Channels

- **Edit**: Click pencil icon on channel chip
- **Remove**: Click X icon on channel chip
- Changes are immediately synced to database

## Technical Details

### RSS Feed Format

Each channel is fetched via:
```
https://www.youtube.com/feeds/videos.xml?channel_id={channelId}
```

**Advantages**:
- Free (no API quota)
- Real-time updates
- No authentication required

**Limitations**:
- Last ~15 videos only
- No engagement metrics

### API Enhancement (Optional)

With `YOUTUBE_API_KEY`, the adapter fetches additional statistics:

```typescript
GET https://www.googleapis.com/youtube/v3/videos
  ?part=statistics
  &id={videoIds}
  &key={apiKey}
```

**Quota Cost**: 1 unit per video (max 50 videos per request)

## Verification

### Check YouTube Channels in Database

```sql
-- View configured channels
SELECT key, LEFT(value, 200) as preview
FROM settings
WHERE key = 'youtubeChannels';

-- Check YouTube source is enabled
SELECT id, enabled, priority
FROM sources
WHERE id = 'youtube';

-- Count YouTube videos fetched
SELECT COUNT(*) as youtube_videos
FROM content_items
WHERE source_id = 'youtube';
```

### Expected Results

- ✅ `youtubeChannels` setting exists with 13+ channels
- ✅ `youtube` source is enabled
- ✅ YouTube videos appear in `content_items` after fetch

## Troubleshooting

### No YouTube Videos Appearing

1. **Check source is enabled**:
   ```sql
   SELECT enabled FROM sources WHERE id = 'youtube';
   ```

2. **Verify channels are configured**:
   ```sql
   SELECT value FROM settings WHERE key = 'youtubeChannels';
   ```

3. **Check adapter logs**:
   Look for "YouTube RSS failed" messages in console

4. **Test RSS feed manually**:
   ```
   https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA
   ```

### Channel Resolution Failing

If `@handle` resolution fails:
- Verify handle is correct (visit `youtube.com/@handle`)
- Use direct channel ID instead
- Check `/api/youtube/resolve` endpoint logs

## Migrations

### Applied Migrations

1. **0001_initialize_default_settings.sql**
   - Added `youtubeChannels` setting with 13 default channels

2. **0002_add_missing_sources.sql**
   - Added `youtube` source to database (enabled by default)

## Future Enhancements

- [ ] Auto-discover channels based on AI keywords
- [ ] Channel statistics (subscriber count, video frequency)
- [ ] Playlist monitoring support
- [ ] Video transcript analysis for better categorization
