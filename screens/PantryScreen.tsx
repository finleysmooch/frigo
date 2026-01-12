// ============================================
// FRIGO - PANTRY SCREEN (SPACE-AWARE)
// ============================================
// Main pantry inventory screen with shared pantry support
// Location: screens/PantryScreen.tsx
// Updated: December 17, 2025 - Added space context integration

import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing, borderRadius, shadows } from '../lib/theme';
import {
  getPantryItemsBySpace,
  updatePantryItem,
  deletePantryItem,
  addPantryItemToSpace
} from '../lib/pantryService';
import { PantryItemWithIngredient, StorageLocation } from '../lib/types/pantry';
import {
  groupItemsByFamilyAndType,
  getExpiringItems,
  convertToFamilySections,
  calculateNewExpiration,
  FamilySection,
  groupItemsByStorageAndFamily,
  StorageSection
} from '../utils/pantryHelpers';
import { getTypeIcon } from '../constants/pantry';
import { getFamilyIcon } from '../constants/pantry';

// Space Context
import { useSpace, useActiveSpaceId, useSpacePermissions } from '../contexts/SpaceContext';

// Components
import PantryItemRow from '../components/PantryItemRow';
import CategoryHeader from '../components/CategoryHeader';
import QuantityPicker from '../components/QuantityPicker';
import StoragePicker from '../components/StoragePicker';
import ExpirationPicker from '../components/ExpirationPicker';
import StorageChangePrompt from '../components/StorageChangePrompt';
import RemainderPrompt, { RemainderAction } from '../components/RemainderPrompt';
import AddPantryItemModal from '../components/AddPantryItemModal';
import QuickAddModal from '../components/QuickAddModal';

// Space Components
import SpaceSwitcher from '../components/SpaceSwitcher';
import CreateSpaceModal from '../components/CreateSpaceModal';
import PendingSpaceInvitations from '../components/PendingSpaceInvitations';

// Helper function to get storage location icon
const getStorageIcon = (storage: string): string => {
  const icons: { [key: string]: string } = {
    'fridge': '🧊',
    'freezer': '❄️',
    'pantry': '🥫',
    'counter': '🏠',
  };
  return icons[storage.toLowerCase()] || '📦';
};

type Props = NativeStackScreenProps<any, 'Pantry'>;

