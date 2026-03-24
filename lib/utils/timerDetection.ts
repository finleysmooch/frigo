// lib/utils/timerDetection.ts
// Auto-detect timer suggestions from recipe step text.

export interface DetectedTimer {
  label: string;
  seconds: number;
}

// Verbs that typically precede a time duration in recipe text
const TIMER_VERBS = [
  'cook', 'bake', 'roast', 'simmer', 'boil', 'fry', 'sear', 'sauté', 'saute',
  'grill', 'broil', 'steam', 'braise', 'poach', 'rest', 'soak', 'marinate',
  'chill', 'freeze', 'cool', 'set aside', 'let sit', 'let stand', 'let rest',
  'reduce', 'caramelize', 'brown', 'crisp', 'toast', 'warm', 'heat', 'blanch',
];

/**
 * Detect timer durations from recipe step text.
 *
 * Matches patterns like:
 *   "cook for 20 minutes" → 1200s
 *   "simmer 1 hour" → 3600s
 *   "rest 10-15 minutes" → 750s (midpoint)
 *   "about 6 minutes" → 360s
 *   "8 to 10 minutes" → 540s (midpoint)
 *   "exactly 16 minutes" → 960s
 *   "1–2 minutes" → 90s (midpoint)
 *   "30 seconds" → 30s
 */
export function detectTimersInText(text: string): DetectedTimer[] {
  const results: DetectedTimer[] = [];
  const lower = text.toLowerCase();

  // Pattern: optional qualifier + number (or range) + unit
  // Ranges: "10-15", "10–15", "10 to 15", "8 to 10"
  const timePattern =
    /(?:(?:about|approximately|around|exactly|roughly|at least|up to|another)\s+)?(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?)\s*|\s+to\s+(\d+(?:\.\d+)?)\s+)?(?:more\s+)?(hours?|hr|hrs|minutes?|mins?|min|seconds?|secs?|sec)\b/gi;

  let match: RegExpExecArray | null;
  while ((match = timePattern.exec(lower)) !== null) {
    const num1 = parseFloat(match[1]);
    const num2 = match[2] ? parseFloat(match[2]) : match[3] ? parseFloat(match[3]) : null;
    const unit = match[4];

    // Convert to seconds
    let multiplier = 60; // default: minutes
    if (/^(hours?|hrs?)$/i.test(unit)) multiplier = 3600;
    else if (/^(seconds?|secs?)$/i.test(unit)) multiplier = 1;

    const value = num2 != null ? (num1 + num2) / 2 : num1;
    const seconds = Math.round(value * multiplier);

    // Skip very short (<5s) or very long (>4 hours)
    if (seconds < 5 || seconds > 14400) continue;

    // Find a label: look for a verb before this match
    const textBefore = lower.substring(Math.max(0, match.index - 80), match.index);
    const label = extractLabel(textBefore);

    results.push({ label, seconds });
  }

  return results;
}

/** Extract a short label from the text preceding a time mention */
function extractLabel(textBefore: string): string {
  // Search for the last occurrence of a known verb
  let bestVerb = '';
  let bestPos = -1;

  for (const verb of TIMER_VERBS) {
    const pos = textBefore.lastIndexOf(verb);
    if (pos > bestPos) {
      bestPos = pos;
      bestVerb = verb;
    }
  }

  if (bestVerb) {
    // Capitalize first letter
    return bestVerb.charAt(0).toUpperCase() + bestVerb.slice(1);
  }

  // Fallback: use "Timer"
  return 'Timer';
}

/** Format seconds to mm:ss or h:mm:ss */
export function formatTime(totalSeconds: number): string {
  const negative = totalSeconds < 0;
  const abs = Math.abs(Math.round(totalSeconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const prefix = negative ? '-' : '';

  if (h > 0) return `${prefix}${h}:${pad(m)}:${pad(s)}`;
  return `${prefix}${m}:${pad(s)}`;
}
