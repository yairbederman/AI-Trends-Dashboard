// Source and content types for AI Trends Dashboard

export type SourceCategory =
  | 'ai-labs'
  | 'dev-platforms'
  | 'social'
  | 'news'
  | 'community'
  | 'newsletters'
  | 'leaderboards';

export type FetchMethod = 'rss' | 'api' | 'scrape';

export interface SourceConfig {
  id: string;
  name: string;
  category: SourceCategory;
  url: string;
  feedUrl?: string;
  method: FetchMethod;
  enabled: boolean;
  requiresKey: boolean;
  apiKeyEnvVar?: string;
  icon?: string;
  // Default priority (1-5, higher = more important)
  defaultPriority?: number;
  // If true, items are filtered for AI relevance (for general-topic feeds)
  relevanceFilter?: boolean;
  // Reason why the source is broken/unavailable (shown in settings UI)
  brokenReason?: string;
}

export interface CustomSourceConfig {
  id: string;
  name: string;
  url: string;
  feedUrl: string;
  category: SourceCategory;
}

export interface EngagementMetrics {
  // Reddit, Hacker News
  upvotes?: number;
  downvotes?: number;
  comments?: number;
  shares?: number;
  // YouTube
  views?: number;
  likes?: number;
  // GitHub
  stars?: number;
  forks?: number;
  // Hugging Face
  downloads?: number;
  // Medium
  claps?: number;
  responses?: number;
}

export interface ContentItem {
  id: string;
  sourceId: string;
  title: string;
  description?: string;
  url: string;
  imageUrl?: string;
  publishedAt: Date;
  fetchedAt: Date;
  author?: string;
  tags?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentimentScore?: number;
  // Engagement metrics from source
  engagement?: EngagementMetrics;
  // Calculated trending score (0-100)
  trendingScore?: number;
  // Engagement change per hour
  velocityScore?: number;
  // Keywords that matched for boosting
  matchedKeywords?: string[];
}

export interface MetricPoint {
  sourceId: string;
  metricName: string;
  value: number;
  recordedAt: Date;
}

export type TimeRange = '1h' | '12h' | '24h' | '48h' | '7d';

export type FeedMode = 'hot' | 'rising' | 'top';

export const FEED_MODE_LABELS: Record<FeedMode, string> = {
  hot: 'Hot',
  rising: 'Rising',
  top: 'Top',
};

export const FEED_MODE_DESCRIPTIONS: Record<FeedMode, string> = {
  hot: 'High engagement + recent',
  rising: 'Gaining momentum fast',
  top: 'Highest engagement',
};

export interface UserSettings {
  timeRange: TimeRange;
  theme: 'light' | 'dark' | 'system';
  enabledCategories: SourceCategory[];
  notificationsEnabled: boolean;
}

export interface DailyHighlight {
  date: string;
  items: ContentItem[];
  summary?: string;
}

export const CATEGORY_LABELS: Record<SourceCategory, string> = {
  'ai-labs': 'AI Labs',
  'dev-platforms': 'Dev Platforms',
  'social': 'Social & Blogs',
  'news': 'News',
  'community': 'Community',
  'newsletters': 'Newsletters',
  'leaderboards': 'Leaderboards',
};

export const TIME_RANGES: Record<TimeRange, string> = {
  '1h': 'Last 1 Hour',
  '12h': 'Last 12 Hours',
  '24h': 'Last 24 Hours',
  '48h': 'Last 48 Hours',
  '7d': 'Last Week',
};

export const CATEGORY_COLORS: Record<string, string> = {
  'ai-labs': '#6366f1',
  'dev-platforms': '#22c55e',
  'social': '#06b6d4',
  'news': '#eab308',
  'community': '#f97316',
  'newsletters': '#a855f7',
  'leaderboards': '#ef4444',
};
