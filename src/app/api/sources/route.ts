import { NextResponse } from 'next/server';
import { SOURCES, getAllCategories } from '@/lib/config/sources';

export async function GET() {
    const categories = getAllCategories();

    const categorizedSources = categories.map((category) => ({
        category,
        sources: SOURCES.filter((s) => s.category === category).map((s) => ({
            id: s.id,
            name: s.name,
            icon: s.icon,
            enabled: s.enabled,
            requiresKey: s.requiresKey,
            method: s.method,
        })),
    }));

    return NextResponse.json({
        categories: categorizedSources,
        totalSources: SOURCES.length,
        enabledSources: SOURCES.filter((s) => s.enabled).length,
    });
}
