/**
 * Source-Specific Engagement Configuration
 *
 * Defines per-source engagement metrics with appropriate weights,
 * normalization parameters, and quality ratio calculations.
 */

/**
 * Source Quality Tiers for baseline scoring
 * Used when a source has no engagement metrics (RSS feeds, unimplemented scrapers)
 *
 * Tier 1 (0.55): Official AI Labs - Primary sources, official announcements
 * Tier 2 (0.45): Major News & Academic - Established journalism, peer-reviewed
 * Tier 3 (0.35): Quality Blogs & Newsletters - Expert curation, dev platforms
 * Tier 4 (0.25): Unimplemented/Lower Signal - Scrape not working, less established
 */
export const SOURCE_QUALITY_TIERS = {
    TIER_1_OFFICIAL: 0.55,
    TIER_2_NEWS: 0.45,
    TIER_3_QUALITY: 0.35,
    TIER_4_OTHER: 0.25,
} as const;

/**
 * Maps source IDs to their quality tier baseline
 * Sources with engagement metrics will calculate dynamically instead
 */
export const SOURCE_QUALITY_MAP: Record<string, number> = {
    // ===== TIER 1: Official AI Labs (0.55) =====
    // Primary sources - official company announcements
    'openai-blog': SOURCE_QUALITY_TIERS.TIER_1_OFFICIAL,
    'anthropic-blog': SOURCE_QUALITY_TIERS.TIER_1_OFFICIAL,
    'google-ai-blog': SOURCE_QUALITY_TIERS.TIER_1_OFFICIAL,
    'deepmind-blog': SOURCE_QUALITY_TIERS.TIER_1_OFFICIAL,
    'meta-ai-blog': SOURCE_QUALITY_TIERS.TIER_1_OFFICIAL,
    'microsoft-ai': SOURCE_QUALITY_TIERS.TIER_1_OFFICIAL,
    'nvidia-ai': SOURCE_QUALITY_TIERS.TIER_1_OFFICIAL,
    'mistral-ai': SOURCE_QUALITY_TIERS.TIER_1_OFFICIAL,
    'cohere-blog': SOURCE_QUALITY_TIERS.TIER_1_OFFICIAL,
    'stability-ai': SOURCE_QUALITY_TIERS.TIER_1_OFFICIAL,
    'aws-ai-blog': SOURCE_QUALITY_TIERS.TIER_1_OFFICIAL,
    'apple-ml': SOURCE_QUALITY_TIERS.TIER_1_OFFICIAL,

    // ===== TIER 2: Major News & Academic (0.45) =====
    // Established tech journalism, peer-reviewed research
    'verge-ai': SOURCE_QUALITY_TIERS.TIER_2_NEWS,
    'techcrunch-ai': SOURCE_QUALITY_TIERS.TIER_2_NEWS,
    'venturebeat-ai': SOURCE_QUALITY_TIERS.TIER_2_NEWS,
    'mit-tech-review': SOURCE_QUALITY_TIERS.TIER_2_NEWS,
    'ars-technica-ai': SOURCE_QUALITY_TIERS.TIER_2_NEWS,
    'wired-ai': SOURCE_QUALITY_TIERS.TIER_2_NEWS,
    'arxiv-cs-ai': SOURCE_QUALITY_TIERS.TIER_2_NEWS,
    'arxiv-cs-cl': SOURCE_QUALITY_TIERS.TIER_2_NEWS,
    'papers-with-code': SOURCE_QUALITY_TIERS.TIER_2_NEWS,
    'forbes-ai': SOURCE_QUALITY_TIERS.TIER_2_NEWS,
    'mit-sloan-review': SOURCE_QUALITY_TIERS.TIER_2_NEWS,
    'mckinsey-ai': SOURCE_QUALITY_TIERS.TIER_2_NEWS,
    'hbr': SOURCE_QUALITY_TIERS.TIER_2_NEWS,

    // ===== TIER 3: Quality Blogs & Newsletters (0.35) =====
    // Expert curation, established dev platforms
    'langchain-blog': SOURCE_QUALITY_TIERS.TIER_3_QUALITY,
    'llamaindex-blog': SOURCE_QUALITY_TIERS.TIER_3_QUALITY,
    'wandb-blog': SOURCE_QUALITY_TIERS.TIER_3_QUALITY,
    'import-ai': SOURCE_QUALITY_TIERS.TIER_3_QUALITY,
    'the-batch': SOURCE_QUALITY_TIERS.TIER_3_QUALITY,
    'latent-space': SOURCE_QUALITY_TIERS.TIER_3_QUALITY,
    'simon-willison': SOURCE_QUALITY_TIERS.TIER_3_QUALITY,
    'ahead-of-ai': SOURCE_QUALITY_TIERS.TIER_3_QUALITY,
    'interconnects': SOURCE_QUALITY_TIERS.TIER_3_QUALITY,
    'bens-bites': SOURCE_QUALITY_TIERS.TIER_3_QUALITY,
    'the-rundown-ai': SOURCE_QUALITY_TIERS.TIER_3_QUALITY,
    'one-useful-thing': SOURCE_QUALITY_TIERS.TIER_3_QUALITY,
    'pragmatic-engineer': SOURCE_QUALITY_TIERS.TIER_3_QUALITY,

    // ===== TIER 4: Unimplemented/Lower Signal (0.25) =====
    // Scrape adapters not implemented, leaderboards (data not content)
    'lmsys-arena': SOURCE_QUALITY_TIERS.TIER_4_OTHER,
    'open-llm-leaderboard': SOURCE_QUALITY_TIERS.TIER_4_OTHER,
    'artificial-analysis': SOURCE_QUALITY_TIERS.TIER_4_OTHER,
};

