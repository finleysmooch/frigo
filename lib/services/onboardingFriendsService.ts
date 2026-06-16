// CP9b — T5 Find Friends data layer. Follows the `follows` table convention
// used by UserSearchScreen (follower_id / following_id) + the increment RPCs.
// Services handle all DB calls (CLAUDE.md) — the screen stays presentational.

import { supabase } from '../supabase';

export interface PersonResult {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  isFollowing: boolean;
}

/** Name search (S1: no usernames for new users — display_name is primary). */
export async function searchPeople(
  currentUserId: string,
  query: string
): Promise<PersonResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, display_name, username, avatar_url')
    .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
    .neq('id', currentUserId)
    .limit(20);
  if (error) {
    console.error('❌ searchPeople error:', error);
    throw error;
  }

  const ids = (data ?? []).map((u) => u.id);
  const followed = await followingSet(currentUserId, ids);
  return (data ?? []).map((u) => ({
    id: u.id,
    display_name: u.display_name ?? null,
    username: u.username ?? null,
    avatar_url: u.avatar_url ?? null,
    isFollowing: followed.has(u.id),
  }));
}

async function followingSet(currentUserId: string, candidateIds: string[]): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', currentUserId)
    .in('following_id', candidateIds);
  return new Set((data ?? []).map((f) => f.following_id));
}

/** Follow a user. Idempotent-ish: a duplicate follow is swallowed. Counts are
 *  best-effort (the increment RPCs exist; failures are non-fatal). */
export async function followPerson(currentUserId: string, targetId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: currentUserId, following_id: targetId });
  if (error && error.code !== '23505') {
    console.error('❌ followPerson error:', error);
    throw error;
  }
  // Best-effort denormalized counts (mirrors UserSearchScreen).
  supabase.rpc('increment_followers_count', { user_id: targetId, increment_by: 1 }).then(undefined, () => {});
  supabase.rpc('increment_following_count', { user_id: currentUserId, increment_by: 1 }).then(undefined, () => {});
}

/**
 * D-ON-11 same-invite-code cohort ("people you may know"). The data lives in
 * `invite_code_redemptions`, which is RLS-locked (reachable only via CP2's
 * SECURITY DEFINER RPCs) — so this needs a dedicated `get_invite_cohort` RPC
 * that does not exist yet (a small migration, DEFERRED to coordinate with the
 * in-flight CP4 seed work). Until it lands this returns [] and the T5
 * "Suggested" section stays hidden; the screen ships functional via search +
 * share. No call to a nonexistent RPC is made (avoids an orphan-RPC bug).
 */
export async function getInviteCohort(_currentUserId: string): Promise<PersonResult[]> {
  return [];
}
