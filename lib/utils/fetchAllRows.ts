// Pagination helper for the PostgREST 1000-row default cap.
//
// Any single Supabase `.select()` returns at most 1000 rows unless you page
// through it with `.range()`. Code that reads a large/growing table (recipes,
// posts, user_recipe_tags, …) without paging silently truncates at 1000 — and
// anything that then counts/groups the result is wrong. This loops `.range()`
// in pages until the table is exhausted.
//
// Usage:
//   const rows = await fetchAllRows<{ id: string }>((from, to) =>
//     supabase.from('recipes').select('id').eq('user_id', uid).range(from, to)
//   );
//
// Note: only reach for this when the result set can exceed 1000. For a pure
// count, prefer `.select('*', { count: 'exact', head: true })` (no rows
// transferred). For a bounded `.in(ids)`, chunk the ids instead.

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    if (data && data.length) all.push(...data);
    if (!data || data.length < pageSize) break;
  }
  return all;
}