/**
 * Get the quality baseline for a source
 * Returns tier-based baseline for RSS sources, or default for unknown sources
 */
export function getSourceQualityBaseline(sourceId: string): number {
    return SOURCE_QUALITY_MAP[sourceId] ?? SOURCE_QUALITY_TIERS.TIER_3_QUALITY;
}

export interface MetricConfig {
    name: string;           // Metric name (e.g., 'views', 'likes', 'stars')
    weight: number;         // Relative importance within source (weights should sum to 1)
    logBase: number;        // Divisor for log10 normalization (higher = harder to max out)
    baseline: number;       // "Good" threshold for this metric
    viral: number;          // Exceptional/viral threshold
}

export interface QualityRatioConfig {
    numerator: string;      // Metric name for numerator (e.g., 'likes')
    denominator: string;    // Metric name for denominator (e.g., 'views')
    idealRatio: number;     // Target ratio (e.g., 0.04 = 4% like rate)
    weight: number;         // How much this ratio can boost the score (0-0.3 recommended)
}

export interface SourceEngagementConfig {
    sourceType: string;             // Source type identifier
    metrics: MetricConfig[];        // Metrics to use for this source
    qualityRatio?: QualityRatioConfig;  // Optional quality indicator
    noEngagementBaseline: number;   // Score when no metrics available (0-1)
}

/**
 * Engagement configurations by source type
 *
 * sourceType mappings:
 * - 'youtube': YouTube videos
 * - 'github': GitHub repositories
 * - 'reddit': Reddit posts (includes r/MachineLearning, r/LocalLLaMA, etc.)
 * - 'hackernews': Hacker News posts
 * - 'huggingface': Hugging Face models and spaces
 * - 'medium': Medium articles
 * - 'rss': Generic RSS feeds (news, blogs, newsletters)
 */
