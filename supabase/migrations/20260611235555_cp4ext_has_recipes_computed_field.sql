-- CP4-ext (D-ON-12): has_recipes computed field for the catalog search.
--
-- PostgREST computed column: a function taking the books row type, selectable
-- as `has_recipes` alongside real columns (searchBookCatalog adds it to its
-- select). T8a tier badges key off this per anchor section 4.1
-- (EXISTS recipes WHERE book_id = X) -- NEVER toc_extracted_at, which only
-- means "TOC processed".
--
-- SECURITY DEFINER (deliberate, grounded in live RLS): recipes' SELECT policy
-- is `is_public = true OR auth.uid() = user_id` (baseline line ~7333), so an
-- INVOKER EXISTS would return false for another user's PRIVATE canonical
-- recipes -- exactly the canonical-book case T8a badges describe. The function
-- discloses a single boolean about a catalog book (does it have transcribed
-- recipes), no row data; search_path is locked per house rule.

CREATE OR REPLACE FUNCTION public.has_recipes(b public.books)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.recipes r WHERE r.book_id = b.id);
$$;

COMMENT ON FUNCTION public.has_recipes(public.books) IS
  'D-ON-12 / CP4-ext: PostgREST computed field for books. True iff transcribed recipes exist for the book (anchor section 4.1 tier signal). SECURITY DEFINER so private canonical recipes still count; returns a boolean only.';

-- Standing rule (MIGRATIONS.md): explicit EXECUTE lockdown -- revoke BOTH the
-- PUBLIC default grant and Supabase's explicit anon default-privilege grant,
-- then grant only the intended roles. The catalog search runs authenticated
-- (onboarding T8a is post-signup); anon has no surface that selects this.
REVOKE ALL ON FUNCTION public.has_recipes(public.books) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_recipes(public.books) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_recipes(public.books) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_recipes(public.books) TO service_role;
