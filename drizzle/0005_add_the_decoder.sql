-- Migration: Add The Decoder as a news source
-- Created: 2026-02-14
-- Description: Adds The Decoder (the-decoder.com) - 100% AI-focused news site

INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('the-decoder', true, 4, NULL)
ON CONFLICT (id) DO NOTHING;
