import { BaseAdapter, AdapterOptions, createContentId, parseDate } from './base';
import { SourceConfig, ContentItem } from '@/types';

interface PolymarketOutcome {
    price: string;
    title?: string;
}

interface PolymarketMarket {
    outcomePrices: string;  // JSON string array e.g. '["0.73","0.27"]'
    outcomes: string;       // JSON string array e.g. '["Yes","No"]'
    question?: string;
    volume: string;
}

interface PolymarketEvent {
    id: string;
    slug: string;
    title: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    updatedAt?: string;     // Last activity timestamp
    volume: number;         // Total USDC traded
    markets: PolymarketMarket[];
    tags?: { label: string; slug: string }[];
}

/**
 * Polymarket API adapter — fetches active AI prediction markets
 */
export class PolymarketAdapter extends BaseAdapter {
    constructor(public source: SourceConfig) {
        super(source);
    }

    async fetch(options?: AdapterOptions): Promise<ContentItem[]> {
        try {
            const events = await this.fetchWithRetry(() => this.fetchEvents());
            return events;
        } catch (error) {
            console.error('Error fetching from Polymarket:', error);
            return [];
        }
    }

    private async fetchEvents(): Promise<ContentItem[]> {
        const response = await fetch(
            'https://gamma-api.polymarket.com/events?tag_slug=ai&active=true&closed=false&limit=50',
            {
                headers: { Accept: 'application/json' },
                next: { revalidate: 1800 },
            }
        );

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Polymarket API error: ${response.status} - ${errorText}`);
        }

        const events: PolymarketEvent[] = await response.json();

        return events.map((event) => ({
            id: createContentId(this.source.id, event.id),
            sourceId: this.source.id,
            title: event.title,
            description: this.buildDescription(event),
            url: `https://polymarket.com/event/${event.slug}`,
            publishedAt: parseDate(event.updatedAt || event.startDate),
            fetchedAt: new Date(),
            tags: event.tags?.map(t => t.label) ?? [],
            engagement: {
                views: Math.round(event.volume || 0),
            },
        }));
    }

    private buildDescription(event: PolymarketEvent): string {
        if (!event.markets || event.markets.length === 0) {
            return event.description || 'Active prediction market on Polymarket';
        }

        // Find the leading sub-market and extract its probability
        const leadingMarket = event.markets[0];
        const probability = this.extractProbability(leadingMarket);
        const question = leadingMarket.question || event.title;

        if (probability !== null) {
            return `${Math.round(probability * 100)}% chance — ${question}`;
        }

        return event.description || 'Active prediction market on Polymarket';
    }

    private extractProbability(market: PolymarketMarket): number | null {
        try {
            const prices: string[] = JSON.parse(market.outcomePrices);
            if (prices.length > 0) {
                // First price is typically "Yes" probability
                const prob = parseFloat(prices[0]);
                if (!isNaN(prob) && prob >= 0 && prob <= 1) {
                    return prob;
                }
            }
        } catch {
            // outcomePrices may not be valid JSON — fall through
        }
        return null;
    }
}
