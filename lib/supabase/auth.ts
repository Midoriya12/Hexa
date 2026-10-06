// Auth wrappers — the entire phone-OTP path (patches #6, #20).
// Dev runs against Supabase Auth TEST phone numbers (fixed OTP, zero SMS, no MSG91).
// At launch, MSG91 is wired purely via Supabase Auth → SMS Provider (Custom) with NO
// client change. There is deliberately no send-otp Edge Function (patch #6).
import type { Session } from '@supabase/supabase-js';

import { supabase } from './client';
import type { UserRow } from '@/types/database';

/** Send the OTP. `phone` must be E.164, e.g. "+15551234567" (see lib/config/region toE164). */
export async function requestOtp(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
}

/** Verify the 6-digit code. On success Supabase persists the session (MMKV adapter). */
export async function verifyOtp(phone: string, token: string): Promise<Session> {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
  if (!data.session) throw new Error('verifyOtp returned no session');
  return data.session;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Fetch the caller's own users row (RLS scopes this to auth.uid() = id).
 * Returns null if no row exists yet (i.e. profile not set up).
 */
export async function fetchOwnUser(userId: string): Promise<UserRow | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle<UserRow>();
  if (error) throw error;
  return data;
}

/** A profile is "complete" once username + pincode are set (required in profile-setup). */
export function isProfileComplete(user: UserRow | null): boolean {
  return Boolean(user && user.username && user.pincode);
}

/** Patch the caller's own users row (RLS: owner-only). Returns the updated row. */
export async function updateOwnUser(userId: string, patch: Partial<UserRow>): Promise<UserRow> {
  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', userId)
    .select('*')
    .single<UserRow>();
  if (error) throw error;
  return data;
}
