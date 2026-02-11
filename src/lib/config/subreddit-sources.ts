/**
 * Subreddit configuration for the AI Trends Dashboard.
 * Posts are fetched via Reddit's public JSON API (no auth required).
 * Users can customize this list via the Settings page.
 */

export interface SubredditConfig {
    name: string; // subreddit name without r/ prefix
}

/**
 * Default curated list of AI-focused subreddits.
 * Used as the initial value when no user customization exists.
 */
export const DEFAULT_SUBREDDITS: SubredditConfig[] = [
    { name: 'MachineLearning' },
    { name: 'LocalLLaMA' },
    { name: 'ChatGPT' },
    { name: 'StableDiffusion' },
    { name: 'artificial' },
    { name: 'ClaudeAI' },
    { name: 'singularity' },
    { name: 'ExperiencedDevs' },
    { name: 'OpenAI' },
    { name: 'coding' },
    { name: 'startups' },
    { name: 'AgentBased' },
];
