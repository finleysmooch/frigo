import { supabase } from '../supabase';
import { uploadImage } from './imageStorageService';

/**
 * Ownership verification (CP6a-1 — the additive, user-facing half).
 *
 * Verify-first cookbook delivery: a user submits proof (the book photographed WITH a handwritten
 * note showing today's date) and can read their OWN verification status. This service AUTHORIZES
 * NOTHING and DELIVERS NOTHING — there is no approve/reject/allowlist method here. Those are
 * CP6a-2's privileged SECURITY DEFINER RPCs. A row written here simply sits in 'pending' until
 * CP6a-2's review machinery exists.
 *
 * SOURCE OF TRUTH: public.book_ownership_verifications. Do NOT read the legacy
 * user_books.ownership_* columns as verification truth (they remain for now; consolidation is
 * tracked in DEFERRED_WORK).
 *
 * RLS guarantees (enforced by the DB, not by this client): a user may only insert/read/update
 * their OWN rows, and may only ever leave a row in 'pending' with all privileged columns
 * (verified_at / reviewed_by / auto_granted / review_note / delivered_at) empty. Self-verify is
 * impossible at the database level.
 */

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface BookOwnershipVerification {
  id: string;
  user_id: string;
  book_id: string;
  status: VerificationStatus;
  proof_image_path: string | null;
  submitted_at: string;
  // The following are written only by CP6a-2 — always empty for CP6a-1 submissions.
  verified_at: string | null;
  reviewed_by: string | null;
  auto_granted: boolean;
  review_note: string | null;
  delivered_at: string | null;
}

/**
 * Submit (or re-submit) ownership proof for a book.
 *
 * Uploads the proof image to the PRIVATE verification-images bucket under the user's own folder
 * (required for the path-scoped storage RLS), then upserts a 'pending' row. Re-submitting the same
 * book updates the existing pending row (unique(user_id, book_id)) — it never creates a duplicate.
 *
 * Writes ONLY user-writable columns; never the privileged ones (RLS would reject them anyway).
 *
 * Note: if a previous submission for this book has already been reviewed (status verified/rejected),
 * RLS blocks the update and this rejects — re-submission after review is a CP6a-2 policy decision,
 * not something a user self-serves. Callers should surface that error rather than retry blindly.
 */
export async function submitVerification(
  bookId: string,
  localImageUri: string
): Promise<BookOwnershipVerification> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('You must be signed in to submit ownership verification.');
  }

  // Upload to the PRIVATE bucket, folder = userId so the storage RLS path-scopes it to this user.
  // We persist the returned `path` only (the signed url is display-only and short-lived).
  const { path } = await uploadImage(localImageUri, 'verification-images', user.id);

  const { data, error } = await supabase
    .from('book_ownership_verifications')
    .upsert(
      {
        user_id: user.id,
        book_id: bookId,
        proof_image_path: path,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,book_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('❌ submitVerification error:', error);
    throw error;
  }

  return data as BookOwnershipVerification;
}

/**
 * Get the current user's verification row for a single book, or null if none exists yet.
 * Used by the capture UI to reflect status (will read 'pending' until CP6a-2 approves).
 */
export async function getMyVerification(
  bookId: string
): Promise<BookOwnershipVerification | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('book_ownership_verifications')
    .select('*')
    .eq('user_id', user.id) // RLS also enforces this; explicit for clarity + index use
    .eq('book_id', bookId)
    .maybeSingle();

  if (error) {
    console.error('❌ getMyVerification error:', error);
    throw error;
  }

  return (data as BookOwnershipVerification) ?? null;
}

/**
 * Get all of the current user's verification rows (most recent first).
 * RLS scopes the result to the caller's own rows.
 */
export async function getMyVerifications(): Promise<BookOwnershipVerification[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('book_ownership_verifications')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('❌ getMyVerifications error:', error);
    throw error;
  }

  return (data as BookOwnershipVerification[]) ?? [];
}
