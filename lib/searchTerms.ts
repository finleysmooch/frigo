// ============================================
// FRIGO — Stacked search-term helpers (11D, entity-aware)
// ============================================
// Pure helpers for the "stacked search pills" UX shared by RecipeListScreen +
// BookViewScreen. Committed terms are pills; the box holds the in-progress
// (uncommitted) tail. Live filtering uses `effectiveTerms` (pills + tokenized
// box) AND'd via searchRecipesByMixedTerms — so filtering never depends on
// commit timing.
//
// Entity-aware + PREFIX-DEFERRED: a word does NOT commit to a pill on space if
// it could still be the start of a known multi-word entity ("molly" → "molly
// baz", "olive" → "olive oil"). It commits only once the user has clearly moved
// past it (typed a diverging next word) or completed the entity. This avoids
// prematurely locking "molly" into a pill while you're still typing "molly baz".
// The entity set comes from searchService.getSearchEntities() (real ingredient
// + chef names) — no hand-maintained blacklist.

// 11D typeahead — a search term can be free text or SCOPED to a specific kind.
// Scoped terms (chosen from the suggestion dropdown) search one dimension
// precisely; 'text' terms search across all fields (the default stacked-search
// behaviour).
// SEARCH kinds become search-term pills (intersected via the search engine).
export type SearchKind = 'text' | 'ingredient' | 'category' | 'chef' | 'cuisine';
// REFINE kinds apply an advancedFilter instead (dietary flag, cooking method,
// vibe tag, course type, or a named attribute like high-protein/quick). They
// render as refinement chips and filter via the resolver — no search query.
export type RefineKind = 'dietary' | 'method' | 'vibe' | 'course' | 'attribute';
export type SuggestionKind = Exclude<SearchKind, 'text'> | RefineKind;

export interface SearchTerm {
  kind: SearchKind;
  value: string;  // what gets searched
  label: string;  // what the pill shows
}
export interface Suggestion {
  kind: SuggestionKind;
  value: string;
  label: string;
  // Extra terms that also surface this suggestion (e.g. "diet"/"dietary" →
  // every dietary option), even though they aren't in the label.
  keywords?: string[];
}

const SEARCH_SUGGESTION_KINDS: SuggestionKind[] = ['ingredient', 'category', 'chef', 'cuisine'];
export function isSearchSuggestion(k: SuggestionKind): boolean {
  return SEARCH_SUGGESTION_KINDS.includes(k);
}

// Short labels for the suggestion-kind badge / pill prefix.
export const KIND_LABEL: Record<SearchKind | RefineKind, string> = {
  text: '',
  ingredient: 'ingredient',
  category: 'category',
  chef: 'chef',
  cuisine: 'cuisine',
  dietary: 'dietary',
  method: 'method',
  vibe: 'vibe',
  course: 'course',
  attribute: 'filter',
};

// Rank suggestions for the current query: exact prefix first, then substring,
// shorter labels first. Skips very short queries to avoid dumping the index.
export function matchSuggestions(
  query: string,
  index: Suggestion[],
  limit = 8,
): Suggestion[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const scored: { s: Suggestion; score: number; len: number }[] = [];
  for (const s of index) {
    const li = s.label.toLowerCase().indexOf(q);
    let score: number;
    if (li === 0) score = 0;        // label prefix (best)
    else if (li > 0) score = 1;     // label substring
    else if ((s.keywords ?? []).some((k) => k.toLowerCase().includes(q))) score = 2; // keyword/group match
    else continue;
    scored.push({ s, score, len: s.label.length });
  }
  scored.sort((a, b) => a.score - b.score || a.len - b.len || a.s.label.localeCompare(b.s.label));
  return scored.slice(0, limit).map((x) => x.s);
}

// Effective SEARCH terms = committed (possibly scoped) pills + the tokenized
// in-progress box (each box token is a free-text term).
export function effectiveSearchTerms(
  terms: SearchTerm[],
  boxText: string,
  entities: Set<string>,
): SearchTerm[] {
  const boxTerms: SearchTerm[] = tokenize(boxText, entities).map((v) => ({
    kind: 'text',
    value: v,
    label: v,
  }));
  return [...terms, ...boxTerms];
}

const MAX_ENTITY_WORDS = 4; // longest multi-word entity we try to match

// Greedy longest-match tokenizer: groups known multi-word entities into single
// terms, leaves everything else as single words.
export function tokenize(text: string, entities: Set<string>): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    let matched: string | null = null;
    let matchLen = 0;
    for (let len = Math.min(MAX_ENTITY_WORDS, words.length - i); len >= 2; len--) {
      const phrase = words.slice(i, i + len).join(' ');
      if (entities.has(phrase.toLowerCase())) {
        matched = phrase;
        matchLen = len;
        break;
      }
    }
    if (matched) {
      out.push(matched);
      i += matchLen;
    } else {
      out.push(words[i]);
      i += 1;
    }
  }
  return out;
}

// True iff `s` could still be extended into a longer known entity — i.e. some
// entity starts with `s` and is longer (so the user might be mid-entity).
export function isEntityPrefix(s: string, entities: Set<string>): boolean {
  const low = s.toLowerCase().trim();
  if (!low) return false;
  for (const e of entities) {
    if (e.length > low.length && e.startsWith(low)) return true;
  }
  return false;
}

// Peel completed leading terms off the box value into committed pills, keeping
// the in-progress / still-extendable tail in the box. CRUCIAL: the kept tail
// preserves the user's literal text (incl. a trailing space) so the cursor
// never jumps — only the committed prefix is removed. Returns the terms to
// commit (in order) + the remaining box text.
export function processBox(
  value: string,
  entities: Set<string>,
): { commit: string[]; rest: string } {
  // No space yet → still typing the first word; nothing to commit.
  if (!/\s/.test(value)) return { commit: [], rest: value };

  const endsWithSpace = /\s$/.test(value);
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { commit: [], rest: value };

  // Find where the in-progress (pending) term starts: extend left from the last
  // word while the run is, or could still grow into, a known entity. This keeps
  // a multi-word entity-in-progress ("molly ba…") whole in the box.
  let pendingStart = words.length - 1;
  while (pendingStart > 0) {
    const cand = words.slice(pendingStart - 1).join(' ').toLowerCase();
    if (entities.has(cand) || isEntityPrefix(cand, entities)) pendingStart--;
    else break;
  }

  const pending = words.slice(pendingStart).join(' ');
  const commit = tokenize(words.slice(0, pendingStart).join(' '), entities);

  // If the user finished the pending term (trailing space) and it can't grow
  // any further, commit it too. Otherwise keep it in the box verbatim.
  if (endsWithSpace && !isEntityPrefix(pending, entities)) {
    return { commit: [...commit, ...tokenize(pending, entities)], rest: '' };
  }
  return { commit, rest: endsWithSpace ? `${pending} ` : pending };
}

// The live AND search terms = committed pills + tokenized in-progress box.
export function effectiveTerms(
  terms: string[],
  text: string,
  entities: Set<string>,
): string[] {
  return [...terms, ...tokenize(text, entities)];
}
