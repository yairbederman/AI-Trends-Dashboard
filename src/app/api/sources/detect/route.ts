import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

const COMMON_FEED_PATHS = ['/feed', '/rss', '/rss.xml', '/atom.xml', '/feed.xml', '/feed/rss', '/feed/atom'];

/**
 * POST /api/sources/detect
 * Accepts { url: string }, fetches the page, and auto-detects RSS/Atom feeds.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url || typeof url !== 'string') {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Normalize URL
        let normalizedUrl = url.trim();
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
            normalizedUrl = `https://${normalizedUrl}`;
        }

        let parsedUrl: URL;
        try {
            parsedUrl = new URL(normalizedUrl);
        } catch {
            return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
        }

        // Strategy 1: Check if the URL itself is a valid feed
        const directFeed = await tryParseFeed(normalizedUrl);
        if (directFeed) {
            return NextResponse.json(directFeed);
        }

        // Strategy 2: Fetch the HTML page and look for <link rel="alternate"> tags
        const htmlFeed = await detectFromHtml(normalizedUrl);
        if (htmlFeed) {
            // Validate the discovered feed URL
            const validated = await tryParseFeed(htmlFeed.feedUrl);
            if (validated) {
                return NextResponse.json(validated);
            }
        }

        // Strategy 3: Try common feed paths
        const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
        for (const path of COMMON_FEED_PATHS) {
            const candidateUrl = `${baseUrl}${path}`;
            const feed = await tryParseFeed(candidateUrl);
            if (feed) {
                return NextResponse.json(feed);
            }
        }

        return NextResponse.json(
            { error: 'No RSS or Atom feed found. Try entering the feed URL directly.' },
            { status: 404 }
        );
    } catch (error) {
        console.error('Feed detection error:', error);
        return NextResponse.json(
            { error: 'Failed to detect feed' },
            { status: 500 }
        );
    }
}

async function tryParseFeed(url: string): Promise<{ feedUrl: string; title: string; description?: string } | null> {
    try {
        const parser = new Parser({ timeout: 8000 });
        const feed = await parser.parseURL(url);
        if (feed && feed.items && feed.items.length > 0) {
            return {
                feedUrl: url,
                title: feed.title || new URL(url).hostname,
                description: feed.description || undefined,
            };
        }
    } catch {
        // Not a valid feed
    }
    return null;
}

async function detectFromHtml(url: string): Promise<{ feedUrl: string } | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'AI-Trends-Dashboard/1.0 (Feed Detector)',
                'Accept': 'text/html',
            },
        });
        clearTimeout(timeout);

        if (!response.ok) return null;

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) return null;

        const html = await response.text();

        // Match <link rel="alternate" type="application/rss+xml" or application/atom+xml
        const linkRegex = /<link[^>]+rel=["']alternate["'][^>]+type=["']application\/(rss\+xml|atom\+xml)["'][^>]*>/gi;
        const matches = html.matchAll(linkRegex);

        for (const match of matches) {
            const hrefMatch = match[0].match(/href=["']([^"']+)["']/);
            if (hrefMatch) {
                let feedUrl = hrefMatch[1];
                // Resolve relative URLs
                if (feedUrl.startsWith('/')) {
                    const parsed = new URL(url);
                    feedUrl = `${parsed.protocol}//${parsed.host}${feedUrl}`;
                } else if (!feedUrl.startsWith('http')) {
                    feedUrl = new URL(feedUrl, url).toString();
                }
                return { feedUrl };
            }
        }

        // Also try reverse order: type before rel
        const linkRegex2 = /<link[^>]+type=["']application\/(rss\+xml|atom\+xml)["'][^>]+rel=["']alternate["'][^>]*>/gi;
        const matches2 = html.matchAll(linkRegex2);

        for (const match of matches2) {
            const hrefMatch = match[0].match(/href=["']([^"']+)["']/);
            if (hrefMatch) {
                let feedUrl = hrefMatch[1];
                if (feedUrl.startsWith('/')) {
                    const parsed = new URL(url);
                    feedUrl = `${parsed.protocol}//${parsed.host}${feedUrl}`;
                } else if (!feedUrl.startsWith('http')) {
                    feedUrl = new URL(feedUrl, url).toString();
                }
                return { feedUrl };
            }
        }
    } catch {
        // Failed to fetch HTML
    }
    return null;
}
