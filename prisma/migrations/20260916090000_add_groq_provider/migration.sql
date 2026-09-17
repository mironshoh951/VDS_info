-- Groq as a routable AI provider.
--
-- `ALTER TYPE ... ADD VALUE` is permitted inside a transaction on PostgreSQL 12
-- and later, but the new value cannot be *used* in that same transaction. This
-- migration only declares it; the first row written with it comes later, from
-- the application.
--
-- IF NOT EXISTS keeps the migration safe to re-run against a database where a
-- developer already added the value by hand.
ALTER TYPE "AIProvider" ADD VALUE IF NOT EXISTS 'GROQ';
