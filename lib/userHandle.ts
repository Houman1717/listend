// Accounts created through Apple / Google sign-in never pick a username, so
// ensureProfile (context/AuthContext.tsx) invents one from the email prefix
// plus the last 12 hex chars of the user id. With Apple's private relay the
// email prefix is itself random, which produces handles like
// "@s6hpjrhf7r_eb990498399b" — noise that makes the app look unfinished.
//
// These helpers decide whether a username is one of those auto-generated
// placeholders. Anywhere a placeholder would be shown we render the display
// name instead, and the "@handle" line is simply omitted.

import { supabase } from '@/lib/supabase';

const AUTO_SUFFIX = /_[0-9a-f]{12}$/;

/**
 * True when `username` looks auto-generated (or is missing entirely).
 *
 * Pass `userId` whenever it's available: the generated suffix is the last 12
 * hex chars of that id, so the check becomes exact and cannot false-positive
 * on a real username that merely happens to end in hex.
 */
export function isAutoUsername(username?: string | null, userId?: string | null): boolean {
  if (!username) return true;
  if (userId) {
    const suffix = userId.replace(/-/g, '').slice(-12);
    return suffix.length === 12 && username.endsWith(`_${suffix}`);
  }
  return AUTO_SUFFIX.test(username);
}

/** "@name", or null when the username is an auto-generated placeholder. */
export function handleText(username?: string | null, userId?: string | null): string | null {
  return isAutoUsername(username, userId) ? null : `@${username}`;
}

/**
 * The single best label for a person, for the many places that show one line
 * of text: their display name, else a real username, else a generic fallback.
 */
export function nameOrHandle(
  displayName?: string | null,
  username?: string | null,
  userId?: string | null,
  fallback = 'User',
): string {
  const name = displayName?.trim();
  const auto = isAutoUsername(username, userId);
  // A sign-in that supplies no name at all (Apple with name sharing off) seeds
  // display_name from the generated username, so the placeholder can be sitting
  // in BOTH columns. A display name that is just the placeholder is not a name.
  if (name && !(auto && name === username)) return name;
  if (!auto) return username as string;
  return fallback;
}

/**
 * Label for the many one-line sites that show only a handle (review cards,
 * comments, friend chips): the real "@handle" when there is one, otherwise the
 * person's display name so the row never reads as a random id.
 */
export function handleOrName(
  username?: string | null,
  displayName?: string | null,
  userId?: string | null,
  fallback = 'User',
): string {
  return handleText(username, userId) ?? nameOrHandle(displayName, username, userId, fallback);
}

// ─── Picking a username ──────────────────────────────────────────────────────

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
const USERNAME_RE = /^[a-z0-9_]+$/;

/** Strip what a username can't contain, so the field can't hold an invalid value. */
export function normalizeUsername(input: string): string {
  return input.replace(/\s/g, '').toLowerCase();
}

/** The message to show, or null when the name is well-formed. */
export function validateUsername(name: string): string | null {
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) {
    return `Usernames are ${USERNAME_MIN}–${USERNAME_MAX} characters.`;
  }
  if (!USERNAME_RE.test(name)) return 'Use letters, numbers and underscores only.';
  return null;
}

/**
 * The message to show when the name can't be claimed, or null when it's free.
 * A failed lookup reports an error rather than silently allowing the write —
 * the unique constraint would reject it anyway, with a far worse message.
 */
export async function checkUsernameAvailable(name: string, userId: string): Promise<string | null> {
  const { data: taken, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', name)
    .neq('id', userId)
    .maybeSingle();

  if (error) return "Couldn't check that username. Try again.";
  return taken ? 'That username is taken.' : null;
}
