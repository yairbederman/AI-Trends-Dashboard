import { pgTable, text, boolean, integer, doublePrecision, timestamp, serial, index } from 'drizzle-orm/pg-core';

// Sources configuration (stored for user overrides)
export const sources = pgTable('sources', {
    id: text('id').primaryKey(),
    enabled: boolean('enabled').notNull().default(true),
    priority: integer('priority').notNull().default(3), // 1-5, default 3
    lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
});

// Content items fetched from sources
export const contentItems = pgTable('content_items', {
    id: text('id').primaryKey(),
    sourceId: text('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    url: text('url').notNull(),
    imageUrl: text('image_url'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    author: text('author'),
    tags: text('tags'), // JSON array stored as string
    sentiment: text('sentiment'), // 'positive' | 'neutral' | 'negative'
    sentimentScore: doublePrecision('sentiment_score'),
    // Engagement metrics (JSON)
    engagement: text('engagement'), // JSON: {upvotes, comments, stars, etc.}
}, (table) => [
    index('idx_content_source').on(table.sourceId),
    index('idx_content_published').on(table.publishedAt),
    index('idx_content_source_published').on(table.sourceId, table.publishedAt),
]);

// User settings
export const settings = pgTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
});

// Engagement snapshots for velocity tracking
export const engagementSnapshots = pgTable('engagement_snapshots', {
    id: serial('id').primaryKey(),
    contentId: text('content_id').notNull().references(() => contentItems.id, { onDelete: 'cascade' }),
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull(),
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
    velocityScore: doublePrecision('velocity_score'),
}, (table) => [
    index('idx_snapshot_content').on(table.contentId),
    index('idx_snapshot_time').on(table.snapshotAt),
    index('idx_snapshot_content_time').on(table.contentId, table.snapshotAt),
]);
