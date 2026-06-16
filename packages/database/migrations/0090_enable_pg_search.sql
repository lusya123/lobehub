-- Custom SQL migration file, put your code below! --
-- sub2api fork: pg_search ships with paradedb only. Our dev compose uses
-- the smaller pgvector image (paradedb's manifest pull is unreliable from
-- China mirrors), so we noop this migration. Effect: lobehub's BM25 search
-- repositories return empty result sets. Core chat (the embed entry point)
-- is unaffected. Restore by switching the compose image back to
-- paradedb/paradedb:latest-pg17 and reverting this file.
SELECT 1;