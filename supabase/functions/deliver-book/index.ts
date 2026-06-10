// supabase/functions/deliver-book/index.ts
// CP6b — ASYNC invocation for copy-on-verify delivery.
//
// INVOCATION CHOICE (Task e, flagged): an async edge function, NOT synchronous inside
// review_verification. Rationale: a recipe-windfall book can carry 100+ canonical recipes; deep-copying
// them (recipe row + 5 child tables each) inside the admin's review_verification call would block the
// approval RPC for seconds-to-minutes. Decoupling keeps approval instant and makes delivery retriable.
//
// WIRING (deploy-time): the approval path enqueues this function after status→'verified' — either a
// Database Webhook on UPDATE OF status ON book_ownership_verifications (fires when status becomes
// 'verified'), or an explicit enqueue from the admin portal right after reviewVerification() resolves.
// The function is idempotent on delivered_at, so duplicate triggers are safe.
//
// This runs with the SERVICE ROLE (it reads canonical recipes owned by the assembly account and writes
// rows under another user — both require bypassing RLS). It must NEVER be exposed to anon/clients.
//
// NOTE (deploy): Supabase bundles only files under supabase/functions/. At deploy, copySet.ts +
// recipeDeliveryService.ts are vendored into supabase/functions/_shared/ (they are Deno-compatible —
// copySet has no imports; recipeDeliveryService imports only `import type { SupabaseClient }` + copySet).
// The import below points at that vendored location.

// @ts-ignore - resolved in the Deno edge runtime at deploy
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore - vendored at deploy (see NOTE above)
import { deliverVerifiedBook } from '../_shared/recipeDeliveryService.ts';

// @ts-ignore - Deno global in the edge runtime
declare const Deno: any;

export default async function handler(req: Request): Promise<Response> {
  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // AUTHORIZATION — internal-only gate (the REAL check, not a comment). This function does privileged
    // cross-user writes via the service role; only an internal caller presenting the service-role key
    // (the approval DB-webhook / server enqueue) may invoke it. An arbitrary authenticated client
    // (anon/user JWT) is REJECTED here — Supabase's default verify_jwt lets any signed-in user reach the
    // function, so this bearer check is what actually closes the surface. (An equally valid alternative
    // is a dedicated DELIVERY_INTERNAL_SECRET; the service-role key is used here to avoid a new secret.)
    const presented = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!serviceKey || presented !== serviceKey) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
    }

    const { user_id, book_id } = await req.json();
    if (!user_id || !book_id) {
      return new Response(JSON.stringify({ error: 'user_id and book_id required' }), { status: 400 });
    }

    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceKey, // service role — server-only
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const result = await deliverVerifiedBook(client, user_id, book_id);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 500 });
  }
}
