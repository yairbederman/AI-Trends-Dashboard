-- Migration: Add business/management news sources
-- Created: 2026-02-11
-- Description: Adds Forbes AI, MIT Sloan Management Review, McKinsey AI, and Harvard Business Review

INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('forbes-ai', true, 4, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('mit-sloan-review', true, 4, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('mckinsey-ai', true, 4, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('hbr', true, 4, NULL)
ON CONFLICT (id) DO NOTHING;
