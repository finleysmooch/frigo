import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, LayoutChangeEvent, Dimensions } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { NoPhotoPlaceholder } from '../feedCard/sharedCardElements';

const RECIPE_HERO_HEIGHT = 250;
const SCREEN_WIDTH = Dimensions.get('window').width;

interface Recipe {
  id: string;
  title: string;
  description: string;
  image_url: string;
  recipe_type: string;
  prep_time_min: number;
  cook_time_min: number;
  instructions: string[];
  ingredients: string[];
  chef_name?: string;
  chef_id?: string;
  times_cooked?: number;
  book_id?: string;
  page_number?: number;
  book_title?: string;
  book_author?: string;
  servings?: number;
}

interface RecipeHeaderProps {
  recipe: Recipe;
  totalTime: number;
  onBookPress: () => void;
  onChefPress: () => void;
  onShowMealModal: () => void;
  onToggleCookSoon: () => void;
  isCookSoon: boolean;
  onTitleLayout?: (bottomY: number) => void;
}

const DESCRIPTION_LINE_LIMIT = 5;

const MINOR_WORDS = new Set(['a','an','the','and','or','of','in','for','with','to','on','at','by','is']);

function toTitleCase(str: string): string {
  return str.replace(/\S+/g, (word, idx) => {
    if (idx > 0 && MINOR_WORDS.has(word.toLowerCase())) return word.toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

export default function RecipeHeader({
  recipe, totalTime, onBookPress, onChefPress,
  onShowMealModal, onToggleCookSoon, isCookSoon, onTitleLayout,
}: RecipeHeaderProps) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [fullLineCount, setFullLineCount] = useState(0);
  // Phase 7I Checkpoint 5 / 5.2 D50: track hero image load failures so we
  // can swap to NoPhotoPlaceholder on 404 / network failure.
  const [imageFailed, setImageFailed] = useState(false);
  const { colors } = useTheme();

  const titleText = toTitleCase(recipe.title);

  // D50: show NoPhotoPlaceholder when the recipe has no image URL OR the
  // image fails to load. Matches the hero image dimensions so layout below
  // it doesn't shift.
  const showPlaceholder = !recipe.image_url || imageFailed;

  return (
    <>
      {showPlaceholder ? (
        <NoPhotoPlaceholder
          width={SCREEN_WIDTH}
          height={RECIPE_HERO_HEIGHT}
          colors={colors}
        />
      ) : (
        <Image
          source={{ uri: recipe.image_url }}
          style={styles.headerImage}
          onError={() => setImageFailed(true)}
        />
      )}

      <View style={styles.header}>
        {/* Title */}
        <Text
          style={styles.title}
          onLayout={(e: LayoutChangeEvent) => {
            if (onTitleLayout) {
              onTitleLayout(e.nativeEvent.layout.y + e.nativeEvent.layout.height);
            }
          }}
        >
          {titleText}
        </Text>

        {/* Chef + book + action buttons */}
        <View style={styles.metaActionsRow}>
          <View style={styles.metaCol}>
            {recipe.chef_name ? (
              <TouchableOpacity onPress={onChefPress}>
                <Text style={styles.chefText}>{recipe.chef_name}</Text>
              </TouchableOpacity>
            ) : null}
            {recipe.book_title ? (
              <TouchableOpacity onPress={onBookPress}>
                <Text style={styles.bookText}>
                  {recipe.book_title}
                  {recipe.page_number ? ` \u00B7 p. ${recipe.page_number}` : ''}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.actionCol}>
            <TouchableOpacity style={styles.actionBtn} onPress={onShowMealModal} activeOpacity={0.7}>
              <Text style={styles.actionBtnText}>+ Meal Plan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, isCookSoon && styles.actionBtnActive]}
              onPress={onToggleCookSoon}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionBtnText, isCookSoon && styles.actionBtnTextActive]}>
                {isCookSoon ? '✓ Saved' : '+ Cook Soon'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cooking time + servings — always visible when data exists */}
        {totalTime > 0 && (
          <Text style={styles.infoText}>
            {recipe.prep_time_min > 0 ? `Prep ${recipe.prep_time_min} min` : ''}
            {recipe.prep_time_min > 0 && recipe.cook_time_min > 0 ? '  \u00B7  ' : ''}
            {recipe.cook_time_min > 0 ? `Cook ${recipe.cook_time_min} min` : ''}
            {(recipe.prep_time_min > 0 && recipe.cook_time_min > 0) ? `  \u00B7  ${totalTime} min total` : ''}
          </Text>
        )}
        {recipe.servings ? (
          <Text style={styles.infoText}>{recipe.servings} servings</Text>
        ) : null}

        {/* Description */}
        {recipe.description ? (
          <TouchableOpacity
            style={styles.descriptionContainer}
            activeOpacity={fullLineCount > DESCRIPTION_LINE_LIMIT ? 0.7 : 1}
            onPress={() => {
              if (fullLineCount > DESCRIPTION_LINE_LIMIT) {
                setDescriptionExpanded(!descriptionExpanded);
              }
            }}
          >
            {!descriptionExpanded && (
              <Text
                style={[styles.description, styles.hiddenMeasure]}
                onTextLayout={(e) => setFullLineCount(e.nativeEvent.lines.length)}
              >
                {recipe.description}
              </Text>
            )}
            <Text
              style={styles.description}
              numberOfLines={descriptionExpanded ? undefined : DESCRIPTION_LINE_LIMIT}
            >
              {recipe.description}
            </Text>
            {!descriptionExpanded && fullLineCount > DESCRIPTION_LINE_LIMIT && (
              <Text style={styles.readMore}>Read More</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );
}

export { toTitleCase };

const styles = StyleSheet.create({
  headerImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#f0f0f0',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  metaActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  metaCol: {
    flex: 1,
    gap: 2,
  },
  actionCol: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 8,
  },
  chefText: {
    fontSize: 15,
    color: '#0d9488',
    fontWeight: '500',
  },
  bookText: {
    fontSize: 14,
    color: '#0d9488',
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0d9488',
    backgroundColor: '#fff',
  },
  actionBtnActive: {
    backgroundColor: '#0d9488',
  },
  actionBtnText: {
    fontSize: 12,
    color: '#0d9488',
    fontWeight: '500',
  },
  actionBtnTextActive: {
    color: '#fff',
  },
  infoText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 4,
  },
  descriptionContainer: {
    marginTop: 8,
  },
  description: {
    fontSize: 16,
    color: '#444',
    lineHeight: 23,
  },
  hiddenMeasure: {
    position: 'absolute',
    opacity: 0,
  },
  readMore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0d9488',
    marginTop: 4,
  },
});
