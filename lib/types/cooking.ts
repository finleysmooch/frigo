// lib/types/cooking.ts
// Types for cooking mode v2 — sessions, step notes, sections, normalized steps

export interface StepNote {
  id: string;
  user_id: string;
  recipe_id: string;
  step_number: number;
  note_text: string | null;
  voice_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CookingSession {
  id: string;
  user_id: string;
  recipe_id: string;
  started_at: string;
  completed_at: string | null;
  timer_history: TimerHistoryEntry[];
  steps_completed: number;
  total_steps: number;
  view_mode: 'step_by_step' | 'classic';
  created_at: string;
}

export interface TimerHistoryEntry {
  label: string;
  stepNumber: number;
  recommendedSeconds: number;
  actualSeconds: number;
}

export interface InstructionSection {
  name: string;
  startStep: number;  // 1-indexed
  endStep: number;    // 1-indexed, inclusive
}

export interface StepIngredient {
  name: string;
  quantity: string;
  preparation: string;
  originalText: string;
}

// Normalized step — handles both instruction formats
export interface NormalizedStep {
  number: number;       // 1-indexed
  text: string;
  section?: string;     // section name if present
}
