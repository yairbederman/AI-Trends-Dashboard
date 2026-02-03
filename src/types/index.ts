// Source and content types for AI Trends Dashboard

export type SourceCategory =
  | 'ai-labs'
  | 'creative-ai'
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
}

export interface EngagementMetrics {
  upvotes?: number;
  downvotes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  stars?: number;
  forks?: number;
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
  'creative-ai': 'Creative AI',
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
