-- Migration: 20261010000004_qualification_statuses.sql
-- Description: Extends lead_status_db enum with Retell native qualification statuses

DO $$ BEGIN
  ALTER TYPE lead_status_db ADD VALUE IF NOT EXISTS 'confirmed';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE lead_status_db ADD VALUE IF NOT EXISTS 'interested';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE lead_status_db ADD VALUE IF NOT EXISTS 'follow_up';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE lead_status_db ADD VALUE IF NOT EXISTS 'callback';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE lead_status_db ADD VALUE IF NOT EXISTS 'not_interested';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE lead_status_db ADD VALUE IF NOT EXISTS 'do_not_call';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

