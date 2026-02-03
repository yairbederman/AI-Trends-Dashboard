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

// Historical metrics for trend charts
export const metrics = sqliteTable('metrics', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceId: text('source_id').notNull(),
    metricName: text('metric_name').notNull(),
    value: real('value').notNull(),
    recordedAt: integer('recorded_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
    index('idx_metrics_source').on(table.sourceId),
    index('idx_metrics_recorded').on(table.recordedAt),
    index('idx_metrics_source_recorded').on(table.sourceId, table.recordedAt),
]);

// User settings
export const settings = sqliteTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
});

// Daily highlights
export const dailyHighlights = sqliteTable('daily_highlights', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    date: text('date').notNull(), // YYYY-MM-DD format
    itemIds: text('item_ids').notNull(), // JSON array of content item IDs
    summary: text('summary'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
    index('idx_highlights_date').on(table.date),
]);
