import { FetchQuality } from '@/types';

const DOMAIN_QUALITY: Record<string, FetchQuality> = {
  // High — open or well-structured content
  'arxiv.org': 'high',
  'github.com': 'high',
  'huggingface.co': 'high',
  'reddit.com': 'high',
  'openai.com': 'high',
  'anthropic.com': 'high',
  'deepmind.google': 'high',
  'ai.meta.com': 'high',
  'blog.google': 'high',
  'pytorch.org': 'high',
  'tensorflow.org': 'high',

  // Medium — generally scrapable but may have some restrictions
  'techcrunch.com': 'medium',
  'theverge.com': 'medium',
  'substack.com': 'medium',
  'medium.com': 'medium',
  'arstechnica.com': 'medium',
  'wired.com': 'medium',
  'venturebeat.com': 'medium',
  'thenewstack.io': 'medium',

  // Low — paywalled or anti-scrape
  'nytimes.com': 'low',
  'wsj.com': 'low',
  'bloomberg.com': 'low',
  'x.com': 'low',
  'twitter.com': 'low',
  'linkedin.com': 'low',
  'ft.com': 'low',
};

/**
 * Returns a quality assessment for how fetchable/scrapable content
 * from a given URL's domain is likely to be.
 */
export function getDomainQuality(url: string): FetchQuality {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    // Check exact match first, then try parent domain (e.g. blog.google → google)
    if (DOMAIN_QUALITY[hostname]) return DOMAIN_QUALITY[hostname];
    // Check if any known domain is a suffix (e.g. sub.medium.com → medium.com)
    for (const [domain, quality] of Object.entries(DOMAIN_QUALITY)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return quality;
      }
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
