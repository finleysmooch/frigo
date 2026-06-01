// lib/utils/sourceLabel.ts
// Friendly display name for a web recipe's source domain. NYT Cooking gets a
// branded label; other domains fall back to a title-cased first segment
// (e.g. "seriouseats.com" -> "Seriouseats"). Returns null when no domain.
// Shared by RecipeHeader, RecipeCard, FilterDrawer, and AuthorViewScreen.

export function sourceLabel(domain?: string | null): string | null {
  if (!domain) return null;
  if (domain === 'cooking.nytimes.com') return 'NYT Cooking';
  const base = domain.replace(/^www\./, '').split('.')[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}
