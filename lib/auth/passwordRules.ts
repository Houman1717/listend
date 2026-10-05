import { isAuthWeakPasswordError } from '@supabase/supabase-js';

// Mirrors the Supabase Auth password policy (Dashboard → Authentication →
// Providers → Email): lower + upper + digit + symbol. Supabase's own rejection
// message spells out every allowed character ("abcdefghijklmnopqrstuvwxyz,
// ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789, !@#$%^&*…"), which users found
// unreadable — so we check first and say only what's missing.
export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_HINT =
  `At least ${PASSWORD_MIN_LENGTH} characters, with an uppercase letter, a lowercase letter, a number and a symbol.`;

const RULES = [
  { label: 'an uppercase letter', test: /[A-Z]/ },
  { label: 'a lowercase letter',  test: /[a-z]/ },
  { label: 'a number',            test: /[0-9]/ },
  // Supabase's exact symbol set — a space, £ or emoji doesn't count for it.
  { label: 'a symbol',            test: /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/ },
];

function listOf(items: string[]): string {
  return items.length <= 1
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** What the password still needs, phrased for an alert — null if it passes. */
export function passwordProblem(password: string): string | null {
  const missing = RULES.filter(r => !r.test.test(password)).map(r => r.label);
  const tooShort = password.length < PASSWORD_MIN_LENGTH;

  if (tooShort && missing.length) return `Use at least ${PASSWORD_MIN_LENGTH} characters, and add ${listOf(missing)}.`;
  if (tooShort) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (missing.length) return `Add ${listOf(missing)}.`;
  return null;
}

/**
 * Friendly text for a Supabase weak-password rejection, or null for any other
 * error. Covers what the local check can't see (a leaked password, or the
 * dashboard policy being tightened past PASSWORD_MIN_LENGTH).
 */
export function weakPasswordMessage(error: unknown, password: string): string | null {
  if (!isAuthWeakPasswordError(error)) return null;
  if (error.reasons.includes('pwned')) {
    return 'This password has shown up in a data breach. Please choose a different one.';
  }
  return passwordProblem(password) ?? 'Please choose a longer or stronger password.';
}
