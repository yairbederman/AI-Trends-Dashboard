/**
 * Lightweight keyword-based sentiment analyzer for AI news content.
 * Returns sentiment label and score (0-1, where 0=negative, 0.5=neutral, 1=positive).
 */

const POSITIVE_KEYWORDS = [
    // Achievement & progress
    'breakthrough', 'milestone', 'achieves', 'achieved', 'surpasses', 'outperforms',
    'state-of-the-art', 'sota', 'record-breaking', 'best-in-class',
    // Growth & improvement
    'improves', 'improved', 'faster', 'efficient', 'upgrade', 'enhanced',
    'advances', 'advancing', 'innovation', 'innovative', 'revolutionary',
    'impressive', 'remarkable', 'significant', 'powerful',
    // Positive actions
    'launches', 'launched', 'releases', 'released', 'introduces', 'introduced',
    'unveils', 'unveiled', 'announces', 'open-source', 'open source',
    'free', 'available', 'accessible', 'democratize',
    // Positive outcomes
    'success', 'successful', 'wins', 'won', 'award', 'leading',
    'exciting', 'promising', 'optimistic', 'confident',
    'growth', 'funding', 'investment', 'partnership', 'collaboration',
];

const NEGATIVE_KEYWORDS = [
    // Risk & concern
    'risk', 'danger', 'dangerous', 'threat', 'threatens', 'harmful',
    'concern', 'concerning', 'worried', 'warning', 'warns', 'alarming',
    // Failure & problems
    'fails', 'failed', 'failure', 'bug', 'vulnerability', 'exploit',
    'broken', 'crashes', 'crash', 'error', 'flaw', 'flawed',
    'decline', 'declining', 'worse', 'worst', 'downturn',
    // Negative actions
    'bans', 'banned', 'blocks', 'blocked', 'restricts', 'restricted',
    'layoffs', 'layoff', 'fired', 'shutdown', 'shuts down', 'sued',
    'lawsuit', 'controversy', 'controversial', 'backlash', 'criticism',
    // Safety & ethics concerns
    'bias', 'biased', 'hallucination', 'hallucinations', 'misinformation',
    'deepfake', 'deepfakes', 'surveillance', 'privacy violation',
    'misuse', 'abuse', 'leak', 'leaked', 'breach',
];

export interface SentimentResult {
    sentiment: 'positive' | 'neutral' | 'negative';
    score: number; // 0-1 where 0=most negative, 0.5=neutral, 1=most positive
}

export function analyzeSentiment(title: string, description?: string): SentimentResult {
    const text = `${title} ${description || ''}`.toLowerCase();

    let positiveCount = 0;
    let negativeCount = 0;

    for (const keyword of POSITIVE_KEYWORDS) {
        if (text.includes(keyword)) positiveCount++;
    }

    for (const keyword of NEGATIVE_KEYWORDS) {
        if (text.includes(keyword)) negativeCount++;
    }

    const total = positiveCount + negativeCount;

    if (total === 0) {
        return { sentiment: 'neutral', score: 0.5 };
    }

    // Score: ratio of positive to total, mapped to 0-1
    const rawScore = positiveCount / total;

    // Classify
    let sentiment: 'positive' | 'neutral' | 'negative';
    if (rawScore >= 0.6) {
        sentiment = 'positive';
    } else if (rawScore <= 0.4) {
        sentiment = 'negative';
    } else {
        sentiment = 'neutral';
    }

    return { sentiment, score: rawScore };
}
