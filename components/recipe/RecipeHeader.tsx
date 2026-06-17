import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, LayoutChangeEvent, Dimensions, Linking } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { NoPhotoPlaceholder } from '../feedCard/sharedCardElements';
import BookIcon from '../icons/recipe/BookIcon';
import GlobeIcon from '../icons/recipe/GlobeIcon';
import { SaveOutlineIcon, SaveFilledIcon } from './SaveIcon';
import StarIcon from '../icons/recipe/StarIcon';

// Lightweight shape of a bookmark assigned to this recipe (for the chips).
export interface RecipeBookmarkChip {
  key: string;
  name: string;
  color: string;
  kind: 'favorite' | 'cook_soon' | 'custom';
}

const SOURCE_LINK_COLOR = '#0d9488';

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
  // Source provenance for web-imported recipes (NYT Import #1). Null for
  // book/photo recipes, which use book_title above instead.
  source_url?: string;
  source_domain?: string;
  source_authors?: string[];    // all original authors; [0] is the primary (chef_name)
  source_byline?: string;       // NYT byline / adapter, e.g. "Sam Sifton"
  source_updated_at?: string;   // source last-modified (ISO) — shown as "Updated …"
}

interface RecipeHeaderProps {
  recipe: Recipe;
  totalTime: number;
  onBookPress: () => void;
  onChefPress: () => void;
  onShowMealModal: () => void;
  onOpenBookmarks: () => void;
  bookmarkChips: RecipeBookmarkChip[];
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

/**
 * Friendly source name for a web-imported recipe's domain. NYT Cooking gets a
 * branded label; other domains fall back to a title-cased first segment
 * (e.g. seriouseats.com -> "Seriouseats"). Returns null when no domain.
 */
function sourceLabel(domain?: string): string | null {
  if (!domain) return null;
  if (domain === 'cooking.nytimes.com') return 'NYT Cooking';
  const base = domain.replace(/^www\./, '').split('.')[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export default function RecipeHeader({
  recipe, totalTime, onBookPress, onChefPress,
  onShowMealModal, onOpenBookmarks, bookmarkChips, onTitleLayout,
}: RecipeHeaderProps) {
  const hasAnyBookmark = bookmarkChips.length > 0;
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
            {/* Co-authors beyond the primary (e.g. "with Sami Tamimi"). The
                primary author is the clickable chef line above. */}
            {recipe.source_authors && recipe.source_authors.length > 1 ? (
              <Text style={styles.bylineText}>with {recipe.source_authors.slice(1).join(', ')}</Text>
            ) : null}
            {recipe.book_title ? (
              <TouchableOpacity style={styles.sourceRow} onPress={onBookPress}>
                <BookIcon size={14} color={SOURCE_LINK_COLOR} />
                <Text style={styles.bookText}>
                  {recipe.book_title}
                  {recipe.page_number ? ` \u00B7 p. ${recipe.page_number}` : ''}
                </Text>
              </TouchableOpacity>
            ) : null}
            {/* Web source attribution (NYT Cooking etc.) \u2014 same slot as the
                book line, since a web recipe has no book_title. Tappable: opens
                the original recipe URL in the browser. */}
            {recipe.source_url && sourceLabel(recipe.source_domain) ? (
              <TouchableOpacity style={styles.sourceRow} onPress={() => Linking.openURL(recipe.source_url!)}>
                <GlobeIcon size={14} color={SOURCE_LINK_COLOR} />
                <Text style={styles.bookText}>
                  {sourceLabel(recipe.source_domain)} {'\u2197'}
                </Text>
              </TouchableOpacity>
            ) : null}
            {recipe.source_byline ? (
              <Text style={styles.bylineText}>Adapted by {recipe.source_byline}</Text>
            ) : null}
          </View>
          <View style={styles.actionCol}>
            <TouchableOpacity style={styles.actionBtn} onPress={onShowMealModal} activeOpacity={0.7}>
              <Text style={styles.actionBtnText}>+ Meal Plan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.bookmarkBtn, hasAnyBookmark && styles.actionBtnActive]}
              onPress={onOpenBookmarks}
              activeOpacity={0.7}
            >
              {hasAnyBookmark
                ? <SaveFilledIcon size={16} color="#fff" />
                : <SaveOutlineIcon size={16} color="#0d9488" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Bookmark chips — the recipe's selected bookmarks (star for Favorite). */}
        {bookmarkChips.length > 0 && (
          <View style={styles.chipsRow}>
            {bookmarkChips.map((c) => (
              <View key={c.key} style={[styles.chip, { backgroundColor: c.color + '22', borderColor: c.color }]}>
                {c.kind === 'favorite' && <StarIcon size={11} color={c.color} />}
                <Text style={[styles.chipText, { color: c.color }]} numberOfLines={1}>{c.name}</Text>
              </View>
            ))}
          </View>
        )}

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
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bookText: {
    fontSize: 14,
    color: '#0d9488',
  },
  bylineText: {
    fontSize: 13,
    color: '#64748b',
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
  bookmarkBtn: {
    paddingHorizontal: 10,
    minWidth: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 3,
    maxWidth: 160,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
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
