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
    },
    {
        id: 'anthropic-blog',
        name: 'Anthropic',
        category: 'ai-labs',
        url: 'https://www.anthropic.com/news',
        feedUrl: 'https://www.anthropic.com/rss.xml',
        method: 'rss',
        enabled: true,
        requiresKey: false,
        icon: '🟠',
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
    },

    // =====================
    // CREATIVE AI
    // =====================
    {
        id: 'runway',
        name: 'Runway',
        category: 'creative-ai',
        url: 'https://runwayml.com/news',
        feedUrl: 'https://runwayml.com/news/rss.xml',
        method: 'rss',
        enabled: false, // Disabled - no RSS feed available (Next.js site, blog moved to /news)
        requiresKey: false,
        icon: '🎬',
    },
    {
        id: 'elevenlabs',
        name: 'ElevenLabs',
        category: 'creative-ai',
        url: 'https://elevenlabs.io/blog',
        feedUrl: 'https://elevenlabs.io/blog/rss/',
        method: 'rss',
        enabled: false, // Disabled - no RSS feed available (Next.js site, no feed endpoint)
        requiresKey: false,
        icon: '🎙️',
    },
    {
        id: 'suno',
        name: 'Suno',
        category: 'creative-ai',
        url: 'https://suno.com/blog',
        method: 'scrape',
        enabled: true,
        requiresKey: false,
        icon: '🎵',
    },
    {
        id: 'kling',
        name: 'Kling AI',
        category: 'creative-ai',
        url: 'https://klingai.com',
        method: 'scrape',
        enabled: true,
        requiresKey: false,
        icon: '🎥',
    },
    {
        id: 'pika',
        name: 'Pika Labs',
        category: 'creative-ai',
        url: 'https://pika.art/blog',
        method: 'scrape',
        enabled: true,
        requiresKey: false,
        icon: '⚡',
    },
    {
        id: 'midjourney',
        name: 'Midjourney',
        category: 'creative-ai',
        url: 'https://midjourney.com',
        method: 'scrape',
        enabled: true,
        requiresKey: false,
        icon: '🎨',
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
    },

    // =====================
    // COMMUNITY
    // =====================
    {
        id: 'reddit-ml',
        name: 'r/MachineLearning',
        category: 'community',
        url: 'https://www.reddit.com/r/MachineLearning/',
        method: 'api',
        enabled: true,
        requiresKey: false,
        icon: '🤖',
    },
    {
        id: 'reddit-localllama',
        name: 'r/LocalLLaMA',
        category: 'community',
        url: 'https://www.reddit.com/r/LocalLLaMA/',
        method: 'api',
        enabled: true,
        requiresKey: false,
        icon: '🦙',
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
    },
    {
        id: 'reddit-chatgpt',
        name: 'r/ChatGPT',
        category: 'community',
        url: 'https://www.reddit.com/r/ChatGPT/',
        method: 'api',
        enabled: true,
        requiresKey: false,
        icon: '💬',
    },
    {
        id: 'reddit-stablediffusion',
        name: 'r/StableDiffusion',
        category: 'community',
        url: 'https://www.reddit.com/r/StableDiffusion/',
        method: 'api',
        enabled: true,
        requiresKey: false,
        icon: '🖼️',
    },
    {
        id: 'reddit-artificial',
        name: 'r/artificial',
        category: 'community',
        url: 'https://www.reddit.com/r/artificial/',
        method: 'api',
        enabled: true,
        requiresKey: false,
        icon: '🤖',
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

export function getAllSources(): SourceConfig[] {
    return SOURCES;
}
