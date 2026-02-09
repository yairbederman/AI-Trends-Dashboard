-- Migration: Add missing sources to database
-- Created: 2026-02-08
-- Description: Ensures all sources from sources.ts config are present in the sources table

-- Add YouTube (CRITICAL - has channels configured in settings)
INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('youtube', true, 3, NULL)
ON CONFLICT (id) DO NOTHING;

-- Add other missing sources from config
INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('twitter', false, 3, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('linkedin', false, 3, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('midjourney', true, 3, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('kling', true, 3, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('pika', false, 3, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('suno', true, 3, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('lmsys-arena', true, 3, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('open-llm-leaderboard', true, 3, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('artificial-analysis', true, 3, NULL)
ON CONFLICT (id) DO NOTHING;
