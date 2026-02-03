import { NextResponse } from 'next/server';
import {
    getSetting,
    updateSetting,
    getEnabledSourceIds,
    toggleSourceEnabled,
    setCategoryEnabled,
    getAllSourcePriorities,
    setSourcePriority,
    getBoostKeywords,
    setBoostKeywords,
} from '@/lib/db/actions';
import { TimeRange } from '@/types';

// Validation helpers
const VALID_THEMES = ['dark', 'light'] as const;
const VALID_TIME_RANGES: TimeRange[] = ['1h', '12h', '24h', '48h', '7d'];

function isValidTheme(value: unknown): value is 'dark' | 'light' {
    return typeof value === 'string' && VALID_THEMES.includes(value as 'dark' | 'light');
}

function isValidTimeRange(value: unknown): value is TimeRange {
    return typeof value === 'string' && VALID_TIME_RANGES.includes(value as TimeRange);
}

function isValidSourceId(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length < 100;
}

function isValidSourceIds(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(isValidSourceId);
}

function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

interface SettingsPayload {
    type: string;
    payload: Record<string, unknown>;
}

function validatePayload(body: unknown): body is SettingsPayload {
    if (typeof body !== 'object' || body === null) return false;
    const obj = body as Record<string, unknown>;
    return typeof obj.type === 'string' && typeof obj.payload === 'object' && obj.payload !== null;
}

export async function GET() {
    try {
        const theme = await getSetting('theme', 'dark');
        const timeRange = await getSetting('timeRange', '24h');
        const enabledSources = await getEnabledSourceIds();
        const priorities = await getAllSourcePriorities();
        const boostKeywords = await getBoostKeywords();

        return NextResponse.json({
            theme,
            timeRange,
            enabledSources,
            priorities: Object.fromEntries(priorities),
            boostKeywords,
        });
    } catch (error) {
        console.error('Failed to fetch settings:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Validate request structure
        if (!validatePayload(body)) {
            return NextResponse.json(
                { error: 'Invalid request format. Expected { type, payload }' },
                { status: 400 }
            );
        }

        const { type, payload } = body;

        switch (type) {
            case 'UPDATE_THEME': {
                if (!isValidTheme(payload.theme)) {
                    return NextResponse.json(
                        { error: `Invalid theme. Must be one of: ${VALID_THEMES.join(', ')}` },
                        { status: 400 }
                    );
                }
                await updateSetting('theme', payload.theme);
                break;
            }

            case 'UPDATE_TIME_RANGE': {
                if (!isValidTimeRange(payload.timeRange)) {
                    return NextResponse.json(
                        { error: `Invalid timeRange. Must be one of: ${VALID_TIME_RANGES.join(', ')}` },
                        { status: 400 }
                    );
                }
                await updateSetting('timeRange', payload.timeRange);
                break;
            }

            case 'TOGGLE_SOURCE': {
                if (!isValidSourceId(payload.sourceId)) {
                    return NextResponse.json(
                        { error: 'Invalid sourceId. Must be a non-empty string' },
                        { status: 400 }
                    );
                }
                if (!isBoolean(payload.enabled)) {
                    return NextResponse.json(
                        { error: 'Invalid enabled value. Must be a boolean' },
                        { status: 400 }
                    );
                }
                await toggleSourceEnabled(payload.sourceId as string, payload.enabled);
                break;
            }

            case 'TOGGLE_CATEGORY': {
                if (!isValidSourceIds(payload.sourceIds)) {
                    return NextResponse.json(
                        { error: 'Invalid sourceIds. Must be an array of non-empty strings' },
                        { status: 400 }
                    );
                }
                if (!isBoolean(payload.enabled)) {
                    return NextResponse.json(
                        { error: 'Invalid enabled value. Must be a boolean' },
                        { status: 400 }
                    );
                }
                await setCategoryEnabled(payload.sourceIds, payload.enabled);
                break;
            }

            case 'ENABLE_ALL':
            case 'DISABLE_ALL': {
                if (!isValidSourceIds(payload.sourceIds)) {
                    return NextResponse.json(
                        { error: 'Invalid sourceIds. Must be an array of non-empty strings' },
                        { status: 400 }
                    );
                }
                await setCategoryEnabled(payload.sourceIds, type === 'ENABLE_ALL');
                break;
            }

            case 'SET_PRIORITY': {
                if (!isValidSourceId(payload.sourceId)) {
                    return NextResponse.json(
                        { error: 'Invalid sourceId' },
                        { status: 400 }
                    );
                }
                const priority = Number(payload.priority);
                if (isNaN(priority) || priority < 1 || priority > 5) {
                    return NextResponse.json(
                        { error: 'Invalid priority. Must be a number between 1 and 5' },
                        { status: 400 }
                    );
                }
                await setSourcePriority(payload.sourceId as string, priority);
                break;
            }

            case 'SET_BOOST_KEYWORDS': {
                if (!Array.isArray(payload.keywords)) {
                    return NextResponse.json(
                        { error: 'Invalid keywords. Must be an array of strings' },
                        { status: 400 }
                    );
                }
                const keywords = payload.keywords
                    .filter((k: unknown) => typeof k === 'string' && k.trim().length > 0)
                    .map((k: string) => k.trim().toLowerCase());
                await setBoostKeywords(keywords);
                break;
            }

            default:
                return NextResponse.json(
                    { error: `Invalid action type: ${type}` },
                    { status: 400 }
                );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update settings:', error);
        return NextResponse.json(
            {
                error: 'Failed to update settings',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
