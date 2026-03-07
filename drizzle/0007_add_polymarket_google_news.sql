-- Add Polymarket (predictions) and Google News AI (news) sources
INSERT INTO sources (id, enabled, priority)
VALUES ('polymarket', true, 3), ('google-news-ai', true, 3)
ON CONFLICT (id) DO NOTHING;
