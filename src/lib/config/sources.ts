import { SourceConfig, SourceCategory } from '@/types';

// All data sources configuration
// Sources without API keys are enabled by default
// Sources requiring keys are disabled by default

export const SOURCES: SourceConfig[] = [
    // =====================
    // AI LABS
    // =====================
    {
        id: 'openai-blog',
        name: 'OpenAI Blog',
        category: 'ai-labs',
        url: 'https://openai.com/blog',
        feedUrl: 'https://openai.com/blog/rss.xml',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🤖',
        defaultPriority: 5, // High priority: Leading AI lab, reliable RSS feed
    },
    {
        id: 'google-ai-blog',
        name: 'Google AI Blog',
        category: 'ai-labs',
        url: 'https://blog.google/technology/ai/',
        feedUrl: 'https://blog.google/technology/ai/rss/',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🔵',
        defaultPriority: 5, // High priority: Major AI lab, stable RSS feed
    },
    {
        id: 'anthropic-blog',
        name: 'Anthropic',
        category: 'ai-labs',
        url: 'https://www.anthropic.com/news',
        feedUrl: 'https://www.anthropic.com/rss.xml',
        method: 'rss',
        enabled: false, // Disabled - RSS feed returns 404, requires scraping
        requiresKey: false,
        icon: '🟠',
        defaultPriority: 1, // Low priority: RSS feed broken (404)
    },
    {
        id: 'meta-ai-blog',
        name: 'Meta AI',
        category: 'ai-labs',
        url: 'https://ai.meta.com/blog/',
        feedUrl: 'https://ai.meta.com/blog/rss/',
        method: 'rss',
        enabled: false, // Disabled - no RSS feed available (custom React site, no feed endpoint)
        requiresKey: false,
        icon: '📘',
        defaultPriority: 1, // Low priority: No RSS feed available
    },
    {
        id: 'deepmind-blog',
        name: 'DeepMind',
        category: 'ai-labs',
        url: 'https://deepmind.google/blog/',
        feedUrl: 'https://deepmind.google/blog/rss.xml',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🧠',
        defaultPriority: 5, // High priority: Leading research lab, reliable RSS
    },
    {
        id: 'microsoft-ai',
        name: 'Microsoft AI',
        category: 'ai-labs',
        url: 'https://blogs.microsoft.com/ai/',
        feedUrl: 'https://blogs.microsoft.com/ai/feed/',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🪟',
        defaultPriority: 4, // Good priority: Major player, reliable RSS
    },
    {
        id: 'nvidia-ai',
        name: 'NVIDIA AI',
        category: 'ai-labs',
        url: 'https://blogs.nvidia.com/',
        feedUrl: 'https://blogs.nvidia.com/feed/',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '💚',
        defaultPriority: 4, // Good priority: Important for AI hardware/infrastructure
    },
    {
        id: 'mistral-ai',
        name: 'Mistral AI',
        category: 'ai-labs',
        url: 'https://mistral.ai/news/',
        feedUrl: 'https://mistral.ai/feed/',
        method: 'rss',
        enabled: false, // Disabled - no RSS feed available (Next.js site, no feed endpoint)
        requiresKey: false,
        icon: '🌀',
        defaultPriority: 1, // Low priority: No RSS feed available
    },
    {
        id: 'cohere-blog',
        name: 'Cohere',
        category: 'ai-labs',
        url: 'https://cohere.com/blog',
        feedUrl: 'https://cohere-ai.ghost.io/rss/',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🔷',
        defaultPriority: 4, // Good priority: Important LLM provider, Ghost RSS reliable
    },
    {
        id: 'stability-ai',
        name: 'Stability AI',
        category: 'ai-labs',
        url: 'https://stability.ai/news',
        feedUrl: 'https://stability.ai/news?format=rss',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🎨',
        defaultPriority: 4, // Good priority: Leading image gen, reliable RSS
    },
    {
        id: 'aws-ai-blog',
        name: 'AWS AI Blog',
        category: 'ai-labs',
        url: 'https://aws.amazon.com/blogs/machine-learning/',
        feedUrl: 'https://aws.amazon.com/blogs/machine-learning/feed/',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '☁️',
        defaultPriority: 4, // Good priority: Important cloud AI provider
    },
    {
        id: 'apple-ml',
        name: 'Apple ML Research',
        category: 'ai-labs',
        url: 'https://machinelearning.apple.com',
        feedUrl: 'https://machinelearning.apple.com/rss.xml',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🍎',
        defaultPriority: 4, // Good priority: Major tech company, quality research
    },

    // =====================
    // DEV PLATFORMS
    // =====================
    {
        id: 'github-trending',
        name: 'GitHub Trending',
        category: 'dev-platforms',
        url: 'https://github.com/trending',
        method: 'api',
        enabled: true,
        requiresKey: false, // Works without key, better with
        apiKeyEnvVar: 'GITHUB_TOKEN',
        icon: '🐙',
        defaultPriority: 5, // High priority: Essential developer platform, reliable API
    },
    {
        id: 'huggingface',
        name: 'Hugging Face',
        category: 'dev-platforms',
        url: 'https://huggingface.co',
        method: 'api',
        enabled: true,
        requiresKey: false,
        icon: '🤗',
        defaultPriority: 5, // High priority: Central AI/ML platform, excellent API
    },
    {
        id: 'papers-with-code',
        name: 'Papers with Code',
        category: 'dev-platforms',
        url: 'https://huggingface.co/papers',
        feedUrl: 'https://paperswithcode.com/rss',
        method: 'rss',
        enabled: false, // Disabled - site redirects to HuggingFace papers, no RSS feed
        requiresKey: false,
        icon: '📄',
        defaultPriority: 1, // Low priority: Site redirected, no RSS feed
    },
    {
        id: 'langchain-blog',
        name: 'LangChain',
        category: 'dev-platforms',
        url: 'https://blog.langchain.dev',
        feedUrl: 'https://blog.langchain.dev/rss/',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🦜',
        defaultPriority: 4, // Good priority: Important LLM framework, reliable RSS
    },
    {
        id: 'llamaindex-blog',
        name: 'LlamaIndex',
        category: 'dev-platforms',
        url: 'https://www.llamaindex.ai/blog',
        feedUrl: 'https://www.llamaindex.ai/blog/rss.xml',
        method: 'rss',
        enabled: false, // Disabled - no RSS feed available (Astro site, no feed endpoint)
        requiresKey: false,
        icon: '🦙',
        defaultPriority: 1, // Low priority: No RSS feed available
    },
    {
        id: 'wandb-blog',
        name: 'Weights & Biases',
        category: 'dev-platforms',
        url: 'https://wandb.ai/fully-connected',
        feedUrl: 'https://wandb.ai/fully-connected/rss.xml',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '📊',
        defaultPriority: 4, // Good priority: Important ML tool, reliable RSS
    },
    {
        id: 'arxiv-cs-ai',
        name: 'arXiv cs.AI',
        category: 'dev-platforms',
        url: 'https://arxiv.org/list/cs.AI/recent',
        feedUrl: 'https://rss.arxiv.org/rss/cs.AI',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '📑',
        defaultPriority: 5, // High priority: Research papers, highly reliable RSS
    },
    {
        id: 'arxiv-cs-cl',
        name: 'arXiv cs.CL',
        category: 'dev-platforms',
        url: 'https://arxiv.org/list/cs.CL/recent',
        feedUrl: 'https://rss.arxiv.org/rss/cs.CL',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '📝',
        defaultPriority: 5, // High priority: NLP research papers, highly reliable RSS
    },

    // =====================
    // SOCIAL & BLOGS
    // =====================
    {
        id: 'twitter',
        name: 'Twitter/X',
        category: 'social',
        url: 'https://twitter.com',
        method: 'api',
        enabled: false, // Disabled - requires paid API
        requiresKey: true,
        apiKeyEnvVar: 'TWITTER_API_KEY',
        icon: '🐦',
        defaultPriority: 1, // Low priority: Requires expensive paid API
    },
    {
        id: 'linkedin',
        name: 'LinkedIn',
        category: 'social',
        url: 'https://linkedin.com',
        method: 'api',
        enabled: false, // Disabled - restricted API
        requiresKey: true,
        apiKeyEnvVar: 'LINKEDIN_API_KEY',
        icon: '💼',
        defaultPriority: 1, // Low priority: Restricted API access
    },
    {
        id: 'youtube',
        name: 'YouTube',
        category: 'social',
        url: 'https://youtube.com',
        method: 'api',
        enabled: true, // Now enabled with API key
        requiresKey: true,
        apiKeyEnvVar: 'YOUTUBE_API_KEY',
        icon: '📺',
        defaultPriority: 4, // Good priority: Requires key but API is stable
    },

    // =====================
    // NEWS
    // =====================
    {
        id: 'verge-ai',
        name: 'The Verge AI',
        category: 'news',
        url: 'https://www.theverge.com/ai-artificial-intelligence',
        feedUrl: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '📰',
        relevanceFilter: true,
        defaultPriority: 4, // Good priority: Major tech news, reliable RSS
    },
    {
        id: 'techcrunch-ai',
        name: 'TechCrunch AI',
        category: 'news',
        url: 'https://techcrunch.com/category/artificial-intelligence/',
        feedUrl: 'https://techcrunch.com/category/artificial-intelligence/feed/',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '💚',
        relevanceFilter: true,
        defaultPriority: 4, // Good priority: Leading tech news, reliable RSS
    },
    {
        id: 'venturebeat-ai',
        name: 'VentureBeat AI',
        category: 'news',
        url: 'https://venturebeat.com/category/ai/',
        feedUrl: 'https://venturebeat.com/category/ai/feed/',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🟣',
        relevanceFilter: true,
        defaultPriority: 4, // Good priority: Enterprise AI news, reliable RSS
    },
    {
        id: 'mit-tech-review',
        name: 'MIT Tech Review',
        category: 'news',
        url: 'https://www.technologyreview.com/topic/artificial-intelligence/',
        feedUrl: 'https://www.technologyreview.com/topic/artificial-intelligence/feed',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🎓',
        relevanceFilter: true,
        defaultPriority: 5, // High priority: High-quality analysis, reliable RSS
    },
    {
        id: 'ars-technica-ai',
        name: 'Ars Technica AI',
        category: 'news',
        url: 'https://arstechnica.com/ai/',
        feedUrl: 'https://arstechnica.com/tag/ai/feed/',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🔧',
        relevanceFilter: true,
        defaultPriority: 4, // Good priority: Technical news coverage, reliable RSS
    },
    {
        id: 'wired-ai',
        name: 'Wired AI',
        category: 'news',
        url: 'https://www.wired.com/tag/ai/',
        feedUrl: 'https://www.wired.com/feed/tag/ai/latest/rss',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '📡',
        relevanceFilter: true,
        defaultPriority: 4, // Good priority: Quality tech journalism, reliable RSS
    },
    {
        id: 'forbes-ai',
        name: 'Forbes AI',
        category: 'news',
        url: 'https://www.forbes.com/innovation/ai/',
        feedUrl: 'https://www.forbes.com/innovation/ai/feed/',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '💰',
        relevanceFilter: true,
        defaultPriority: 4, // Good priority: Major business publication, AI-specific feed
    },
    {
        id: 'mit-sloan-review',
        name: 'MIT Sloan Management Review',
        category: 'news',
        url: 'https://sloanreview.mit.edu',
        feedUrl: 'http://feeds.feedburner.com/mitsmr',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🎓',
        relevanceFilter: true,
        defaultPriority: 4, // Good priority: Prestigious management research, reliable RSS
    },
    {
        id: 'mckinsey-ai',
        name: 'McKinsey AI',
        category: 'news',
        url: 'https://www.mckinsey.com/capabilities/quantumblack/our-insights',
        feedUrl: 'https://www.mckinsey.com/insights/rss',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '📊',
        relevanceFilter: true,
        defaultPriority: 4, // Good priority: Top consulting firm AI insights, reliable RSS
    },
    {
        id: 'hbr',
        name: 'Harvard Business Review',
        category: 'news',
        url: 'https://hbr.org',
        feedUrl: 'http://feeds.harvardbusiness.org/harvardbusiness',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '📕',
        relevanceFilter: true,
        defaultPriority: 4, // Good priority: Premier business publication, reliable Atom feed
    },

    // =====================
    // COMMUNITY
    // =====================
    {
        id: 'reddit-custom',
        name: 'Reddit (Custom Subreddits)',
        category: 'community',
        url: 'https://www.reddit.com',
        method: 'api',
        enabled: true,
        requiresKey: false,
        icon: '🔴',
        defaultPriority: 4, // Good priority: User-configured subreddit list
    },
    {
        id: 'hackernews',
        name: 'Hacker News',
        category: 'community',
        url: 'https://news.ycombinator.com',
        method: 'api',
        enabled: true,
        requiresKey: false,
        icon: '🟧',
        defaultPriority: 5, // High priority: High-quality tech discussions, excellent API
    },

    // =====================
    // NEWSLETTERS
    // =====================
    {
        id: 'import-ai',
        name: 'Import AI',
        category: 'newsletters',
        url: 'https://importai.substack.com',
        feedUrl: 'https://importai.substack.com/feed',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '📬',
        defaultPriority: 5, // High priority: Quality curation, reliable Substack RSS
    },
    {
        id: 'the-batch',
        name: 'The Batch',
        category: 'newsletters',
        url: 'https://www.deeplearning.ai/the-batch/',
        feedUrl: 'https://www.deeplearning.ai/the-batch/feed/',
        method: 'rss',
        enabled: false, // Disabled - no RSS feed available (custom Next.js site)
        requiresKey: false,
        icon: '📧',
        defaultPriority: 1, // Low priority: No RSS feed available
    },
    {
        id: 'bens-bites',
        name: "Ben's Bites",
        category: 'newsletters',
        url: 'https://bensbites.beehiiv.com',
        feedUrl: 'https://bensbites.beehiiv.com/feed',
        method: 'rss',
        enabled: false, // Disabled - Beehiiv feed returns 404
        requiresKey: false,
        icon: '🍪',
        relevanceFilter: true,
        defaultPriority: 1, // Low priority: Feed returns 404
    },
    {
        id: 'the-rundown-ai',
        name: 'The Rundown AI',
        category: 'newsletters',
        url: 'https://therundownai.com',
        feedUrl: 'https://therundownai.com/feed',
        method: 'rss',
        enabled: false, // Disabled - domain is no longer active (for sale)
        requiresKey: false,
        icon: '🏃',
        relevanceFilter: true,
        defaultPriority: 1, // Low priority: Domain no longer active
    },
    {
        id: 'latent-space',
        name: 'Latent Space',
        category: 'newsletters',
        url: 'https://www.latent.space',
        feedUrl: 'https://www.latent.space/feed',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🌌',
        defaultPriority: 5, // High priority: Excellent AI content, reliable RSS
    },
    {
        id: 'simon-willison',
        name: 'Simon Willison',
        category: 'newsletters',
        url: 'https://simonwillison.net',
        feedUrl: 'https://simonwillison.net/atom/everything/',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🔧',
        defaultPriority: 5, // High priority: High-quality insights, reliable Atom feed
    },
    {
        id: 'ahead-of-ai',
        name: 'Ahead of AI',
        category: 'newsletters',
        url: 'https://magazine.sebastianraschka.com',
        feedUrl: 'https://magazine.sebastianraschka.com/feed',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🧪',
        defaultPriority: 5, // High priority: Expert analysis, reliable RSS
    },
    {
        id: 'interconnects',
        name: 'Interconnects',
        category: 'newsletters',
        url: 'https://www.interconnects.ai',
        feedUrl: 'https://www.interconnects.ai/feed',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🔗',
        defaultPriority: 4, // Good priority: Quality AI analysis, reliable RSS
    },
    {
        id: 'one-useful-thing',
        name: 'One Useful Thing (Ethan Mollick)',
        category: 'newsletters',
        url: 'https://www.oneusefulthing.org',
        feedUrl: 'https://www.oneusefulthing.org/feed',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '💡',
        relevanceFilter: true,
        defaultPriority: 5, // High priority: Wharton professor on AI in workplace, highly aligned
    },
    {
        id: 'pragmatic-engineer',
        name: 'The Pragmatic Engineer (Gergely Orosz)',
        category: 'newsletters',
        url: 'https://newsletter.pragmaticengineer.com',
        feedUrl: 'https://newsletter.pragmaticengineer.com/feed',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '⚙️',
        relevanceFilter: true,
        defaultPriority: 5, // High priority: Eng leadership + AI impact, highly aligned audience
    },

    // =====================
    // LEADERBOARDS
    // =====================
    {
        id: 'lmsys-arena',
        name: 'LMSYS Arena',
        category: 'leaderboards',
        url: 'https://chat.lmsys.org/?leaderboard',
        method: 'scrape',
        enabled: true,
        requiresKey: false,
        icon: '🏆',
        defaultPriority: 5, // High priority: Essential LLM benchmark, stable scraping
    },
    {
        id: 'open-llm-leaderboard',
        name: 'Open LLM Leaderboard',
        category: 'leaderboards',
        url: 'https://huggingface.co/spaces/HuggingFaceH4/open_llm_leaderboard',
        method: 'api',
        enabled: true,
        requiresKey: false,
        icon: '📊',
        defaultPriority: 5, // High priority: Official HF leaderboard, reliable API
    },
    {
        id: 'artificial-analysis',
        name: 'Artificial Analysis',
        category: 'leaderboards',
        url: 'https://artificialanalysis.ai',
        method: 'scrape',
        enabled: true,
        requiresKey: false,
        icon: '📈',
        defaultPriority: 4, // Good priority: Valuable benchmarks, scraping method
    },
];

