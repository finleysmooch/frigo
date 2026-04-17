// lib/services/shareService.ts
// Phase 7J — Recipe and post sharing via React Native's built-in Share API.

import { Share } from 'react-native';

/**
 * Share a recipe via the native share sheet.
 * TODO: When deep linking ships, replace the plain text message with a Frigo deep link URL.
 */
export async function shareRecipe(recipe: {
  title: string;
  chef_name?: string;
  book_title?: string;
  book_author?: string;
  page_number?: number;
}): Promise<void> {
  try {
    let message = `Check out this recipe: ${recipe.title}`;
    const attribution = recipe.chef_name || recipe.book_author;
    if (attribution) message += ` by ${attribution}`;
    if (recipe.book_title) message += ` from ${recipe.book_title}`;
    if (recipe.page_number) message += ` (p. ${recipe.page_number})`;
    message += '\n\nShared from Frigo';

    console.warn(`[shareService] shareRecipe — "${recipe.title}"`);
    await Share.share({ message, title: recipe.title });
  } catch (error) {
    console.warn('[shareService] shareRecipe error:', error);
  }
}

/**
 * Share a cook post via the native share sheet.
 * TODO: When deep linking ships, replace the plain text message with a Frigo deep link URL.
 */
export async function sharePost(post: {
  title: string;
  author_name: string;
  recipe_title?: string;
}): Promise<void> {
  try {
    const dishName = post.recipe_title && post.recipe_title !== post.title
      ? post.recipe_title
      : post.title;
    const message = `${post.author_name} cooked ${dishName}\n\nShared from Frigo`;

    console.warn(`[shareService] sharePost — "${dishName}" by ${post.author_name}`);
    await Share.share({ message });
  } catch (error) {
    console.warn('[shareService] sharePost error:', error);
  }
}
