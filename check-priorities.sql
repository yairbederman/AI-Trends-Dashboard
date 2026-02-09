-- View all sources grouped by priority
SELECT
    priority,
    COUNT(*) as count,
    STRING_AGG(id, ', ' ORDER BY id) as sources
FROM sources
GROUP BY priority
ORDER BY priority DESC;

-- Or see individual sources sorted by priority
SELECT id, enabled, priority
FROM sources
ORDER BY priority DESC, id;