export default function PantryScreen({ navigation }: Props) {
  // ============================================
  // SPACE CONTEXT
  // ============================================
  
  const { 
    activeSpace, 
    isLoading: spaceLoading, 
    isSwitching,
    refreshSpaces 
  } = useSpace();
  const activeSpaceId = useActiveSpaceId();
  const { canDeleteItems } = useSpacePermissions();

  // ============================================
  // STATE
  // ============================================
  
  const [items, setItems] = useState<PantryItemWithIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Expanded/collapsed state for families
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  
  // Expanded/collapsed state for type subsections (e.g., "Proteins-POULTRY")
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  
  // View mode toggle
  const [viewMode, setViewMode] = useState<'family' | 'storage'>('family');
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  
  // Modal states
  const [showQuantityPicker, setShowQuantityPicker] = useState(false);
  const [showStoragePicker, setShowStoragePicker] = useState(false);
  const [showExpirationPicker, setShowExpirationPicker] = useState(false);
  const [showStorageChangePrompt, setShowStorageChangePrompt] = useState(false);
  const [showRemainderPrompt, setShowRemainderPrompt] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [showCreateSpaceModal, setShowCreateSpaceModal] = useState(false);
  
  // Current item being edited
  const [selectedItem, setSelectedItem] = useState<PantryItemWithIngredient | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(null);
  const [selectedIngredientName, setSelectedIngredientName] = useState<string | null>(null);
  
  // Storage change flow state
  const [newStorageLocation, setNewStorageLocation] = useState<StorageLocation>('fridge');
  const [moveQuantity, setMoveQuantity] = useState<number>(0);
  const [moveExpirationDays, setMoveExpirationDays] = useState<number>(7);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    getCurrentUser();
  }, []);

  // Reload pantry when space changes
  useEffect(() => {
    if (currentUserId && activeSpaceId) {
      loadPantryData();
    }
  }, [currentUserId, activeSpaceId]);

  // ============================================
  // DATA LOADING
  // ============================================

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    } catch (error) {
      console.error('❌ Error getting user:', error);
    }
  };

  const loadPantryData = async () => {
    if (!currentUserId || !activeSpaceId) return;

    try {
      setLoading(true);
      console.log('🔍 Loading pantry data for space:', activeSpaceId);
      
      // Use space-aware pantry query
      const allItems = await getPantryItemsBySpace(activeSpaceId);
      setItems(allItems);
      
      console.log('✅ Loaded', allItems.length, 'pantry items from space');

    } catch (error) {
      console.error('❌ Error loading pantry:', error);
      Alert.alert('Error', 'Failed to load pantry items');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPantryData();
    setRefreshing(false);
  }, [currentUserId, activeSpaceId]);

  // ============================================
  // DATA ORGANIZATION
  // ============================================

  const expiringItems = getExpiringItems(items);
  
  // Family view data
  const groupedByFamily = groupItemsByFamilyAndType(items);
  const familySections = convertToFamilySections(groupedByFamily);
  
  // Storage view data
  const storageSections = groupItemsByStorageAndFamily(items);

  // ============================================
  // HANDLERS - ITEM ACTIONS
  // ============================================

  const handleTapQuantity = (item: PantryItemWithIngredient) => {
    console.log('📊 Tapped quantity for:', item.ingredient.name);
    setSelectedItem(item);
    setShowQuantityPicker(true);
  };

  const handleTapStorage = (item: PantryItemWithIngredient) => {
    console.log('📍 Tapped storage for:', item.ingredient.name);
    setSelectedItem(item);
    setShowStoragePicker(true);
  };

  const handleTapExpiration = (item: PantryItemWithIngredient) => {
    console.log('📅 Tapped expiration for:', item.ingredient.name);
    setSelectedItem(item);
    setShowExpirationPicker(true);
  };

  const handleTapRecipes = (item: PantryItemWithIngredient) => {
    console.log('🔍 Finding recipes with:', item.ingredient.name);
    // TODO: Navigate to recipes filtered by this ingredient
    Alert.alert('Coming Soon', 'Recipe search functionality coming soon!');
  };

  const handleTapItem = (item: PantryItemWithIngredient) => {
    console.log('👆 Tapped item (full expand):', item.ingredient.name);
    // TODO: Show full item details modal or expanded view
    Alert.alert('Item Details', 'Full item details view coming soon!');
  };

  // ============================================
  // HANDLERS - PICKERS
  // ============================================

  const handleSaveQuantity = async (newQuantity: number) => {
    if (!selectedItem || !currentUserId) return;

    try {
      console.log('💾 Updating quantity:', selectedItem.ingredient.name, newQuantity);
      
      if (newQuantity === 0) {
        // Check if user can delete (guests cannot)
        if (!canDeleteItems) {
          Alert.alert('Permission Denied', 'Guests cannot delete items from shared pantries');
          return;
        }
        // Delete item if quantity is 0
        await deletePantryItem(selectedItem.id, currentUserId);
      } else {
        await updatePantryItem(
          selectedItem.id,
          { quantity_display: newQuantity },
          currentUserId
        );
      }
      
      await loadPantryData();
      console.log('✅ Quantity updated');
    } catch (error) {
      console.error('❌ Error updating quantity:', error);
      Alert.alert('Error', 'Failed to update quantity');
    }
  };

  const handleSaveStorage = async (newStorage: StorageLocation) => {
    if (!selectedItem || !currentUserId) return;

    // If storage is different, show storage change prompt
    if (newStorage !== selectedItem.storage_location) {
      console.log('🔄 Storage changed, showing prompt');
      setNewStorageLocation(newStorage);
      setShowStorageChangePrompt(true);
    }
  };

  const handleSaveExpiration = async (expirationDays: number) => {
    if (!selectedItem || !currentUserId) return;

    try {
      console.log('💾 Updating expiration:', selectedItem.ingredient.name, expirationDays, 'days');
      
      const newExpirationDate = calculateNewExpiration(
        selectedItem.storage_location,
        expirationDays
      );
      
      await updatePantryItem(
        selectedItem.id,
        { expiration_date: newExpirationDate },
        currentUserId
      );
      
      await loadPantryData();
      console.log('✅ Expiration updated');
    } catch (error) {
      console.error('❌ Error updating expiration:', error);
      Alert.alert('Error', 'Failed to update expiration');
    }
  };

  // ============================================
  // HANDLERS - STORAGE CHANGE FLOW
  // ============================================

  const handleConfirmStorageChange = async (quantity: number, expirationDays: number) => {
    if (!selectedItem || !currentUserId) return;

    setMoveQuantity(quantity);
    setMoveExpirationDays(expirationDays);

    // Check if it's a partial move
    if (quantity < selectedItem.quantity_display) {
      // Show remainder prompt
      console.log('📦 Partial move, showing remainder prompt');
      setShowRemainderPrompt(true);
    } else {
      // Full move, just update the item
      await executeStorageMove(quantity, expirationDays, 'keep');
    }
  };

  const handleRemainderAction = async (action: RemainderAction) => {
    await executeStorageMove(moveQuantity, moveExpirationDays, action);
  };

  const executeStorageMove = async (
    quantity: number,
    expirationDays: number,
    remainderAction: RemainderAction
  ) => {
    if (!selectedItem || !currentUserId || !activeSpaceId) return;

    try {
      console.log('🚚 Executing storage move:', {
        item: selectedItem.ingredient.name,
        quantity,
        to: newStorageLocation,
        remainderAction
      });

      const newExpirationDate = calculateNewExpiration(newStorageLocation, expirationDays);
      const isPartialMove = quantity < selectedItem.quantity_display;

      if (!isPartialMove) {
        // Full move - just update the item
        await updatePantryItem(
          selectedItem.id,
          {
            storage_location: newStorageLocation,
            expiration_date: newExpirationDate
          },
          currentUserId
        );
      } else {
        // Partial move - need to handle remainder
        const remainingQuantity = selectedItem.quantity_display - quantity;

        if (remainderAction === 'keep') {
          // Create new item in new location (using space-aware function)
          await addPantryItemToSpace(
            {
              ingredient_id: selectedItem.ingredient_id,
              quantity_display: quantity,
              unit_display: selectedItem.unit_display,
              storage_location: newStorageLocation,
              purchase_date: new Date().toISOString().split('T')[0],
              expiration_date: newExpirationDate,
              is_opened: selectedItem.is_opened,
            },
            activeSpaceId,
            currentUserId
          );

          // Update old item with remaining quantity
          await updatePantryItem(
            selectedItem.id,
            { quantity_display: remainingQuantity },
            currentUserId
          );
        } else if (remainderAction === 'used' || remainderAction === 'discarded') {
          // Create new item in new location
          await addPantryItemToSpace(
            {
              ingredient_id: selectedItem.ingredient_id,
              quantity_display: quantity,
              unit_display: selectedItem.unit_display,
              storage_location: newStorageLocation,
              purchase_date: new Date().toISOString().split('T')[0],
              expiration_date: newExpirationDate,
              is_opened: selectedItem.is_opened,
            },
            activeSpaceId,
            currentUserId
          );

          // Delete old item
          await deletePantryItem(selectedItem.id, currentUserId);
          
          // TODO: Track used/discarded in analytics
        }
      }

      await loadPantryData();
      console.log('✅ Storage move complete');
    } catch (error) {
      console.error('❌ Error during storage move:', error);
      Alert.alert('Error', 'Failed to move item');
    }
  };

  // ============================================
  // HANDLERS - CATEGORY ACTIONS
  // ============================================

  const toggleFamily = (family: string) => {
    setExpandedFamilies(prev => {
      const next = new Set(prev);
      if (next.has(family)) {
        next.delete(family);
      } else {
        next.add(family);
      }
      return next;
    });
  };

  const toggleType = (family: string, type: string) => {
    const key = `${family}-${type}`;
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleAddToFamily = (family: string) => {
    console.log('➕ Adding item to family:', family);
    setSelectedCategory(family);
    setShowQuickAddModal(true);
  };

  const handleQuickAddSelect = (ingredientId: string, ingredientName: string) => {
    setSelectedIngredientId(ingredientId);
    setSelectedIngredientName(ingredientName);
    setShowQuickAddModal(false);
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setSelectedCategory(null);
    setSelectedIngredientId(null);
    setSelectedIngredientName(null);
  };

  // ============================================
  // HANDLERS - SPACE ACTIONS
  // ============================================

  const handleManageSpaces = () => {
    if (activeSpaceId) {
      navigation.navigate('SpaceSettings', { spaceId: activeSpaceId });
    }
  };

  // ============================================
  // RENDER
  // ============================================

  // Show loading while space context initializes
  if (spaceLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        {spaceLoading && (
          <Text style={styles.loadingText}>Loading your spaces...</Text>
        )}
      </View>
    );
  }

  // Show switching indicator
  if (isSwitching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Switching to {activeSpace?.name}...</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        {/* Header with Space Switcher */}
        <View style={styles.headerContainer}>
          <SpaceSwitcher
            onCreateSpace={() => setShowCreateSpaceModal(true)}
            onManageSpaces={handleManageSpaces}
          />
          <Text style={styles.header}>My Pantry</Text>
        </View>

        {/* Pending Invitations */}
        <View style={styles.invitationsContainer}>
          <PendingSpaceInvitations compact onInvitationResponded={refreshSpaces} />
        </View>

        <View style={styles.emptyState}>
          <Text style={styles.emptyStateEmoji}>🥬</Text>
          <Text style={styles.emptyStateTitle}>
            {activeSpace?.is_default ? 'Pantry is Empty' : `${activeSpace?.name} Pantry is Empty`}
          </Text>
          <Text style={styles.emptyStateText}>
            {activeSpace?.is_default 
              ? 'Start tracking your ingredients to get personalized recipe recommendations'
              : `Add ingredients to your shared ${activeSpace?.name} pantry`
            }
          </Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => setShowQuickAddModal(true)}
          >
            <Text style={styles.emptyStateButtonText}>Add First Item</Text>
          </TouchableOpacity>
        </View>

        {/* Create Space Modal */}
        <CreateSpaceModal
          visible={showCreateSpaceModal}
          onClose={() => setShowCreateSpaceModal(false)}
        />

        {/* Quick Add Modal */}
        <QuickAddModal
          visible={showQuickAddModal}
          onClose={() => {
            setShowQuickAddModal(false);
            setSelectedCategory(null);
          }}
          onSelectIngredient={handleQuickAddSelect}
          categoryFilter={selectedCategory}
        />

        {/* Add Pantry Item Modal */}
        <AddPantryItemModal
          visible={showAddModal}
          onClose={handleCloseAddModal}
          onSave={() => {
            handleCloseAddModal();
            loadPantryData();
          }}
          preSelectedCategory={selectedCategory}
          preSelectedIngredientId={selectedIngredientId}
          preSelectedIngredientName={selectedIngredientName}
          spaceId={activeSpaceId}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Space Switcher and View Toggle */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTop}>
          <SpaceSwitcher
            onCreateSpace={() => setShowCreateSpaceModal(true)}
            onManageSpaces={handleManageSpaces}
          />
        </View>
        <View style={styles.headerBottom}>
          <Text style={styles.header}>My Pantry</Text>
          
          {/* View mode dropdown */}
          <TouchableOpacity
            style={styles.viewToggle}
            onPress={() => setShowViewDropdown(!showViewDropdown)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewToggleText}>
              View: {viewMode === 'family' ? 'Family' : 'Storage'}
            </Text>
            <Text style={styles.viewToggleIcon}>{showViewDropdown ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        </View>
        
        {/* Dropdown menu */}
        {showViewDropdown && (
          <View style={styles.viewDropdownMenu}>
            <TouchableOpacity
              style={[
                styles.viewDropdownOption,
                viewMode === 'family' && styles.viewDropdownOptionActive
              ]}
              onPress={() => {
                setViewMode('family');
                setShowViewDropdown(false);
              }}
            >
              <Text style={[
                styles.viewDropdownOptionText,
                viewMode === 'family' && styles.viewDropdownOptionTextActive
              ]}>
                Ingredient Family
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.viewDropdownOption,
                viewMode === 'storage' && styles.viewDropdownOptionActive
              ]}
              onPress={() => {
                setViewMode('storage');
                setShowViewDropdown(false);
              }}
            >
              <Text style={[
                styles.viewDropdownOptionText,
                viewMode === 'storage' && styles.viewDropdownOptionTextActive
              ]}>
                Storage Location
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Pending Space Invitations */}
      <View style={styles.invitationsContainer}>
        <PendingSpaceInvitations compact onInvitationResponded={refreshSpaces} />
      </View>
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Expiring Soon Section */}
        {expiringItems.length > 0 && (
          <View style={[styles.section, styles.sectionCompact]}>
            <View style={styles.sectionCard}>
              <View style={styles.expiringHeader}>
                <Text style={styles.expiringTitle}>⚠️ Expiring Soon</Text>
                <Text style={styles.expiringCount}>{expiringItems.length} items</Text>
              </View>
              {expiringItems.map(item => (
                <PantryItemRow
                  key={item.id}
                  item={item}
                  onTapQuantity={handleTapQuantity}
                  onTapStorage={handleTapStorage}
                  onTapExpiration={handleTapExpiration}
                  onTapRecipes={handleTapRecipes}
                  onTapItem={handleTapItem}
                  isExpiring={true}
                  compact={true}
                />
              ))}
            </View>
          </View>
        )}

        {/* Family Sections or Storage Sections */}
        {viewMode === 'family' ? (
          // INGREDIENT FAMILY VIEW
          familySections.map(section => {
            const isExpanded = expandedFamilies.has(section.family);
            
            return (
              <View key={section.family} style={styles.section}>
                <View style={styles.sectionCard}>
                  <CategoryHeader
                    section={section}
                    isExpanded={isExpanded}
                    onToggle={() => toggleFamily(section.family)}
                    onAdd={() => handleAddToFamily(section.family)}
                  />

                {isExpanded && (
                  <View style={styles.itemsContainer}>
                    {section.types.map(typeSection => {
                      const typeKey = `${section.family}-${typeSection.type}`;
                      const isTypeExpanded = expandedTypes.has(typeKey);
                      const typeIcon = getTypeIcon(typeSection.type);
                      
                      return (
                        <View key={typeSection.type} style={styles.typeSection}>
                          <TouchableOpacity
                            style={[
                              styles.typeSectionHeader,
                              isTypeExpanded && styles.typeSectionHeaderExpanded
                            ]}
                            onPress={() => toggleType(section.family, typeSection.type)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.typeSectionTitle}>
                              {typeIcon} {typeSection.type} ({typeSection.items.length})
                            </Text>
                            <Text style={styles.typeCollapseIcon}>
                              {isTypeExpanded ? '▼' : '▶'}
                            </Text>
                          </TouchableOpacity>
                          
                          {isTypeExpanded && (
                            <View style={styles.typeItemsContainer}>
                              {typeSection.items.map(item => (
                                <PantryItemRow
                                  key={item.id}
                                  item={item}
                                  onTapQuantity={handleTapQuantity}
                                  onTapStorage={handleTapStorage}
                                  onTapExpiration={handleTapExpiration}
                                  onTapRecipes={handleTapRecipes}
                                  onTapItem={handleTapItem}
                                />
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
                </View>
              </View>
            );
          })
        ) : (
          // STORAGE LOCATION VIEW
          storageSections.map(section => {
            const storageKey = section.storage;
            const isExpanded = expandedFamilies.has(storageKey);
            const storageIcon = getStorageIcon(section.storage);
            
            return (
              <View key={section.storage} style={styles.section}>
                <View style={styles.sectionCard}>
                  {/* Storage Location Header */}
                  <TouchableOpacity
                    style={styles.storageHeader}
                    onPress={() => toggleFamily(storageKey)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.storageHeaderLeft}>
                      <Text style={styles.storageEmoji}>{storageIcon}</Text>
                      <Text style={styles.storageTitle}>
                        {section.storage.charAt(0).toUpperCase() + section.storage.slice(1)}
                      </Text>
                      <Text style={styles.storageCount}>({section.totalCount})</Text>
                      {section.expiringCount > 0 && (
                        <Text style={styles.expiringBadge}>
                          {section.expiringCount} expiring
                        </Text>
                      )}
                    </View>
                    <View style={styles.storageHeaderRight}>
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleAddToFamily(storageKey);
                        }}
                      >
                        <Text style={styles.addButtonText}>+</Text>
                      </TouchableOpacity>
                      <Text style={styles.collapseIcon}>
                        {isExpanded ? '▼' : '▶'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.itemsContainer}>
                      {section.families.map(familySection => {
                        const familyKey = `${storageKey}-${familySection.family}`;
                        const isFamilyExpanded = expandedTypes.has(familyKey);
                        const familyIcon = getFamilyIcon(familySection.family);
                        
                        return (
                          <View key={familySection.family} style={styles.typeSection}>
                            <TouchableOpacity
                              style={[
                                styles.typeSectionHeader,
                                isFamilyExpanded && styles.typeSectionHeaderExpanded
                              ]}
                              onPress={() => toggleType(storageKey, familySection.family)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.typeSectionTitle}>
                                {familyIcon} {familySection.family} ({familySection.items.length})
                              </Text>
                              <Text style={styles.typeCollapseIcon}>
                                {isFamilyExpanded ? '▼' : '▶'}
                              </Text>
                            </TouchableOpacity>
                            
                            {isFamilyExpanded && (
                              <View style={styles.typeItemsContainer}>
                                {familySection.items.map(item => (
                                  <PantryItemRow
                                    key={item.id}
                                    item={item}
                                    onTapQuantity={handleTapQuantity}
                                    onTapStorage={handleTapStorage}
                                    onTapExpiration={handleTapExpiration}
                                    onTapRecipes={handleTapRecipes}
                                    onTapItem={handleTapItem}
                                  />
                                ))}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* Bottom padding */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowQuickAddModal(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Pickers and Prompts */}
      <QuantityPicker
        visible={showQuantityPicker}
        currentQuantity={selectedItem?.quantity_display || 1}
        onClose={() => setShowQuantityPicker(false)}
        onSave={handleSaveQuantity}
      />

      <StoragePicker
        visible={showStoragePicker}
        currentStorage={selectedItem?.storage_location || 'fridge'}
        onClose={() => setShowStoragePicker(false)}
        onSave={handleSaveStorage}
      />

      <ExpirationPicker
        visible={showExpirationPicker}
        currentExpiration={selectedItem?.expiration_date || null}
        onClose={() => setShowExpirationPicker(false)}
        onSave={handleSaveExpiration}
      />

      {selectedItem && (
        <>
          <StorageChangePrompt
            visible={showStorageChangePrompt}
            itemName={selectedItem.ingredient.name}
            currentQuantity={selectedItem.quantity_display}
            currentUnit={selectedItem.unit_display}
            newStorage={newStorageLocation}
            onClose={() => setShowStorageChangePrompt(false)}
            onConfirm={handleConfirmStorageChange}
          />

          <RemainderPrompt
            visible={showRemainderPrompt}
            itemName={selectedItem.ingredient.name}
            remainingQuantity={selectedItem.quantity_display - moveQuantity}
            unit={selectedItem.unit_display}
            originalStorage={selectedItem.storage_location}
            onClose={() => setShowRemainderPrompt(false)}
            onSelect={handleRemainderAction}
          />
        </>
      )}

      <AddPantryItemModal
        visible={showAddModal}
        onClose={handleCloseAddModal}
        onSave={() => {
          handleCloseAddModal();
          loadPantryData();
        }}
        preSelectedCategory={selectedCategory}
        preSelectedIngredientId={selectedIngredientId}
        preSelectedIngredientName={selectedIngredientName}
        spaceId={activeSpaceId}
      />

      <QuickAddModal
        visible={showQuickAddModal}
        onClose={() => {
          setShowQuickAddModal(false);
          setSelectedCategory(null);
        }}
        onSelectIngredient={handleQuickAddSelect}
        categoryFilter={selectedCategory}
      />

      {/* Create Space Modal */}
      <CreateSpaceModal
        visible={showCreateSpaceModal}
        onClose={() => setShowCreateSpaceModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 15,
  },
  headerTop: {
    marginBottom: spacing.sm,
  },
  headerBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  invitationsContainer: {
    paddingHorizontal: 15,
    paddingTop: spacing.sm,
  },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  viewToggleText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
  },
  viewToggleIcon: {
    fontSize: 10,
    color: colors.text.tertiary,
  },
  viewDropdownMenu: {
    position: 'absolute',
    top: 135,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 180,
    zIndex: 1000,
  },
  viewDropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  viewDropdownOptionActive: {
    backgroundColor: '#f5f5f5',
  },
  viewDropdownOptionText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  viewDropdownOptionTextActive: {
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  section: {
    paddingTop: spacing.md,
    paddingBottom: 0,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionCompact: {
    paddingTop: spacing.xs,
    paddingBottom: 0,
  },
  expiringHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  expiringTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.warning,
  },
  expiringCount: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
  },
  storageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  storageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  storageEmoji: {
    fontSize: typography.sizes.xl,
  },
  storageTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
  },
  storageCount: {
    fontSize: typography.sizes.md,
    color: colors.text.tertiary,
  },
  storageHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  addButtonText: {
    fontSize: typography.sizes.md,
    color: colors.background.primary,
    fontWeight: typography.weights.bold,
  },
  collapseIcon: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
    width: 20,
    textAlign: 'center',
  },
  expiringBadge: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.warning,
    backgroundColor: '#FFF9E6',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  itemsContainer: {
    marginTop: spacing.md,
  },
  typeSection: {
    marginBottom: spacing.md,
  },
  typeSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  typeSectionHeaderExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  typeItemsContainer: {
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: borderRadius.sm,
    borderBottomRightRadius: borderRadius.sm,
    padding: spacing.sm,
    paddingTop: spacing.xs,
  },
  typeSectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeCollapseIcon: {
    fontSize: typography.sizes.xs,
    color: colors.text.tertiary,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.large,
  },
  fabText: {
    fontSize: typography.sizes.xxxl,
    color: colors.background.primary,
    fontWeight: typography.weights.bold,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyStateTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: typography.sizes.md,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  emptyStateButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  emptyStateButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.background.primary,
  },
});