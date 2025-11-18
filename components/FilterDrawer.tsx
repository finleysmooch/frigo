import { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch
} from 'react-native';
import Slider from '@react-native-community/slider';
import { colors } from '../lib/theme';

interface FilterDrawerProps {
  visible: boolean;
  onClose: () => void;
  filters: any;
  onApplyFilters: (filters: any) => void;
}

interface FilterState {
  // Time filters
  maxActiveTime?: number;
  maxTotalTime?: number;
  
  // Difficulty
  difficultyLevels: string[];
  easierThanLooks: boolean;
  
  // Cost
  maxCost?: number;
  
  // Pantry
  minPantryMatch?: number;
  
  // Cooking style
  cookingMethods: string[];
  onePostOnly: boolean;
  
  // Advanced filters
  ingredientCountRanges: string[];
  cuisineTypes: string[];
  courseTypes: string[];
  makeAheadFriendly: boolean;
  
  // Social
  recentlySaved: boolean;
  recentlyCookedByFriends: boolean;
  
  // Dietary
  dietaryTags: string[];
}

const DIFFICULTY_OPTIONS = ['easy', 'medium', 'advanced'];
const COOKING_METHODS = [
  { id: 'stovetop', label: 'Stovetop', icon: '🔥' },
  { id: 'oven', label: 'Oven', icon: '🔥' },
  { id: 'grill', label: 'Grill', icon: '🍖' },
  { id: 'slow_cooker', label: 'Slow Cooker', icon: '🥘' },
  { id: 'instant_pot', label: 'Instant Pot', icon: '⚡' },
  { id: 'air_fryer', label: 'Air Fryer', icon: '💨' },
];
const INGREDIENT_RANGES = ['1-5', '6-10', '11-15', '16+'];
const CUISINE_TYPES = [
  'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai', 
  'Indian', 'Mediterranean', 'American', 'French', 'Middle Eastern'
];
const COURSE_TYPES = ['Main', 'Side', 'Appetizer', 'Dessert', 'Breakfast', 'Snack'];
const DIETARY_TAGS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Low-Carb', 'Keto'];

