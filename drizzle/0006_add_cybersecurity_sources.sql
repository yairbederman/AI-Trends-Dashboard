-- Migration: Add cybersecurity news sources
-- Created: 2026-02-22
-- Description: Adds The Hacker News and CyberScoop as cybersecurity news sources

INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('thehackernews', true, 4, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sources (id, enabled, priority, last_fetched_at)
VALUES ('cyberscoop', true, 4, NULL)
ON CONFLICT (id) DO NOTHING;
