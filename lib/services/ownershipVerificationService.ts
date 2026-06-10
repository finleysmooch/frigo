import { supabase } from '../supabase';
import { uploadImage } from './imageStorageService';

/**
 * Ownership verification (CP6a-1 capture/submit + CP6a-2 admin review).
 *
 * Verify-first cookbook delivery: a user submits proof (the book photographed WITH a handwritten
 * note showing today's date); an admin reviews it (or a trusted-allowlist user auto-grants on
 * submit). DELIVERS NO recipes — approval flips status to 'verified' and leaves delivered_at NULL;
 * CP6b processes status='verified' AND delivered_at IS NULL and delivers. Approval is inert until
 * CP6b exists.
 *
 * SOURCE OF TRUTH: public.book_ownership_verifications. Do NOT read the legacy
 * user_books.ownership_* columns as verification truth (they remain for now; consolidation is
 * tracked in DEFERRED_WORK).
 *
 * Security model (enforced by the DB, not this client):
 * - CP6a-1 RLS pins client inserts/updates to status='pending' with privileged columns empty —
 *   a client can NEVER write 'verified' directly. Self-verify is impossible.
 * - CP6a-2 moves all privileged writes into SECURITY DEFINER RPCs (submit_verification with
 *   server-side trusted-allowlist evaluation; list_pending_verifications / review_verification gated
 *   by is_admin()). Trust is server-evaluated, never client-claimed; only an admin can approve/reject.
 */

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface BookOwnershipVerification {
  id: string;
  user_id: string;
  book_id: string;
  status: VerificationStatus;
  proof_image_path: string | null;
  submitted_at: string;
  // Privileged columns — written only by CP6a-2 RPCs (review_verification / trusted auto-grant).
  verified_at: string | null;
  reviewed_by: string | null;
  auto_granted: boolean;
  review_note: string | null;
  delivered_at: string | null;
}

/** A pending verification as seen by an admin in the review portal, with a short-TTL signed proof URL. */
export interface PendingVerification {
  id: string;
  user_id: string;
  user_email: string | null;
  user_display_name: string | null;
  book_id: string;
  book_title: string;
  book_author: string | null;
  proof_image_path: string | null;
  submitted_at: string;
  /** Short-lived signed URL minted client-side for the proof image (null if no path / mint failed). */
  signed_url: string | null;
}

/**
 * Submit (or re-submit) ownership proof for a book.
 *
 * Uploads the proof image to the PRIVATE verification-images bucket under the user's own folder
 * (required for the path-scoped storage RLS), then writes the row through the `submit_verification`
 * SECURITY DEFINER RPC — NOT a direct table upsert. The RPC evaluates trusted-allowlist membership
 * SERVER-SIDE: a trusted user's row auto-grants to 'verified' (auto_granted=true, audit preserved);
 * everyone else stays 'pending'. The client cannot influence that decision (CP6a-1's RLS also still
 * blocks any direct client write of 'verified' as a backstop). Re-submitting a still-pending row
 * swaps the proof; a row already reviewed (verified/rejected) is not re-opened.
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

  // Route the row write through the definer RPC so trusted auto-grant is server-evaluated.
  const { data, error } = await supabase.rpc('submit_verification', {
    p_book_id: bookId,
    p_proof_path: path,
  });

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

// ───────────────────────────────────────────────────────────────────────────────────────────────
// CP6a-2 — admin review (privileged). Every method below is gated server-side by is_admin() inside
// the RPC; the gate here (isAdmin) is only a UI convenience, never the security boundary.
// ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Is the current user an admin (member of app_admins)? Used to gate the review portal's UI.
 * The real boundary is the RPC self-checks — a non-admin who reaches the screen still can't act.
 */
export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) {
    console.error('❌ isAdmin error:', error);
    return false;
  }
  return data === true;
}

/**
 * List all pending verifications for the review portal (admin only — the RPC raises otherwise).
 * The RPC returns rows + proof PATHS; we mint a short-TTL signed URL per proof here in JS (a
 * Postgres function can't mint a Storage-signed URL). The admin bucket-read-all policy authorizes
 * reading another user's path.
 */
export async function listPendingVerifications(): Promise<PendingVerification[]> {
  const { data, error } = await supabase.rpc('list_pending_verifications');
  if (error) {
    console.error('❌ listPendingVerifications error:', error);
    throw error;
  }

  const rows = (data ?? []) as Omit<PendingVerification, 'signed_url'>[];
  return Promise.all(
    rows.map(async (row) => {
      let signed_url: string | null = null;
      if (row.proof_image_path) {
        const { data: signed, error: signErr } = await supabase.storage
          .from('verification-images')
          .createSignedUrl(row.proof_image_path, 300); // 5-minute TTL, display-only
        if (signErr) {
          console.warn('Could not sign proof URL for', row.id, signErr.message);
        }
        signed_url = signed?.signedUrl ?? null;
      }
      return { ...row, signed_url };
    })
  );
}

/**
 * Approve or reject a verification (admin only — the RPC raises otherwise).
 * approve → status 'verified', delivered_at left NULL (CP6b delivers). reject → 'rejected' + note
 * (the F&F "flag"). A row already delivered (delivered_at set) cannot be re-reviewed (RPC raises).
 */
export async function reviewVerification(
  id: string,
  decision: 'verified' | 'rejected',
  note?: string
): Promise<BookOwnershipVerification> {
  const { data, error } = await supabase.rpc('review_verification', {
    p_id: id,
    p_decision: decision,
    p_note: note ?? null,
  });
  if (error) {
    console.error('❌ reviewVerification error:', error);
    throw error;
  }
  return data as BookOwnershipVerification;
}
