# Skill Plan: database-migration-safety

## Origin Story

During the system audit, FK constraints and NOT NULL constraints were added to the schema:
- `content_items.source_id` -> `sources.id` (ON DELETE CASCADE)
- `engagement_snapshots.content_id` -> `content_items.id` (ON DELETE CASCADE)
- `sources.enabled` and `sources.priority` changed from nullable to NOT NULL

Issues:
- No verification was done post-deploy to confirm the constraints applied cleanly
- The impact of CASCADE deletes wasn't analyzed (deleting a source now cascades to all its content and snapshots)
- Duplicate indexes existed (`idx_content_source` and `idx_content_items_source_id` are identical) — not caught
- The NOT NULL migration assumed no existing NULL values (they didn't exist, but no check was done)
- When things broke, FK constraints were initially suspected as the cause (they weren't — it was query latency)

## Skill Identity

| Field | Value |
|-------|-------|
| **Name** | `database-migration-safety` |
| **Description** | Safe patterns for applying schema migrations to production databases — FK constraints, NOT NULL changes, index management, and cascade analysis. Use when adding constraints, modifying columns, creating indexes, or running any DDL against a live database. |
| **Tags** | `database`, `migration`, `schema`, `safety`, `postgresql`, `supabase` |
| **Capabilities** | `fk-impact-analysis`, `not-null-migration`, `index-audit`, `cascade-analysis`, `post-deploy-verification`, `rollback-planning` |

## Sections

### 1. Migration Risk Levels

| Change Type | Risk | Why |
|---|---|---|
| Add index | Low | Non-blocking on Postgres (CREATE INDEX CONCURRENTLY) |
| Add nullable column | Low | No existing data affected |
| Add NOT NULL column with default | Medium | Rewrites table on older Postgres versions |
| Add FK constraint | Medium | Validates all existing rows; fails if orphans exist |
| Add NOT NULL to existing column | High | Fails if ANY null values exist |
| Rename/drop column | High | Breaks running application code |
| Add CASCADE delete | High | Deleting parent silently deletes children |

### 2. Pre-Migration Checklist
Before running any DDL:
- [ ] **Check for existing violations**: `SELECT count(*) FROM child WHERE parent_id NOT IN (SELECT id FROM parent)`
- [ ] **Check for NULLs**: `SELECT count(*) FROM table WHERE column IS NULL`
- [ ] **Estimate table size**: `SELECT pg_size_pretty(pg_total_relation_size('table_name'))`
- [ ] **Check for locks**: Will this DDL lock the table? For how long?
- [ ] **Plan rollback**: What's the reverse DDL?

### 3. FK Constraints — CASCADE Analysis
When adding `ON DELETE CASCADE`:
1. Map the full cascade chain: Parent -> Child -> Grandchild
2. Count affected rows: `SELECT source_id, count(*) FROM content_items GROUP BY source_id`
3. Ask: "If someone deletes a source, should ALL its content AND snapshots vanish silently?"
4. Consider alternatives:
   - `ON DELETE RESTRICT` — prevent deletion if children exist
   - `ON DELETE SET NULL` — orphan children gracefully
   - Application-level soft delete — mark as deleted, don't physically remove

Decision matrix:

| Scenario | Recommendation |
|---|---|
| Parent is rarely deleted, children are disposable | CASCADE |
| Parent might be deleted, children have independent value | SET NULL or RESTRICT |
| Children reference other tables too | RESTRICT (avoid cascade chains) |
| Audit trail matters | Soft delete at app level |

### 4. NOT NULL Migrations
Safe pattern for adding NOT NULL to existing column:
```sql
-- Step 1: Check for NULLs
SELECT count(*) FROM sources WHERE enabled IS NULL;

-- Step 2: Backfill NULLs (if any)
UPDATE sources SET enabled = true WHERE enabled IS NULL;

-- Step 3: Add constraint
ALTER TABLE sources ALTER COLUMN enabled SET NOT NULL;
```
**Never** combine step 2 and 3 in one migration without checking step 1.

### 5. Index Audit
Before adding indexes, check for duplicates:
```sql
SELECT tablename, array_agg(indexname) as indexes, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename, indexdef
HAVING count(*) > 1;
```
Common waste: ORM-generated indexes that duplicate manually created ones.

### 6. Post-Migration Verification
After applying migration:
- [ ] **Constraint exists**: Query `information_schema.table_constraints`
- [ ] **No orphaned rows**: Re-run the pre-migration violation check
- [ ] **Application works**: Hit every API endpoint that touches the modified table
- [ ] **Performance unchanged**: Compare query times before and after
- [ ] **Indexes healthy**: `SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0` (unused indexes)

### 7. Rollback Patterns

| Change | Rollback DDL |
|---|---|
| Added FK | `ALTER TABLE child DROP CONSTRAINT constraint_name;` |
| Added NOT NULL | `ALTER TABLE t ALTER COLUMN c DROP NOT NULL;` |
| Added index | `DROP INDEX index_name;` |
| Added column | `ALTER TABLE t DROP COLUMN c;` |

**Always test rollback DDL in staging before production.**
