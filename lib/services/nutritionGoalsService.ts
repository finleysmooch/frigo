import { supabase } from '../supabase';

export interface NutritionGoal {
  nutrient: string;  // 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sodium'
  goalValue: number; // daily target
  goalUnit: string;  // 'cal' | 'g' | 'mg'
}

export async function getNutritionGoals(userId: string): Promise<NutritionGoal[]> {
  const { data, error } = await supabase
    .from('user_nutrition_goals')
    .select('nutrient, goal_value, goal_unit')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching nutrition goals:', error);
    return [];
  }

  return (data || []).map(row => ({
    nutrient: row.nutrient,
    goalValue: Number(row.goal_value),
    goalUnit: row.goal_unit,
  }));
}

export async function upsertNutritionGoals(
  userId: string,
  goals: NutritionGoal[]
): Promise<void> {
  const rows = goals.map(g => ({
    user_id: userId,
    nutrient: g.nutrient,
    goal_value: g.goalValue,
    goal_unit: g.goalUnit,
    goal_period: 'daily',
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('user_nutrition_goals')
    .upsert(rows, { onConflict: 'user_id,nutrient' });

  if (error) {
    console.error('Error upserting nutrition goals:', error);
    throw error;
  }
}

export async function deleteNutritionGoal(
  userId: string,
  nutrient: string
): Promise<void> {
  const { error } = await supabase
    .from('user_nutrition_goals')
    .delete()
    .eq('user_id', userId)
    .eq('nutrient', nutrient);

  if (error) console.error('Error deleting nutrition goal:', error);
}