// Helper functions
export function getSourcesByCategory(category: SourceCategory): SourceConfig[] {
    return SOURCES.filter((s) => s.category === category);
}

/**
 * Get enabled sources from static config (fallback only)
 * For user-specific enabled sources, use getEnabledSourcesFromDb()
 */
export function getEnabledSources(): SourceConfig[] {
    return SOURCES.filter((s) => s.enabled);
}

/**
 * Get enabled sources based on database settings
 */
export function getEnabledSourcesFiltered(enabledIds: string[]): SourceConfig[] {
    const enabledSet = new Set(enabledIds);
    return SOURCES.filter((s) => enabledSet.has(s.id));
}

export function getSourceById(id: string): SourceConfig | undefined {
    return SOURCES.find((s) => s.id === id);
}

export function getAllCategories(): SourceCategory[] {
    return [...new Set(SOURCES.map((s) => s.category))];
}

/**
 * Get categories that have at least one enabled source
 * Filters out empty categories from the UI
 */
export function getActiveCategoriesFiltered(enabledIds: string[]): SourceCategory[] {
    const enabledSet = new Set(enabledIds);
    const categoriesWithEnabledSources = SOURCES
        .filter(s => enabledSet.has(s.id))
        .map(s => s.category);
    return [...new Set(categoriesWithEnabledSources)];
}

export function getAllSources(): SourceConfig[] {
    return SOURCES;
}
