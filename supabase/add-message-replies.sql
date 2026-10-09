-- ─── DM replies (swipe a message to reply to it) ─────────────────────────────
--
-- A reply is an ordinary message that points at the one it answers. It comes
-- back with the conversation's normal messages select (and its 5s poll), and
-- the quote is drawn from the already-loaded conversation, so nothing new is
-- readable by anyone. If the original is deleted the reply stays and simply
-- loses its quote.
--
-- reply_to takes whatever type messages.id already is, so this runs whether
-- ids are UUIDs or bigints.
--
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  id_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO id_type
    FROM pg_attribute a
   WHERE a.attrelid = 'public.messages'::regclass
     AND a.attname  = 'id';

  EXECUTE format(
    'ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to %s REFERENCES public.messages(id) ON DELETE SET NULL',
    id_type
  );
END $$;

-- Keeps ON DELETE SET NULL from scanning the whole table for each deleted message.
CREATE INDEX IF NOT EXISTS messages_reply_to_idx ON public.messages (reply_to);
