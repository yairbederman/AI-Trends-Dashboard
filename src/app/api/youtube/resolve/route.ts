import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const input = request.nextUrl.searchParams.get('input')?.trim();

    if (!input) {
        return NextResponse.json({ error: 'Missing input parameter' }, { status: 400 });
    }

    // Direct channel ID (UC...)
    const directIdMatch = input.match(/^(UC[\w-]{22})$/);
    if (directIdMatch) {
        return NextResponse.json({ channelId: directIdMatch[1], name: directIdMatch[1] });
    }

    // URL with /channel/UC...
    const channelUrlMatch = input.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
    if (channelUrlMatch) {
        return NextResponse.json({ channelId: channelUrlMatch[1], name: channelUrlMatch[1] });
    }

    // Extract @handle from input
    let handle: string | null = null;
    const handleUrlMatch = input.match(/youtube\.com\/@([\w.-]+)/);
    if (handleUrlMatch) {
        handle = handleUrlMatch[1];
    } else if (input.startsWith('@')) {
        handle = input.slice(1);
    }

    if (!handle) {
        return NextResponse.json({ error: 'Invalid input. Provide a @handle, channel URL, or channel ID (UC...).' }, { status: 400 });
    }

    // Resolve @handle via YouTube Data API
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
        return NextResponse.json(
            { error: 'No YouTube API key configured. Please provide a channel ID (UC...) directly.' },
            { status: 400 }
        );
    }

    try {
        const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=@${encodeURIComponent(handle)}&key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: data.error?.message || 'YouTube API error' },
                { status: response.status }
            );
        }

        if (!data.items || data.items.length === 0) {
            return NextResponse.json({ error: `No channel found for @${handle}` }, { status: 404 });
        }

        const channel = data.items[0];
        return NextResponse.json({
            channelId: channel.id,
            name: channel.snippet.title,
        });
    } catch (err) {
        console.error('YouTube resolve error:', err);
        return NextResponse.json({ error: 'Failed to resolve channel' }, { status: 500 });
    }
}
