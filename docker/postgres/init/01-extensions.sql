-- Extensions required by the platform.
-- pgvector : RAG embeddings (KnowledgeChunk.embedding)
-- pg_trgm  : typo-tolerant / partial search matching
-- unaccent : diacritic-insensitive search for ru/uz
-- citext   : case-insensitive slugs and emails
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gin;
