/**
 * Database Setup Script
 *
 * This script:
 * 1. Creates the database schema (tables)
 * 2. Runs all migrations to populate initial data
 *
 * Run with: npm run db:setup
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '../src/lib/db/schema';
import { sql } from 'drizzle-orm';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
}

console.log('🔗 Connecting to database...');

const client = postgres(connectionString, {
    max: 1,
    onnotice: () => { },
});

const db = drizzle(client, { schema });

async function setupDatabase() {
    try {
        console.log('\n📋 Step 1: Creating database schema...');

        // Create tables manually since we're using postgres.js
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        `);

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS sources (
                id TEXT PRIMARY KEY,
                enabled BOOLEAN NOT NULL DEFAULT true,
                priority INTEGER NOT NULL DEFAULT 3,
                last_fetched_at TIMESTAMP
            );
        `);

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS content_items (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                url TEXT NOT NULL,
                image_url TEXT,
                published_at TIMESTAMP WITH TIME ZONE NOT NULL,
                fetched_at TIMESTAMP WITH TIME ZONE NOT NULL,
                author TEXT,
                tags TEXT,
                sentiment TEXT,
                sentiment_score DOUBLE PRECISION,
                engagement TEXT
            );
        `);

        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_content_source ON content_items(source_id);
        `);

        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_content_published ON content_items(published_at);
        `);

        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_content_source_published ON content_items(source_id, published_at);
        `);

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS engagement_snapshots (
                id SERIAL PRIMARY KEY,
                content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
                snapshot_at TIMESTAMP WITH TIME ZONE NOT NULL,
                upvotes INTEGER,
                comments INTEGER,
                views INTEGER,
                likes INTEGER,
                stars INTEGER,
                forks INTEGER,
                downloads INTEGER,
                claps INTEGER,
                velocity_score DOUBLE PRECISION
            );
        `);

        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_snapshot_content ON engagement_snapshots(content_id);
        `);

        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_snapshot_time ON engagement_snapshots(snapshot_at);
        `);

        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_snapshot_content_time ON engagement_snapshots(content_id, snapshot_at);
        `);

        console.log('✅ Schema created successfully');

        console.log('\n📋 Step 2: Running migrations...');

        // Migration 1: Initialize default settings
        await db.execute(sql`
            INSERT INTO settings (key, value)
            VALUES ('theme', '"dark"')
            ON CONFLICT (key) DO NOTHING;
        `);

        await db.execute(sql`
            INSERT INTO settings (key, value)
            VALUES ('timeRange', '"24h"')
            ON CONFLICT (key) DO NOTHING;
        `);

        await db.execute(sql`
            INSERT INTO settings (key, value)
            VALUES ('boostKeywords', '[]')
            ON CONFLICT (key) DO NOTHING;
        `);

        await db.execute(sql`
            INSERT INTO settings (key, value)
            VALUES ('customSubreddits', '[
              {"name":"MachineLearning"},
              {"name":"LocalLLaMA"},
              {"name":"ChatGPT"},
              {"name":"StableDiffusion"},
              {"name":"artificial"},
              {"name":"ClaudeAI"},
              {"name":"singularity"},
              {"name":"ExperiencedDevs"},
              {"name":"OpenAI"},
              {"name":"coding"},
              {"name":"startups"},
              {"name":"AgentBased"}
            ]')
            ON CONFLICT (key) DO NOTHING;
        `);

        await db.execute(sql`
            INSERT INTO settings (key, value)
            VALUES ('youtubeChannels', '[
              {"channelId":"UCsBjURrPoezykLs9EqgamOA","name":"Fireship"},
              {"channelId":"UChpleBmo18P08aKCIgti38g","name":"Matt Wolfe"},
              {"channelId":"UCNJ1Ymd5yFuUPtn21xtRbbw","name":"AI Explained"},
              {"channelId":"UCbfYPyITQ-7l4upoX8nvctg","name":"Two Minute Papers"},
              {"channelId":"UCHhYXsLBEVVnbvsq57n1MTQ","name":"The AI Advantage"},
              {"channelId":"UCawZsQWqfGSbCI5yjkdVkTA","name":"Matthew Berman"},
              {"channelId":"UCvKRFNawVcuz4b9ihUTApCg","name":"David Shapiro"},
              {"channelId":"UCZHmQk67mSJgfCCTn7xBfew","name":"Yannic Kilcher"},
              {"channelId":"UCXUPKJO5MZQN11PqgIvyuvQ","name":"Andrej Karpathy"},
              {"channelId":"UCqcbQf6yw5KzRoDDcZ_wBSw","name":"Wes Roth"},
              {"channelId":"UC2WmuBuFq6gL08QYG-JjXKw","name":"WorldofAI"},
              {"channelId":"UCR9j1jqqB5Rse69wjUnbYwA","name":"All About AI"},
              {"channelId":"UCbY9xX3_jW5c2fjlZVBI4cg","name":"TheAIGRID"}
            ]')
            ON CONFLICT (key) DO NOTHING;
        `);

        await db.execute(sql`
            INSERT INTO settings (key, value)
            VALUES ('customSources', '[]')
            ON CONFLICT (key) DO NOTHING;
        `);

        await db.execute(sql`
            INSERT INTO settings (key, value)
            VALUES ('deletedSources', '[]')
            ON CONFLICT (key) DO NOTHING;
        `);

        await db.execute(sql`
            INSERT INTO settings (key, value)
            VALUES ('sourceHealth', '{}')
            ON CONFLICT (key) DO NOTHING;
        `);

        console.log('✅ Migration 1: Default settings initialized');

        // Migration 2: Add sources
        const sourcesToAdd = [
            { id: 'reddit-custom', enabled: true },
            { id: 'youtube', enabled: true },
            { id: 'twitter', enabled: false },
            { id: 'linkedin', enabled: false },
            { id: 'lmsys-arena', enabled: true },
            { id: 'open-llm-leaderboard', enabled: true },
            { id: 'artificial-analysis', enabled: true },
            { id: 'forbes-ai', enabled: true },
            { id: 'mit-sloan-review', enabled: true },
            { id: 'mckinsey-ai', enabled: true },
            { id: 'hbr', enabled: true },
            { id: 'one-useful-thing', enabled: true },
            { id: 'pragmatic-engineer', enabled: true },
        ];

        for (const source of sourcesToAdd) {
            await db.execute(sql`
                INSERT INTO sources (id, enabled, priority, last_fetched_at)
                VALUES (${source.id}, ${source.enabled}, 3, NULL)
                ON CONFLICT (id) DO NOTHING;
            `);
        }

        console.log('✅ Migration 2: Sources initialized');

        // Migration 3: Update source priorities based on platform reliability
        console.log('\n📋 Step 3: Updating source priorities...');

        // Priority 5 (Highest - Most reliable)
        const priority5Sources = [
            'anthropic-blog', 'deepmind-blog',
            'huggingface', 'arxiv-cs-ai', 'arxiv-cs-cl',
            'mit-tech-review', 'hackernews',
            'import-ai', 'latent-space', 'simon-willison', 'ahead-of-ai', 'one-useful-thing', 'pragmatic-engineer',
            'lmsys-arena', 'open-llm-leaderboard'
        ];

        for (const sourceId of priority5Sources) {
            await db.execute(sql`UPDATE sources SET priority = 5 WHERE id = ${sourceId}`);
        }

        // Priority 4 (Good reliability)
        const priority4Sources = [
            'openai-blog',
            'microsoft-ai', 'nvidia-ai', 'cohere-blog', 'stability-ai', 'aws-ai-blog', 'apple-ml',
            'langchain-blog', 'wandb-blog', 'youtube',
            'verge-ai', 'techcrunch-ai', 'venturebeat-ai', 'ars-technica-ai', 'wired-ai',
            'forbes-ai', 'mit-sloan-review', 'mckinsey-ai', 'hbr',
            'reddit-custom',
            'interconnects', 'artificial-analysis'
        ];

        // Priority 3 (Medium)
        const priority3Sources = [
            'google-ai-blog', 'github-trending'
        ];

        for (const sourceId of priority3Sources) {
            await db.execute(sql`UPDATE sources SET priority = 3 WHERE id = ${sourceId}`);
        }

        for (const sourceId of priority4Sources) {
            await db.execute(sql`UPDATE sources SET priority = 4 WHERE id = ${sourceId}`);
        }

        // Priority 1 (Low - broken/disabled)
        const priority1Sources = [
            'meta-ai-blog', 'mistral-ai',
            'papers-with-code', 'llamaindex-blog',
            'twitter', 'linkedin',
            'the-batch', 'bens-bites', 'the-rundown-ai'
        ];

        for (const sourceId of priority1Sources) {
            await db.execute(sql`UPDATE sources SET priority = 1 WHERE id = ${sourceId}`);
        }

        console.log('✅ Migration 3: Source priorities updated');

        // Verify setup
        console.log('\n📊 Verifying setup...');
        const settingsResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM settings`);
        const sourcesResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM sources`);

        const settingsCount = settingsResult[0]?.count || 0;
        const sourcesCount = sourcesResult[0]?.count || 0;

        console.log(`  - Settings: ${settingsCount} records`);
        console.log(`  - Sources: ${sourcesCount} records`);

        console.log('\n✅ Database setup complete!');
        console.log('🚀 You can now run your application');

    } catch (error) {
        console.error('\n❌ Setup failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

setupDatabase();
