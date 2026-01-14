import { supabase } from '../supabase';

/**
 * Upgrades a user to premium subscription tier
 * @param userId - The user's ID
 * @returns Promise<boolean> - true on success, false on failure
 */
export async function upgradeToPremium(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ subscription_tier: 'premium' })
      .eq('id', userId);

    if (error) {
      console.error('Error upgrading to premium:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to upgrade to premium:', error);
    return false;
  }
}

/**
 * Downgrades a user to free subscription tier
 * @param userId - The user's ID
 * @returns Promise<boolean> - true on success, false on failure
 */
export async function downgradeToFree(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ subscription_tier: 'free' })
      .eq('id', userId);

    if (error) {
      console.error('Error downgrading to free:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to downgrade to free:', error);
    return false;
  }
}
