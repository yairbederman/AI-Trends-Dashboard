/**
 * YouTube channel configuration for the AI Trends Dashboard.
 * Channels are fetched via free RSS feeds (zero API quota).
 * Users can customize this list via the Settings page.
 */

export interface YouTubeChannelConfig {
    channelId: string;
    name: string;
}

/**
 * Default curated list of AI-focused YouTube channels.
 * Used as the initial value when no user customization exists.
 */
export const DEFAULT_YOUTUBE_CHANNELS: YouTubeChannelConfig[] = [
    { channelId: 'UCsBjURrPoezykLs9EqgamOA', name: 'Fireship' },
    { channelId: 'UChpleBmo18P08aKCIgti38g', name: 'Matt Wolfe' },
    { channelId: 'UCNJ1Ymd5yFuUPtn21xtRbbw', name: 'AI Explained' },
    { channelId: 'UCbfYPyITQ-7l4upoX8nvctg', name: 'Two Minute Papers' },
    { channelId: 'UCHhYXsLBEVVnbvsq57n1MTQ', name: 'The AI Advantage' },
    { channelId: 'UCawZsQWqfGSbCI5yjkdVkTA', name: 'Matthew Berman' },
    { channelId: 'UCvKRFNawVcuz4b9ihUTApCg', name: 'David Shapiro' },
    { channelId: 'UCZHmQk67mSJgfCCTn7xBfew', name: 'Yannic Kilcher' },
    { channelId: 'UCXUPKJO5MZQN11PqgIvyuvQ', name: 'Andrej Karpathy' },
    { channelId: 'UCqcbQf6yw5KzRoDDcZ_wBSw', name: 'Wes Roth' },
    { channelId: 'UC2WmuBuFq6gL08QYG-JjXKw', name: 'WorldofAI' },
    { channelId: 'UCR9j1jqqB5Rse69wjUnbYwA', name: 'All About AI' },
    { channelId: 'UCbY9xX3_jW5c2fjlZVBI4cg', name: 'TheAIGRID' },
];

