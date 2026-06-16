-- Custom SQL migration file, put your code below! --
-- sub2api fork: BM25 indexes require the paradedb tantivy access method
-- which is not provided by the pgvector image used in our dev compose.
-- Skip the entire migration; queries in src/repositories/search will fall
-- back to returning no results (or be patched to use a LIKE-based fallback
-- if needed). Restore by switching to paradedb/paradedb:latest-pg17 and
-- reverting both 0090_enable_pg_search.sql and this file.
SELECT 1;
