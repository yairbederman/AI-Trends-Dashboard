import { BaseAdapter, AdapterOptions, createContentId, parseDate } from './base';
import { SourceConfig, ContentItem } from '@/types';

interface HFModel {
    id: string;
    modelId: string;
    author: string;
    sha: string;
    lastModified: string;
    private: boolean;
    gated: boolean;
    disabled: boolean;
    downloads: number;
    likes: number;
    tags: string[];
    pipeline_tag?: string;
    library_name?: string;
    createdAt: string;
}

interface HFSpace {
    id: string;
    author: string;
    title?: string;
    emoji?: string;
    colorFrom?: string;
    colorTo?: string;
    sdk?: string;
    runtime?: {
        stage: string;
    };
    likes: number;
    createdAt: string;
    lastModified: string;
    private: boolean;
    short_description?: string;
}

/**
 * Hugging Face API adapter - fetches trending models and spaces
 */
export class HuggingFaceAdapter extends BaseAdapter {
    constructor(public source: SourceConfig) {
        super(source);
    }

    async fetch(options?: AdapterOptions): Promise<ContentItem[]> {
        try {
            // Fetch both in parallel, with individual error handling for graceful degradation
            const [modelsResult, spacesResult] = await Promise.allSettled([
                this.fetchModels(),
                this.fetchSpaces(),
            ]);

            const items: ContentItem[] = [];

            // Graceful degradation: if one fails, still return the other
            if (modelsResult.status === 'fulfilled') {
                items.push(...modelsResult.value);
            } else {
                console.warn('Failed to fetch HuggingFace models:', modelsResult.reason);
            }

            if (spacesResult.status === 'fulfilled') {
                items.push(...spacesResult.value);
            } else {
                console.warn('Failed to fetch HuggingFace spaces:', spacesResult.reason);
            }

            // Don't filter by time range — cache everything, DB query filters by user's time range.
            return items.sort(
                (a, b) =>
                    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            );
        } catch (error) {
            console.error(`Error fetching from Hugging Face:`, error);
            return [];
        }
    }

    private async fetchModels(): Promise<ContentItem[]> {
        // Sort by lastModified to get recently updated/created models
        const response = await fetch(
            'https://huggingface.co/api/models?sort=lastModified&direction=-1&limit=20',
            {
                headers: {
                    Accept: 'application/json',
                },
                next: { revalidate: 3600 },
            }
        );

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HuggingFace Models API error: ${response.status} - ${errorText}`);
        }

        const models: HFModel[] = await response.json();

        return models.map((model) => ({
            id: createContentId(this.source.id, model.id),
            sourceId: this.source.id,
            title: `${model.modelId}`,
            description: this.buildModelDescription(model),
            url: `https://huggingface.co/${model.modelId}`,
            publishedAt: parseDate(model.lastModified || model.createdAt),
            fetchedAt: new Date(),
            author: model.author,
            imageUrl: `https://huggingface.co/${model.modelId}/resolve/main/thumbnail.png`,
            tags: model.tags?.slice(0, 5),
            engagement: {
                downloads: model.downloads,
                likes: model.likes,
            },
        }));
    }

    private async fetchSpaces(): Promise<ContentItem[]> {
        // Sort by lastModified to get recently updated/created spaces
        const response = await fetch(
            'https://huggingface.co/api/spaces?sort=lastModified&direction=-1&limit=20',
            {
                headers: {
                    Accept: 'application/json',
                },
                next: { revalidate: 3600 },
            }
        );

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HuggingFace Spaces API error: ${response.status} - ${errorText}`);
        }

        const spaces: HFSpace[] = await response.json();

        return spaces.map((space) => ({
            id: createContentId(this.source.id, space.id),
            sourceId: this.source.id,
            title: `${space.title || space.id}`,
            description:
                space.short_description ||
                `Interactive demo by ${space.author} | SDK: ${space.sdk || 'Unknown'}`,
            url: `https://huggingface.co/spaces/${space.id}`,
            publishedAt: parseDate(space.lastModified || space.createdAt),
            fetchedAt: new Date(),
            author: space.author,
            tags: space.sdk ? [space.sdk] : [],
            engagement: {
                likes: space.likes,
            },
        }));
    }

    private buildModelDescription(model: HFModel): string {
        const parts: string[] = [];

        if (model.pipeline_tag) {
            parts.push(`📋 ${model.pipeline_tag}`);
        }
        if (model.library_name) {
            parts.push(`📚 ${model.library_name}`);
        }
        if (model.downloads) {
            parts.push(`⬇️ ${this.formatNumber(model.downloads)} downloads`);
        }
        if (model.likes) {
            parts.push(`❤️ ${model.likes} likes`);
        }

        return parts.join(' | ') || 'Trending AI model on Hugging Face';
    }

    private formatNumber(num: number): string {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    }
}