export const ENGAGEMENT_CONFIGS: Record<string, SourceEngagementConfig> = {
    youtube: {
        sourceType: 'youtube',
        metrics: [
            {
                name: 'views',
                weight: 0.40,
                logBase: 6,         // 10^6 = 1M views to max out
                baseline: 10000,    // 10K views is "good"
                viral: 1000000,     // 1M views is viral
            },
            {
                name: 'likes',
                weight: 0.35,
                logBase: 5,         // 10^5 = 100K likes to max out
                baseline: 500,      // 500 likes is good
                viral: 50000,       // 50K likes is viral
            },
            {
                name: 'comments',
                weight: 0.25,
                logBase: 4,         // 10^4 = 10K comments to max out
                baseline: 50,       // 50 comments is good
                viral: 5000,        // 5K comments is viral
            },
        ],
        qualityRatio: {
            numerator: 'likes',
            denominator: 'views',
            idealRatio: 0.04,       // 4% like rate is considered good
            weight: 0.2,            // Can boost score by up to 20%
        },
        noEngagementBaseline: 0.2,  // Low baseline since we expect YouTube to have metrics
    },

    github: {
        sourceType: 'github',
        metrics: [
            {
                name: 'stars',
                weight: 0.60,
                logBase: 6,         // 10^6 = 1M stars to max out (differentiates 10k vs 100k vs 1M)
                baseline: 100,      // 100 stars is notable
                viral: 10000,       // 10K stars is exceptional
            },
            {
                name: 'forks',
                weight: 0.40,
                logBase: 5,         // 10^5 = 100K forks to max out
                baseline: 20,       // 20 forks shows actual usage
                viral: 1000,        // 1K forks is exceptional
            },
        ],
        qualityRatio: {
            numerator: 'forks',
            denominator: 'stars',
            idealRatio: 0.10,       // 10% fork rate indicates useful/practical repo
            weight: 0.15,           // Can boost score by up to 15%
        },
        noEngagementBaseline: 0.1,  // Low since GitHub should have stars/forks
    },

    reddit: {
        sourceType: 'reddit',
        metrics: [
            {
                name: 'upvotes',
                weight: 0.60,
                logBase: 4,         // 10^4 = 10K upvotes to max out
                baseline: 100,      // 100 upvotes is good
                viral: 5000,        // 5K upvotes is viral for AI subreddits
            },
            {
                name: 'comments',
                weight: 0.40,
                logBase: 3,         // 10^3 = 1K comments to max out
                baseline: 20,       // 20 comments shows discussion
                viral: 500,         // 500 comments is very engaged
            },
        ],
        qualityRatio: {
            numerator: 'comments',
            denominator: 'upvotes',
            idealRatio: 0.15,       // 15% comment rate indicates discussion quality
            weight: 0.15,
        },
        noEngagementBaseline: 0.2,
    },

    hackernews: {
        sourceType: 'hackernews',
        metrics: [
            {
                name: 'upvotes',
                weight: 0.50,
                logBase: 3,         // 10^3 = 1K points to max out (HN scale)
                baseline: 50,       // 50 points is notable
                viral: 500,         // 500+ points is front page material
            },
            {
                name: 'comments',
                weight: 0.50,
                logBase: 3,         // 10^3 = 1K comments to max out
                baseline: 30,       // 30 comments shows interest
                viral: 300,         // 300 comments is very engaged
            },
        ],
        qualityRatio: {
            numerator: 'comments',
            denominator: 'upvotes',
            idealRatio: 0.50,       // HN tends to have high comment/upvote ratio
            weight: 0.1,
        },
        noEngagementBaseline: 0.15,
    },

    huggingface: {
        sourceType: 'huggingface',
        metrics: [
            {
                name: 'downloads',
                weight: 0.50,
                logBase: 6,         // 10^6 = 1M downloads to max out
                baseline: 1000,     // 1K downloads is notable
                viral: 100000,      // 100K downloads is popular
            },
            {
                name: 'likes',
                weight: 0.50,
                logBase: 4,         // 10^4 = 10K likes to max out
                baseline: 50,       // 50 likes is good
                viral: 5000,        // 5K likes is exceptional
            },
        ],
        qualityRatio: {
            numerator: 'likes',
            denominator: 'downloads',
            idealRatio: 0.01,       // 1% like/download rate
            weight: 0.15,
        },
        noEngagementBaseline: 0.2,
    },

    rss: {
        sourceType: 'rss',
        metrics: [],                // No engagement metrics from RSS
        noEngagementBaseline: 0,    // Will be overridden by source-specific quality tier
    },
};

/**
 * Map source IDs to engagement config types
 */
export function getSourceEngagementType(sourceId: string): string {
    // Direct mappings
    if (sourceId === 'youtube') return 'youtube';
    if (sourceId === 'github-trending') return 'github';
    if (sourceId === 'hackernews') return 'hackernews';
    if (sourceId === 'huggingface') return 'huggingface';
    // Pattern-based mappings
    if (sourceId.startsWith('reddit-')) return 'reddit';

    // Default to RSS for all other sources (blogs, news, newsletters)
    return 'rss';
}

/**
 * Get engagement configuration for a source
 */
export function getEngagementConfig(sourceId: string): SourceEngagementConfig {
    const sourceType = getSourceEngagementType(sourceId);
    return ENGAGEMENT_CONFIGS[sourceType] || ENGAGEMENT_CONFIGS.rss;
}

/**
 * Get all available source types
 */
export function getSourceTypes(): string[] {
    return Object.keys(ENGAGEMENT_CONFIGS);
}
