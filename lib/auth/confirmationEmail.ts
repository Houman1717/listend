import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Supabase only lets one confirmation email go out per address per 60s
// (Authentication → Rate Limits), so the resend UI waits this long between taps.
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * signUp() creates the auth user BEFORE sending the confirmation email, so when
 * the send itself fails (SMTP down, Resend quota hit) the account exists but the
 * user never gets a link. Recognise that case so the UI can offer a resend
 * instead of a dead-end "Sign up failed".
 */
export function isConfirmationSendFailure(error: AuthError): boolean {
  return /sending confirmation email/i.test(error.message);
}

export function isEmailNotConfirmed(error: AuthError): boolean {
  return error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message);
}

/** Re-sends the signup confirmation link. Returns an error message, or null on success. */
export async function resendConfirmationEmail(email: string): Promise<string | null> {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
  return error ? error.message : null;
}
