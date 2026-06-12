import { supabase } from '../supabase';

/**
 * Invite codes (CP2 / #69).
 *
 * Onboarding T2 gates entry on an invite code entered BEFORE account creation.
 * The backing tables (invite_codes, invite_code_redemptions) are NOT directly
 * readable/writable by anon or authenticated — they are reached ONLY through the two
 * SECURITY DEFINER RPCs called here.
 *
 * Generation/listing is intentionally absent: there is no admin-auth primitive yet, so
 * codes are minted via a documented SQL snippet (see docs/INVITE_CODES.md). In-app
 * generation is deferred until an admin gate exists.
 */

export type InviteCodeStatus = 'valid' | 'invalid' | 'expired' | 'redeemed';

/**
 * Validate an invite code BEFORE account creation (anon-callable).
 * Calls validate_invite_code, which returns a status string only — never the row.
 *
 * - 'valid'    → exists, active, not expired, has uses left
 * - 'invalid'  → not found or deactivated
 * - 'expired'  → past expires_at
 * - 'redeemed' → use cap reached
 */
export async function validateCode(code: string): Promise<InviteCodeStatus> {
  const { data, error } = await supabase.rpc('validate_invite_code', { p_code: code });

  if (error) {
    console.error('❌ validateCode error:', error);
    throw error;
  }

  return data as InviteCodeStatus;
}

/**
 * Redeem an invite code for the CURRENT authenticated user (must be called post-signup).
 *
 * Atomic, race-safe, and idempotent per user: a user re-calling returns true WITHOUT
 * burning a second use. Returns true if the code is (newly or already) redeemed by this
 * user; false if invalid / expired / use-cap reached.
 *
 * Best-effort by design: redemption runs AFTER the account already exists. If this returns
 * false due to a code race, surface it / log it — do NOT orphan or delete the account over
 * a code race.
 */
export async function redeemCode(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('redeem_invite_code', { p_code: code });

  if (error) {
    console.error('❌ redeemCode error:', error);
    throw error;
  }

  return data === true;
}

/**
 * CP7-minimal (D-ON-11): the CURRENT user's pass-on code — returns the existing
 * active one or mints FRIGO-XXXXX (cap 5). `sharePantry` sets the D-ON-17
 * share-my-pantry intent (re-calling updates it on the existing code): a
 * redeemer of a flagged code gets a pending invitation to the owner's pantry.
 */
export async function getMyPassOnCode(sharePantry: boolean): Promise<string> {
  const { data, error } = await supabase.rpc('generate_pass_on_code', {
    p_share_pantry: sharePantry,
  });

  if (error) {
    console.error('❌ getMyPassOnCode error:', error);
    throw error;
  }

  return data as string;
}

/** CP7-minimal: deactivate the current user's active pass-on code(s). */
export async function deactivateMyPassOnCode(): Promise<boolean> {
  const { data, error } = await supabase.rpc('deactivate_my_pass_on_code');

  if (error) {
    console.error('❌ deactivateMyPassOnCode error:', error);
    throw error;
  }

  return data === true;
}
