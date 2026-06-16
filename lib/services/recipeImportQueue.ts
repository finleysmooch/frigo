// CP9d follow-up (Tom's walk feedback, 2026-06-12): background URL-import
// queue. Imports run as module-level jobs — detached from any screen — so the
// user pastes several links and keeps moving through onboarding while
// extraction (fetch → parse → match → save) finishes in the background.
// Results land in the library when done; the T9a rows reflect live status for
// as long as the user is looking. Reusable by T14's paste rail later.

import { supabase } from '../supabase';
import { extractRecipeFromUrl, getDomainFromUrl } from './recipeExtraction/webExtractor';
import { parseStandardizedRecipe } from './recipeExtraction/unifiedParser';
import { matchIngredientsToDatabase } from './recipeExtraction/ingredientMatcher';
import { saveRecipeToDatabase } from './recipeExtraction/recipeService';

export type ImportJobStatus = 'working' | 'done' | 'failed';

export interface ImportJob {
  id: number;
  url: string;
  domain: string;
  status: ImportJobStatus;
  /** Recipe title once known (parse step onward). */
  title?: string;
  /** Short, user-facing failure note. */
  error?: string;
}

let nextId = 1;
const jobs: ImportJob[] = [];
const listeners = new Set<(jobs: ImportJob[]) => void>();

const notify = () => {
  const snapshot = [...jobs];
  listeners.forEach((fn) => fn(snapshot));
};

export function getImportJobs(): ImportJob[] {
  return [...jobs];
}

export function subscribeToImports(listener: (jobs: ImportJob[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Fire-and-track: starts the extraction chain for a URL and returns
 * immediately. The job keeps running if the screen unmounts (app foregrounded).
 */
export function startRecipeImport(url: string): ImportJob {
  const fullUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
  const job: ImportJob = {
    id: nextId++,
    url: fullUrl,
    domain: getDomainFromUrl(fullUrl),
    status: 'working',
  };
  jobs.unshift(job);
  notify();

  (async () => {
    try {
      const standardized = await extractRecipeFromUrl(fullUrl);
      const extracted = await parseStandardizedRecipe(standardized);
      job.title = extracted.recipe.title;
      notify();
      const matched = await matchIngredientsToDatabase(extracted);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('no session');
      await saveRecipeToDatabase(user.id, matched);
      job.status = 'done';
    } catch (error) {
      console.error(`❌ Background import failed (${job.domain}):`, error);
      job.status = 'failed';
      job.error = "Couldn't pull a recipe from that link";
    }
    notify();
  })();

  return job;
}
