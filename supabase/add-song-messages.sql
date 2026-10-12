-- ─── Song messages in DMs ────────────────────────────────────────────────────
--
-- Lets messages.type be 'song' (a song card, stored in album_data like album
-- cards are). Any existing CHECK on messages.type is replaced with one that
-- allows text, album and song. Older app builds show a song message as its
-- text content ("🎵 Title – Artist").
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.messages DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'album', 'song'));

COMMIT;
