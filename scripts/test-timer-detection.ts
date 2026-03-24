// Quick test: verify detectTimersInText against recipe step texts
// Run: npx tsx scripts/test-timer-detection.ts

interface DetectedTimer { label: string; seconds: number; }

const TIMER_VERBS = [
  'cook', 'bake', 'roast', 'simmer', 'boil', 'fry', 'sear', 'sauté', 'saute',
  'grill', 'broil', 'steam', 'braise', 'poach', 'rest', 'soak', 'marinate',
  'chill', 'freeze', 'cool', 'set aside', 'let sit', 'let stand', 'let rest',
  'reduce', 'caramelize', 'brown', 'crisp', 'toast', 'warm', 'heat', 'blanch',
];

function detectTimersInText(text: string): DetectedTimer[] {
  const results: DetectedTimer[] = [];
  const lower = text.toLowerCase();
  const timePattern =
    /(?:(?:about|approximately|around|exactly|roughly|at least|up to|another)\s+)?(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?)\s*|\s+to\s+(\d+(?:\.\d+)?)\s+)?(?:more\s+)?(hours?|hr|hrs|minutes?|mins?|min|seconds?|secs?|sec)\b/gi;

  let match: RegExpExecArray | null;
  while ((match = timePattern.exec(lower)) !== null) {
    const num1 = parseFloat(match[1]);
    const num2 = match[2] ? parseFloat(match[2]) : match[3] ? parseFloat(match[3]) : null;
    const unit = match[4];
    let multiplier = 60;
    if (/^(hours?|hrs?)$/i.test(unit)) multiplier = 3600;
    else if (/^(seconds?|secs?)$/i.test(unit)) multiplier = 1;
    const value = num2 != null ? (num1 + num2) / 2 : num1;
    const seconds = Math.round(value * multiplier);
    if (seconds < 5 || seconds > 14400) continue;
    const textBefore = lower.substring(Math.max(0, match.index - 80), match.index);
    let bestVerb = '', bestPos = -1;
    for (const verb of TIMER_VERBS) {
      const pos = textBefore.lastIndexOf(verb);
      if (pos > bestPos) { bestPos = pos; bestVerb = verb; }
    }
    const label = bestVerb ? bestVerb.charAt(0).toUpperCase() + bestVerb.slice(1) : 'Timer';
    results.push({ label, seconds });
  }
  return results;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m${sec > 0 ? ` ${sec}s` : ''}` : `${sec}s`;
}

// Test cases from the spec + real recipe texts
const tests = [
  "cook for 20 minutes",
  "bake 45 min",
  "simmer 1 hour",
  "rest 10-15 minutes",
  "set aside for 30 minutes",
  "about 6 minutes",
  "8 to 10 minutes",
  "exactly 16 minutes",
  "1–2 minutes",
  "30 seconds",
  // Real recipe steps
  "Arrange skin-side down in a large dry Dutch oven. Medium heat, cook undisturbed until skin releases and is light golden, 8–10 min.",
  "Continue cooking until very crisp and deeply golden, 6–8 min more. Transfer to a plate, skin-side up.",
  "Add 2 cups water, butter, 1 tsp salt. Scrape up stuck bits. Bring to boil. Nestle chicken back in skin-side up. Cover, low heat, exactly 16 min. Turn off heat. Steam covered 10 more min.",
  "Spread on baking sheet and roast until golden brown, 20 to 25 minutes.",
  "Meanwhile, put 2 tbsp of oil into a large sauté pan and place over medium-high heat. Add the onion and fry for 7–8 minutes, until soft and caramelized.",
  "Place 1½ cups basmati rice in a medium bowl and cover with room-temperature water. Let the rice soak for 30 minutes.",
];

console.log("=== Timer Detection Test ===\n");
for (const text of tests) {
  const timers = detectTimersInText(text);
  const preview = text.length > 70 ? text.substring(0, 70) + "..." : text;
  console.log(`"${preview}"`);
  if (timers.length === 0) {
    console.log("  (no timers detected)");
  } else {
    for (const t of timers) {
      console.log(`  → ${t.label}: ${fmt(t.seconds)} (${t.seconds}s)`);
    }
  }
  console.log();
}