export default function FilterDrawer({ visible, onClose, filters, onApplyFilters }: FilterDrawerProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localFilters, setLocalFilters] = useState<FilterState>({
    difficultyLevels: [],
    easierThanLooks: false,
    cookingMethods: [],
    onePostOnly: false,
    ingredientCountRanges: [],
    cuisineTypes: [],
    courseTypes: [],
    makeAheadFriendly: false,
    recentlySaved: false,
    recentlyCookedByFriends: false,
    dietaryTags: [],
  });

  // Initialize with current filters when drawer opens
  useEffect(() => {
    if (visible && filters) {
      setLocalFilters(prev => ({ ...prev, ...filters }));
    }
  }, [visible, filters]);

  const handleApply = () => {
    onApplyFilters(localFilters);
  };

  const handleReset = () => {
    setLocalFilters({
      difficultyLevels: [],
      easierThanLooks: false,
      cookingMethods: [],
      onePostOnly: false,
      ingredientCountRanges: [],
      cuisineTypes: [],
      courseTypes: [],
      makeAheadFriendly: false,
      recentlySaved: false,
      recentlyCookedByFriends: false,
      dietaryTags: [],
    });
  };

  const toggleArrayFilter = (key: keyof FilterState, value: string) => {
    setLocalFilters(prev => {
      const array = prev[key] as string[];
      const newArray = array.includes(value)
        ? array.filter(item => item !== value)
        : [...array, value];
      return { ...prev, [key]: newArray };
    });
  };

  const renderCheckboxGroup = (
    title: string, 
    options: string[] | { id: string; label: string; icon?: string }[], 
    stateKey: keyof FilterState
  ) => {
    return (
      <View style={styles.filterSection}>
        <Text style={styles.filterSectionTitle}>{title}</Text>
        <View style={styles.checkboxContainer}>
          {options.map(option => {
            const id = typeof option === 'string' ? option : option.id;
            const label = typeof option === 'string' ? option : option.label;
            const icon = typeof option === 'string' ? null : option.icon;
            const isSelected = (localFilters[stateKey] as string[]).includes(id);

            return (
              <TouchableOpacity
                key={id}
                style={[styles.checkbox, isSelected && styles.checkboxSelected]}
                onPress={() => toggleArrayFilter(stateKey, id)}
              >
                {icon && <Text style={styles.checkboxIcon}>{icon}</Text>}
                <Text style={[
                  styles.checkboxLabel,
                  isSelected && styles.checkboxLabelSelected
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.drawer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Filter Recipes</Text>
            <TouchableOpacity onPress={handleReset}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* ===== TIER 2: COMMON FILTERS ===== */}
            
            {/* Time Filters */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>⏱️ Active Time (hands-on)</Text>
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={120}
                  step={5}
                  value={localFilters.maxActiveTime || 120}
                  onValueChange={(value) => setLocalFilters(prev => ({ 
                    ...prev, 
                    maxActiveTime: value === 120 ? undefined : value 
                  }))}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor="#ddd"
                />
                <Text style={styles.sliderLabel}>
                  {localFilters.maxActiveTime ? `${localFilters.maxActiveTime} min` : 'Any'}
                </Text>
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>⏱️ Total Time (including inactive)</Text>
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={240}
                  step={15}
                  value={localFilters.maxTotalTime || 240}
                  onValueChange={(value) => setLocalFilters(prev => ({ 
                    ...prev, 
                    maxTotalTime: value === 240 ? undefined : value 
                  }))}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor="#ddd"
                />
                <Text style={styles.sliderLabel}>
                  {localFilters.maxTotalTime ? `${localFilters.maxTotalTime} min` : 'Any'}
                </Text>
              </View>
            </View>

            {/* Difficulty */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>📊 Difficulty</Text>
              <View style={styles.checkboxContainer}>
                {DIFFICULTY_OPTIONS.map(level => {
                  const isSelected = localFilters.difficultyLevels.includes(level);
                  return (
                    <TouchableOpacity
                      key={level}
                      style={[styles.checkbox, isSelected && styles.checkboxSelected]}
                      onPress={() => toggleArrayFilter('difficultyLevels', level)}
                    >
                      <Text style={[
                        styles.checkboxLabel,
                        isSelected && styles.checkboxLabelSelected
                      ]}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* "Easier than looks" toggle */}
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>✨ Easier than it looks</Text>
                <Switch
                  value={localFilters.easierThanLooks}
                  onValueChange={(value) => setLocalFilters(prev => ({ 
                    ...prev, 
                    easierThanLooks: value 
                  }))}
                  trackColor={{ false: '#ddd', true: colors.primaryLight }}
                  thumbColor={localFilters.easierThanLooks ? colors.primary : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Cost */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>💰 Cost per Serving</Text>
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={20}
                  step={1}
                  value={localFilters.maxCost || 20}
                  onValueChange={(value) => setLocalFilters(prev => ({ 
                    ...prev, 
                    maxCost: value === 20 ? undefined : value 
                  }))}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor="#ddd"
                />
                <Text style={styles.sliderLabel}>
                  {localFilters.maxCost ? `$${localFilters.maxCost}` : 'Any'}
                </Text>
              </View>
            </View>

            {/* Pantry Match */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>✅ Pantry Match</Text>
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100}
                  step={10}
                  value={localFilters.minPantryMatch || 0}
                  onValueChange={(value) => setLocalFilters(prev => ({ 
                    ...prev, 
                    minPantryMatch: value === 0 ? undefined : value 
                  }))}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor="#ddd"
                />
                <Text style={styles.sliderLabel}>
                  {localFilters.minPantryMatch ? `${localFilters.minPantryMatch}%+` : 'Any'}
                </Text>
              </View>
            </View>

            {/* Cooking Style */}
            {renderCheckboxGroup('🍳 Cooking Method', COOKING_METHODS, 'cookingMethods')}

            {/* One-Pot Toggle */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>🥘 One-pot meals only</Text>
              <Switch
                value={localFilters.onePostOnly}
                onValueChange={(value) => setLocalFilters(prev => ({ 
                  ...prev, 
                  onePostOnly: value 
                }))}
                trackColor={{ false: '#ddd', true: colors.primaryLight }}
                thumbColor={localFilters.onePostOnly ? colors.primary : '#f4f3f4'}
              />
            </View>

            {/* ===== TIER 3: ADVANCED FILTERS ===== */}
            <View style={styles.divider} />
            
            <TouchableOpacity 
              style={styles.advancedToggle}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              <Text style={styles.advancedToggleText}>Advanced Filters</Text>
              <Text style={styles.advancedToggleIcon}>{showAdvanced ? '▼' : '▶'}</Text>
            </TouchableOpacity>

            {showAdvanced && (
              <>
                {/* Ingredient Count */}
                {renderCheckboxGroup('📝 Ingredient Count', INGREDIENT_RANGES, 'ingredientCountRanges')}

                {/* Cuisine */}
                {renderCheckboxGroup('🌍 Cuisine Type', CUISINE_TYPES, 'cuisineTypes')}

                {/* Course Type */}
                {renderCheckboxGroup('🍽️ Course', COURSE_TYPES, 'courseTypes')}

                {/* Make-ahead */}
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>⏰ Make-ahead friendly</Text>
                  <Switch
                    value={localFilters.makeAheadFriendly}
                    onValueChange={(value) => setLocalFilters(prev => ({ 
                      ...prev, 
                      makeAheadFriendly: value 
                    }))}
                    trackColor={{ false: '#ddd', true: colors.primaryLight }}
                    thumbColor={localFilters.makeAheadFriendly ? colors.primary : '#f4f3f4'}
                  />
                </View>

                {/* Social Filters */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>👥 Social</Text>
                  
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>📌 Recently saved by me</Text>
                    <Switch
                      value={localFilters.recentlySaved}
                      onValueChange={(value) => setLocalFilters(prev => ({ 
                        ...prev, 
                        recentlySaved: value 
                      }))}
                      trackColor={{ false: '#ddd', true: colors.primaryLight }}
                      thumbColor={localFilters.recentlySaved ? colors.primary : '#f4f3f4'}
                    />
                  </View>

                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>🍳 Recently cooked by friends</Text>
                    <Switch
                      value={localFilters.recentlyCookedByFriends}
                      onValueChange={(value) => setLocalFilters(prev => ({ 
                        ...prev, 
                        recentlyCookedByFriends: value 
                      }))}
                      trackColor={{ false: '#ddd', true: colors.primaryLight }}
                      thumbColor={localFilters.recentlyCookedByFriends ? colors.primary : '#f4f3f4'}
                    />
                  </View>
                </View>

                {/* Dietary */}
                {renderCheckboxGroup('🌶️ Dietary', DIETARY_TAGS, 'dietaryTags')}
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.applyButton}
              onPress={handleApply}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  drawer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  resetText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  sliderContainer: {
    paddingHorizontal: 10,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabel: {
    textAlign: 'center',
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: -5,
  },
  checkboxContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  checkboxSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  checkboxIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  checkboxLabelSelected: {
    color: '#333',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  switchLabel: {
    fontSize: 15,
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 20,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 15,
  },
  advancedToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  advancedToggleIcon: {
    fontSize: 14,
    color: colors.primary,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  applyButton: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});