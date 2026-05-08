DELETE FROM updown_sessions;

ALTER TABLE updown_sessions
RENAME COLUMN current_level_tenths TO current_step;

ALTER TABLE updown_sessions
ADD COLUMN mode TEXT NOT NULL DEFAULT 'internal_level';
