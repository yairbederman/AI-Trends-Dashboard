import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

// Sources configuration (stored for user overrides)
export const sources = sqliteTable('sources', {
    id: text('id').primaryKey(),
    enabled: integer('enabled', { mode: 'boolean' }).default(true),
    priority: integer('priority').default(3), // 1-5, default 3
    lastFetchedAt: integer('last_fetched_at', { mode: 'timestamp' }),
});

// Content items fetched from sources
export const contentItems = sqliteTable('content_items', {
    id: text('id').primaryKey(),
    sourceId: text('source_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    url: text('url').notNull(),
    imageUrl: text('image_url'),
    publishedAt: integer('published_at', { mode: 'timestamp' }).notNull(),
    fetchedAt: integer('fetched_at', { mode: 'timestamp' }).notNull(),
    author: text('author'),
    tags: text('tags'), // JSON array stored as string
    sentiment: text('sentiment'), // 'positive' | 'neutral' | 'negative'
    sentimentScore: real('sentiment_score'),
    // Engagement metrics (JSON)
    engagement: text('engagement'), // JSON: {upvotes, comments, stars, etc.}
}, (table) => [
    index('idx_content_source').on(table.sourceId),
    index('idx_content_published').on(table.publishedAt),
    index('idx_content_source_published').on(table.sourceId, table.publishedAt),
]);

// User settings
export const settings = sqliteTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
});

// Engagement snapshots for velocity tracking
export const engagementSnapshots = sqliteTable('engagement_snapshots', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    contentId: text('content_id').notNull(),
    snapshotAt: integer('snapshot_at', { mode: 'timestamp' }).notNull(),
    // Individual metrics for efficient queries
    upvotes: integer('upvotes'),
    comments: integer('comments'),
    views: integer('views'),
    likes: integer('likes'),
    stars: integer('stars'),
    forks: integer('forks'),
    downloads: integer('downloads'),
    claps: integer('claps'),
    // Pre-calculated velocity
    velocityScore: real('velocity_score'),
}, (table) => [
    index('idx_snapshot_content').on(table.contentId),
    index('idx_snapshot_time').on(table.snapshotAt),
    index('idx_snapshot_content_time').on(table.contentId, table.snapshotAt),
]);
