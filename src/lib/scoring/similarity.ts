/**
 * Text similarity utilities for cross-platform deduplication and linking.
 *
 * Two algorithms:
 * - Trigram Jaccard: character-level n-gram overlap (resilient to word reordering)
 * - Token Jaccard: word-level overlap after stopword removal (captures semantic similarity)
 * - Hybrid: max of both (best of both worlds)
 */

const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'it', 'as', 'be', 'was', 'are',
    'been', 'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would',
    'can', 'could', 'should', 'may', 'might', 'not', 'no', 'so', 'if',
    'this', 'that', 'its', 'how', 'what', 'who', 'when', 'where', 'why',
]);

/**
 * Extract character trigrams from text.
 * Lowercases, strips non-alphanumeric (keeps spaces), then slides a 3-char window.
 */
export function extractTrigrams(text: string): Set<string> {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    const trigrams = new Set<string>();
    for (let i = 0; i <= cleaned.length - 3; i++) {
        trigrams.add(cleaned.slice(i, i + 3));
    }
    return trigrams;
}

/**
 * Jaccard similarity on trigram sets: |A ∩ B| / |A ∪ B|
 */
export function trigramJaccard(a: string, b: string): number {
    const setA = extractTrigrams(a);
    const setB = extractTrigrams(b);
    if (setA.size === 0 && setB.size === 0) return 1;
    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const t of setA) {
        if (setB.has(t)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

/**
 * Tokenize text: split on whitespace, lowercase, remove stopwords, drop tokens < 2 chars.
 */
export function tokenize(text: string): Set<string> {
    const tokens = new Set<string>();
    for (const word of text.toLowerCase().split(/\s+/)) {
        const cleaned = word.replace(/[^a-z0-9]/g, '');
        if (cleaned.length >= 2 && !STOPWORDS.has(cleaned)) {
            tokens.add(cleaned);
        }
    }
    return tokens;
}

/**
 * Jaccard similarity on token sets: |A ∩ B| / |A ∪ B|
 */
export function tokenJaccard(a: string, b: string): number {
    const setA = tokenize(a);
    const setB = tokenize(b);
    if (setA.size === 0 && setB.size === 0) return 1;
    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const t of setA) {
        if (setB.has(t)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

/**
 * Hybrid similarity: max(trigramJaccard, tokenJaccard).
 * Takes the best of character-level and word-level matching.
 */
export function hybridSimilarity(a: string, b: string): number {
    return Math.max(trigramJaccard(a, b), tokenJaccard(a, b));
}
