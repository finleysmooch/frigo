// CP9a (D-ON-10) — onboarding completion persistence + the profile bits the
// T4 screen shows. Column: user_profiles.onboarding_completed_at (CP-persist,
// migration 20260611235055). Gate semantics are BINARY (no mid-spine resume):
// NULL = route to onboarding; non-NULL = main tabs.
//
// INTERIM (flagged in SESSION_LOG): until CP9e ships T12, the stamp is written
// at the end of the current partial spine (T4). D-ON-10's stamp-at-T12 takes
// over when CP9e lands.

import { supabase } from '../supabase';

export interface OnboardingProfile {
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

/** True iff the user has completed onboarding (onboarding_completed_at set). */
export async function getOnboardingCompleted(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('onboarding_completed_at')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('❌ getOnboardingCompleted error:', error);
    throw error;
  }

  return data?.onboarding_completed_at != null;
}

/** Stamp onboarding completion (idempotent — never overwrites an earlier stamp). */
export async function markOnboardingComplete(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', userId)
    .is('onboarding_completed_at', null);

  if (error) {
    console.error('❌ markOnboardingComplete error:', error);
    throw error;
  }
}

/** The little profile summary T4 renders (name + email + avatar state). */
export async function getOnboardingProfile(userId: string): Promise<OnboardingProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('display_name, email, avatar_url')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('❌ getOnboardingProfile error:', error);
    return null;
  }
  return data as OnboardingProfile;
}
