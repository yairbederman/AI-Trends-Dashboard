import { ContentItem, SourceConfig } from '@/types';
import { BaseAdapter, AdapterOptions, createContentId } from './base';

interface GitHubRepo {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    description: string | null;
    stargazers_count: number;
    forks_count: number;
    language: string | null;
    topics: string[];
    owner: {
        login: string;
        avatar_url: string;
    };
    created_at: string;
    updated_at: string;
    pushed_at: string;
}

interface GitHubSearchResponse {
    total_count: number;
    items: GitHubRepo[];
}

/**
 * GitHub API Adapter
 * Fetches trending AI repositories
 */
export class GitHubAdapter extends BaseAdapter {
    private token: string | undefined;
    private baseUrl = 'https://api.github.com';

    constructor(public source: SourceConfig) {
        super(source);
        this.token = process.env.GITHUB_TOKEN;
    }

    async fetch(options?: AdapterOptions): Promise<ContentItem[]> {
        try {
            // Calculate date based on timeRange
            const cutoff = new Date();
            const timeRange = options?.timeRange || '7d';

            switch (timeRange) {
                case '1h':
                    cutoff.setHours(cutoff.getHours() - 1);
                    break;
                case '12h':
                    cutoff.setHours(cutoff.getHours() - 12);
                    break;
                case '24h':
                    cutoff.setHours(cutoff.getHours() - 24);
                    break;
                case '48h':
                    cutoff.setHours(cutoff.getHours() - 48);
                    break;
                case '7d':
                default:
                    cutoff.setDate(cutoff.getDate() - 7);
                    break;
            }

            const dateStr = cutoff.toISOString().split('T')[0];

            // For very short ranges (hours), we still query by day but filter later if needed
            // GitHub API only supports YYYY-MM-DD
            const query = encodeURIComponent(
                `(AI OR LLM OR "machine learning" OR "deep learning" OR GPT OR transformer) pushed:>${dateStr}`
            );
            const url = `${this.baseUrl}/search/repositories?q=${query}&sort=stars&order=desc&per_page=25`;

            const headers: HeadersInit = {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'AI-Trends-Dashboard',
            };

            if (this.token) {
                headers.Authorization = `Bearer ${this.token}`;
            }

            const response = await fetch(url, { headers });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('GitHub API error:', response.status, errorText);
                return [];
            }

            const data: GitHubSearchResponse = await response.json();

            const items = data.items.map((repo) => ({
                id: createContentId(this.source.id, repo.html_url),
                sourceId: this.source.id,
                title: repo.full_name,
                description: repo.description || 'No description',
                url: repo.html_url,
                imageUrl: repo.owner.avatar_url,
                publishedAt: new Date(repo.pushed_at),
                fetchedAt: new Date(),
                author: repo.owner.login,
                tags: [
                    ...(repo.topics?.slice(0, 3) || []),
                    repo.language ? repo.language.toLowerCase() : null,
                ].filter(Boolean) as string[],
                engagement: {
                    stars: repo.stargazers_count,
                    forks: repo.forks_count,
                },
            }));

            return items;
        } catch (error) {
            console.error('Failed to fetch GitHub:', error);
            return [];
        }
    }

    private formatDescription(repo: GitHubRepo): string {
        const desc = repo.description || 'No description';
        const stats = `⭐ ${this.formatNumber(repo.stargazers_count)} | 🍴 ${this.formatNumber(repo.forks_count)}`;
        return `${stats} — ${desc}`.slice(0, 300);
    }

    private formatNumber(num: number): string {
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toString();
    }
}
