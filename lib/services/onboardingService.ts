// CP9a (D-ON-10) — onboarding completion persistence + the profile bits the
// T4 screen shows. Column: user_profiles.onboarding_completed_at (CP-persist,
// migration 20260611235055). Gate semantics are BINARY (no mid-spine resume):
// NULL = route to onboarding; non-NULL = main tabs.
//
// INTERIM (flagged in SESSION_LOG): until CP9e ships T12, the stamp is written
// at the end of the current partial spine (T4). D-ON-10's stamp-at-T12 takes
// over when CP9e lands.

import { supabase } from '../supabase';
import { addRecipeTag } from './userRecipeTagsService';

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

/**
 * CP9d T9b (DEGRADED per the anchor §7 flag — decided at draft): creates the
 * signature-dish recipe + favorites it. The post-backdating flags (composer
 * "when" + backdated + estimated) do NOT exist, so no backdated post/profile
 * entry is created and times-made has no column — source and ~times are
 * embedded in the description text. The flags migration can upgrade this later.
 */
export async function addSignatureRecipe(
  userId: string,
  input: { title: string; source?: string; timesMade?: string }
): Promise<string> {
  const bits = ['Signature dish — added during onboarding'];
  if (input.source?.trim()) bits.push(`Source: ${input.source.trim()}`);
  if (input.timesMade?.trim()) bits.push(`Made ~${input.timesMade.trim()} times`);

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      user_id: userId,
      title: input.title.trim(),
      description: bits.join(' · '),
      is_public: false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ addSignatureRecipe error:', error);
    throw error;
  }

  const tag = await addRecipeTag(userId, data.id, 'favorite');
  if (!tag.success) console.warn('⚠️ signature recipe saved but favorite tag failed (non-fatal)');
  return data.id;
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
