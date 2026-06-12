// ⚡ IN-PROGRESS — Stats Dashboard work (2026-03-04)
// App.tsx
// Updated with Social Features: Feed, Following, and Cooking Partners
// Updated: November 19, 2025
// Updated: December 10, 2025 - Added selection mode params for recipe selection flow
// Updated: December 18, 2025 - Added SpaceProvider for shared pantries
// Updated: January 12, 2026 - Added custom font loading (Poppins, Outfit)
// Updated: March 3, 2026 - Replaced MyPostsStack with StatsStack ("You" tab)

import { useState, useEffect } from 'react';
import { Text, ActivityIndicator, View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import RecipeListScreen from './screens/RecipeListScreen';
import BookListScreen from './screens/BookListScreen';  // 11D-CP2
import RecipeDetailScreen from './screens/RecipeDetailScreen';
import WhatCanICookScreen from './screens/WhatCanICookScreen';
import MealDetailScreen from './screens/MealDetailScreen';
import MyMealsScreen from './screens/MyMealsScreen';
import { AddRecipeFromPhotoScreen } from './screens/AddRecipeFromPhotoScreen';
import { AddRecipeFromUrlScreen } from './screens/AddRecipeFromUrlScreen';
import { MissingIngredientsScreen } from './screens/MissingIngredientsScreen';
import { RecipeReviewScreen } from './screens/RecipeReviewScreen';
import CookingScreen from './screens/CookingScreen';
import StatsScreen from './screens/StatsScreen';
import DrillDownScreen from './screens/DrillDownScreen';
import ChefDetailScreen from './screens/ChefDetailScreen';
import BookDetailScreen from './screens/BookDetailScreen';
import AdminScreen from './screens/AdminScreen';
import VerificationReviewScreen from './screens/VerificationReviewScreen';
import YasChefScreen from './screens/YasChefScreen';
import CommentsScreen from './screens/CommentsScreen';
import PantryScreen from './screens/PantryScreen';
import SupplyDetailScreen from './screens/SupplyDetailScreen';
import ViewsScreen from './screens/ViewsScreen';
import ViewDetailScreen from './screens/ViewDetailScreen';
import StoresScreen from './screens/StoresScreen';
import BookViewScreen from './screens/BookViewScreen';
import SourceViewScreen from './screens/SourceViewScreen';
import AuthorViewScreen from './screens/AuthorViewScreen';
import MyPostDetailsScreen from './screens/MyPostDetailsScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';

// CP9a — onboarding spine (T1–T4) + the D-ON-10 completion gate
import WelcomeScreen from './screens/onboarding/WelcomeScreen';
import InviteCodeScreen from './screens/onboarding/InviteCodeScreen';
import OnboardingAccountScreen from './screens/onboarding/OnboardingAccountScreen';
import OnboardingProfileScreen from './screens/onboarding/OnboardingProfileScreen';
// CP9c/CP9e — router + freehand placeholder + staples host + hand-off (stamp at T12)
import OnboardingRouterScreen from './screens/onboarding/OnboardingRouterScreen';
import FreehandPlaceholderScreen from './screens/onboarding/FreehandPlaceholderScreen';
import OnboardingStaplesScreen from './screens/onboarding/OnboardingStaplesScreen';
import OnboardingHandoffScreen from './screens/onboarding/OnboardingHandoffScreen';
import { getOnboardingCompleted } from './lib/services/onboardingService';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import DietaryPreferencesScreen from './screens/DietaryPreferencesScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import LogoPlaygroundScreen from './screens/LogoPlaygroundScreen';
import StaplesPlaygroundScreen from './screens/StaplesPlaygroundScreen';  // CP3 dev wrapper
import UserPostsScreen from './screens/UserPostsScreen';

// Logo component for branding
import { Logo } from './components/branding';

// NEW: Social Feature Screens
import FeedScreen from './screens/FeedScreen';
import UserSearchScreen from './screens/UserSearchScreen';
import PendingApprovalsScreen from './screens/PendingApprovalsScreen';
import CookDetailScreen from './screens/CookDetailScreen';
import MealEventDetailScreen from './screens/MealEventDetailScreen';
import EditMediaScreen from './screens/EditMediaScreen';
import EditPostScreen from './screens/EditPostScreen';

// NEW: Space Settings Screen for shared pantries
import SpaceSettingsScreen from './screens/SpaceSettingsScreen';

// NEW: Space Provider for shared pantries
import { SpaceProvider } from './contexts/SpaceContext';
import { CookDepletionBannerProvider } from './contexts/CookDepletionBannerContext';
import CookDepletionBanner from './components/pantry/CookDepletionBanner';
import { SpawnOnOutToastProvider } from './contexts/SpawnOnOutToastContext';
import SpawnOnOutToast from './components/SpawnOnOutToast';
import { TrackOnlyOutToastProvider } from './contexts/TrackOnlyOutToastContext';
import TrackOnlyOutToast from './components/TrackOnlyOutToast';
import { AcquireLotToastProvider } from './contexts/AcquireLotToastContext';
import AcquireLotToast from './components/pantry/AcquireLotToast';

// Theme Provider for color schemes
import { ThemeProvider, useTheme } from './lib/theme/ThemeContext';

// Logo Config Provider for app-wide logo settings
import { LogoConfigProvider } from './contexts/LogoConfigContext';

// Icon components
import {
  HomeOutline,
  HomeFilled,
  RecipesOutline,
  RecipesFilled,
  CalendarOutline,
  CalendarFilled,
  ChefHat2,
  ChefHat2Inverse,
  PantryOutline,
  PantryFilled,
  GroceryOutline,
  GroceryFilled,
} from './components/icons';

import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { ProcessedIngredient } from './lib/types/recipeExtraction';
import { getPendingApprovalsCount } from './lib/services/postParticipantsService';

// Interface for post photos
export interface PostPhoto {
  url: string;
  caption?: string;
  order: number;
  is_highlight?: boolean;
}

// Navigation type definitions
export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

// CP9a — pre-session onboarding spine (T1 Welcome → T2 Invite → T3 Account; Login reachable from T1)
export type OnboardingStackParamList = {
  Welcome: undefined;
  InviteCode: undefined;
  Account: { inviteCode: string };
  Login: undefined;
};

// CP9c/CP9e — post-session onboarding spine (T4 → T6 → [T10] → T11 → T12).
// CP9d inserts the recipe path (T7–T9) between Router and Staples when it lands.
export type PostAuthOnboardingParamList = {
  ProfileSetup: undefined;
  Router: undefined;
  Freehand: undefined;
  Staples: undefined;
  Handoff: undefined;
};

// UPDATED: RecipesStackParamList with selection mode support
export type RecipesStackParamList = {
  RecipeList: {
    // Selection mode params (optional)
    selectionMode?: boolean;
    returnToMeals?: boolean;  // Flag to indicate return to MyMealsScreen
    mealFormData?: {          // Form data to restore when returning
      title: string;
      mealType: string;
      mealTime: string;
      location?: string;
      description?: string;
    };
    // Initial filter params from stats drill-downs
    initialBrowseMode?: 'all' | 'cook_again' | 'try_new';
    initialCuisine?: string;
    initialCookingConcept?: string;
    initialDietaryFlag?: string;
    initialChefId?: string;
    initialBookId?: string;
    // CP6d-SupplyDetail (Q-NEW-26): pre-applies a hero-ingredient filter from
    // the SupplyDetail "Find recipes" CTA.
    initialIngredient?: string;
    sortBy?: string;
  } | undefined;
  RecipeDetail: {
    recipe: any;
    planItemId?: string;   // NEW: Pass-through for meal plan
    mealId?: string;       // NEW: Pass-through for meal plan
    mealTitle?: string;    // NEW: Pass-through for meal plan
  };
  WhatCanICook: undefined;  // 8D-CP4: ready-to-cook recipe subset
  Cooking: {
    recipe: any;  // Changed from recipeId to full recipe object
    planItemId?: string;   // NEW: For meal plan integration
    mealId?: string;       // NEW: For meal plan integration
    mealTitle?: string;    // NEW: For success message
  };
  // 11D-CP2: Books index reached from Mode A "Browse by → Books".
  BookList: undefined;
  // 11D-CP2: BookDetail registered here so the BookList card tap stays
  // within RecipesStack. Same component is also registered in StatsStack
  // for the stats drill-down path; React Navigation handles that fine.
  BookDetail: { bookId: string };
  // 11D-CP3a: optional `sectionId` is set by BookDetail's "See all →" links
  // so CP3b can preset BookView's sort (mostCooked → most_cooked, etc.).
  BookView: { bookId: string; sectionId?: 'mostCooked' | 'recentlyCooked' | 'friendsFavorites' | 'bookmarked' };
  SourceView: { domain: string };
  AuthorView: { chefName: string };
  AddRecipeFromPhoto: { userId: string; source: 'camera' | 'gallery' };
  AddRecipeFromUrl: { userId: string };
  MissingIngredients: {
    missingIngredients: ProcessedIngredient[];
    allIngredients: ProcessedIngredient[];
    onComplete: (updatedIngredients: ProcessedIngredient[]) => void;
  };
  RecipeReview: {
    processedRecipe: any;
    bookId?: string;
    userId: string;
  };
};

// NEW: Feed Stack with social features
export type FeedStackParamList = {
  FeedMain: undefined;
  PendingApprovals: undefined;
  PostDetail: { postId: string };
  YasChefsList: { postId: string; postTitle: string };
  CommentsList: { postId: string };
  UserSearch: undefined;
  Profile: undefined;
  Settings: undefined;
  DietaryPreferences: undefined;  // 10F — child of Settings → Preferences
  EditProfile: undefined;
  Admin: undefined;  // dev-only screen, reachable from Settings → Developer
  VerificationReview: undefined;  // CP6a-2 — admin-gated review portal; Settings → Developer (admins only)
  LogoPlayground: undefined;  // dev-only screen, reachable from Settings → Developer
  StaplesPlayground: undefined;  // CP3 dev wrapper — Settings → Developer → Staples Playground
  RecipeDetail: { recipe: any; planItemId?: string; mealId?: string; mealTitle?: string };
  AuthorView: { chefName: string };
  /** Phase 7I Checkpoint 5: cook post detail screen (L6). The `photoIndex`
   *  param is optional; when present, the hero carousel centers on that
   *  index at mount. Shape is stable/public — D49 renderer and future
   *  callers depend on it (see PHASE_7I_MASTER_PLAN.md Sub-section 5.5). */
  CookDetail: { postId: string; photoIndex?: number };
  /** Phase 7I Checkpoint 6 / L7: meal event detail screen. Reached from
   *  L4 meal event preheads and L5 nested-meal-event group headers.
   *  Replaces the legacy `MealDetail` route for meal-event navigation. */
  MealEventDetail: { mealEventId: string };
  /** Phase 7I Checkpoint 5 / 5.3: Add photos menu item on CookDetailScreen
   *  routes here. Shape mirrors the legacy MyPostsStackParamList entry. */
  EditMedia: { postId: string; existingPhotos: PostPhoto[] };
  EditPost: { postId: string };
};

// UPDATED: MealsStackParamList with recipe selection return params
export type MealsStackParamList = {
  MyMealsList: {
    // Return from recipe selection
    selectedRecipe?: {
      id: string;
      title: string;
      image_url?: string;
    };
    returnedFormData?: {
      title: string;
      mealType: string;
      mealTime: string;
      location?: string;
      description?: string;
    };
  } | undefined;
  MealDetail: { mealId: string; currentUserId: string };
};

// Legacy type — kept for screens that still import it (YasChefScreen, CommentsScreen, etc.)
export type MyPostsStackParamList = {
  MyPostsList: undefined;
  YasChefsList: { postId: string; postTitle: string };
  CommentsList: { postId: string };
  EditMedia: { postId: string; existingPhotos: PostPhoto[] };
  MyPostDetails: { postId: string };
  MealDetail: { mealId: string; currentUserId: string };
};

export type StatsStackParamList = {
  StatsHome: undefined;
  DrillDown: {
    type: 'cuisine' | 'concept' | 'method' | 'ingredient';
    value: string;
    label: string;
  };
  ChefDetail: { chefId: string };
  BookDetail: { bookId: string };
  RecipeDetail: {
    recipe: any;
    planItemId?: string;
    mealId?: string;
    mealTitle?: string;
  };
  MyPostDetails: { postId: string };
  YasChefsList: { postId: string; postTitle: string };
  UserPosts: { userId: string; displayName: string };
  Profile: undefined;
  Settings: undefined;
  DietaryPreferences: undefined;  // 10F — child of Settings → Preferences
  EditProfile: undefined;
  Admin: undefined;  // dev-only screen, reachable from Settings → Developer
  VerificationReview: undefined;  // CP6a-2 — admin-gated review portal; Settings → Developer (admins only)
  LogoPlayground: undefined;  // dev-only screen, reachable from Settings → Developer
  StaplesPlayground: undefined;  // CP3 dev wrapper — Settings → Developer → Staples Playground
  /** Phase 7H: My Posts cards tap through to the 7I L6 detail screen.
   *  Same param shape as the FeedStack's CookDetail route. */
  CookDetail: { postId: string; photoIndex?: number };
  EditMedia: { postId: string; existingPhotos: PostPhoto[] };
  EditPost: { postId: string };
};

export type ViewsStackParamList = {
  Views: undefined;
  ViewDetail: { viewId: string };
};

// Legacy alias kept for any pre-CP6c imports that haven't been updated yet.
// Active code should use ViewsStackParamList; this re-export prevents stale
// references from breaking the build during the rename transition.
export type GroceryStackParamList = ViewsStackParamList;

// NEW: Pantry Stack with Space Settings
export type PantryStackParamList = {
  Pantry: undefined;
  SpaceSettings: { spaceId: string };
  SupplyDetail: { supplyId: string };
};

export type RootTabParamList = {
  FeedStack: undefined;
  RecipesStack: undefined;
  MealsStack: undefined;
  StatsStack: undefined;
  PantryStack: undefined;
  GroceryStack: undefined;
  Stores: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const FeedStack = createNativeStackNavigator<FeedStackParamList>(); // NEW
const RecipesStack = createNativeStackNavigator<RecipesStackParamList>();
const StatsStackNav = createNativeStackNavigator<StatsStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();
const MealsStack = createNativeStackNavigator<MealsStackParamList>();

// CP9a — pre-session entry navigator (replaces AuthStackNavigator as the
// no-session experience; AuthStackNavigator is kept below, unreferenced, in
// case the invite gate ever needs a fast bypass).
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

function OnboardingEntryNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="Welcome" component={WelcomeScreen} />
      <OnboardingStack.Screen name="InviteCode" component={InviteCodeScreen} />
      <OnboardingStack.Screen name="Account" component={OnboardingAccountScreen} />
      <OnboardingStack.Screen name="Login">
        {(props: any) => (
          <LoginScreen
            onLoginSuccess={() => {}}
            onNavigateToSignup={() => props.navigation.navigate('InviteCode')}
          />
        )}
      </OnboardingStack.Screen>
    </OnboardingStack.Navigator>
  );
}

// CP9c/CP9e — post-session onboarding navigator. Wrapped in SpaceProvider by
// the App gate: the T11 host needs SpaceContext for the D-ON-16 pending-
// invitation branch, and the StaplesChecklist's space-ensure rides it too.
const PostAuthStack = createNativeStackNavigator<PostAuthOnboardingParamList>();

function PostAuthOnboardingNavigator({
  userId,
  onComplete,
}: {
  userId: string;
  onComplete: () => void;
}) {
  return (
    <PostAuthStack.Navigator screenOptions={{ headerShown: false }}>
      <PostAuthStack.Screen name="ProfileSetup">
        {(props: any) => (
          <OnboardingProfileScreen onContinue={() => props.navigation.navigate('Router')} />
        )}
      </PostAuthStack.Screen>
      <PostAuthStack.Screen name="Router" component={OnboardingRouterScreen} />
      <PostAuthStack.Screen name="Freehand" component={FreehandPlaceholderScreen} />
      <PostAuthStack.Screen name="Staples">
        {(props: any) => <OnboardingStaplesScreen {...props} userId={userId} />}
      </PostAuthStack.Screen>
      <PostAuthStack.Screen name="Handoff">
        {() => <OnboardingHandoffScreen onComplete={onComplete} />}
      </PostAuthStack.Screen>
    </PostAuthStack.Navigator>
  );
}

// Auth Stack Navigator (Login/Signup)
function AuthStackNavigator() {
  const [showSignup, setShowSignup] = useState(false);

  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      {!showSignup ? (
        <AuthStack.Screen name="Login">
          {(props: any) => (
            <LoginScreen 
              {...props}
              onLoginSuccess={() => {}}
              onNavigateToSignup={() => setShowSignup(true)}
            />
          )}
        </AuthStack.Screen>
      ) : (
        <AuthStack.Screen name="Signup">
          {(props: any) => (
            <SignupScreen 
              {...props}
              onSignupSuccess={() => setShowSignup(false)}
              onNavigateToLogin={() => setShowSignup(false)}
            />
          )}
        </AuthStack.Screen>
      )}
    </AuthStack.Navigator>
  );
}

// NEW: Feed Stack Navigator with notification badge
function FeedStackNavigator() {
  const [pendingCount, setPendingCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadPendingCount();
      
      // Poll for updates every 30 seconds
      const interval = setInterval(loadPendingCount, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUserId]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const loadPendingCount = async () => {
    if (currentUserId) {
      const count = await getPendingApprovalsCount(currentUserId);
      setPendingCount(count);
    }
  };

  return (
    <FeedStack.Navigator
      screenOptions={{
        headerShown: false,
        headerTintColor: '#0F6E56',
      }}
    >
      <FeedStack.Screen
        name="FeedMain"
        component={FeedScreen}
        initialParams={{ pendingCount }}
      />
      <FeedStack.Screen
        name="PendingApprovals"
        component={PendingApprovalsScreen}
        options={{
          headerShown: true,
          title: 'Cooking Invitations',
        }}
      />
      <FeedStack.Screen
        name="YasChefsList"
        component={YasChefScreen}
        options={{
          headerShown: true,
          title: 'Yas Chefs',
        }}
      />
      <FeedStack.Screen
        name="CommentsList"
        component={CommentsScreen}
        options={{
          headerShown: true,
          title: 'Comments',
        }}
      />
      <FeedStack.Screen
        name="UserSearch"
        component={UserSearchScreen}
        options={{
          headerShown: true,
          title: 'Find People',
        }}
      />
      <FeedStack.Screen
        name="Profile"
        component={ProfileScreen}
      />
      <FeedStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: true,
          title: 'Settings',
        }}
      />
      {/* 10F — Dietary preferences (child of Settings); owns its own header */}
      <FeedStack.Screen
        name="DietaryPreferences"
        component={DietaryPreferencesScreen}
        options={{ headerShown: false }}
      />
      <FeedStack.Screen
        name="Admin"
        component={AdminScreen}
        options={{
          headerShown: true,
          title: 'Admin Tools',
        }}
      />
      <FeedStack.Screen
        name="VerificationReview"
        component={VerificationReviewScreen}
        options={{
          headerShown: true,
          title: 'Verification Review',
        }}
      />
      <FeedStack.Screen
        name="LogoPlayground"
        component={LogoPlaygroundScreen}
        options={{
          headerShown: true,
          title: 'Logo Playground',
        }}
      />
      <FeedStack.Screen
        name="StaplesPlayground"
        component={StaplesPlaygroundScreen}
        options={{
          headerShown: true,
          title: 'Staples Playground',
        }}
      />
      <FeedStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          headerShown: true,
          title: 'Edit Profile',
        }}
      />
      <FeedStack.Screen
        name="RecipeDetail"
        component={RecipeDetailScreen}
        options={{ headerShown: false }}
      />
      <FeedStack.Screen
        name="AuthorView"
        component={AuthorViewScreen}
        options={{ headerShown: true, title: 'Chef' }}
      />
      <FeedStack.Screen
        name="MealDetail"
        component={MealDetailScreen}
        options={{ headerShown: true, title: 'Meal' }}
      />
      {/* Phase 7I Checkpoint 5: Cook post detail screen (L6). Reached from
          feed card taps, comment list return nav, and future D49 renderer
          dish-row taps. CookDetailScreen owns its own header, so headerShown=false. */}
      <FeedStack.Screen
        name="CookDetail"
        component={CookDetailScreen}
        options={{ headerShown: false }}
      />
      {/* Phase 7I Checkpoint 6: MealEventDetailScreen (L7). Owns its own
          header, so headerShown=false. Replaces the legacy MealDetail route
          for meal-event navigation; MealDetail route stays registered
          because other screens (MyMeals, etc.) still reference it.
          Checkpoint 7 removes it. */}
      <FeedStack.Screen
        name="MealEventDetail"
        component={MealEventDetailScreen}
        options={{ headerShown: false }}
      />
      {/* Phase 7I Checkpoint 5 / 5.3: Edit photos destination reached from
          CookDetailScreen's overflow menu "Add photos" item. EditMediaScreen
          exists and is wired; prior to Checkpoint 5 it was imported by
          MyPostDetailsScreen / MyPostsScreen but not registered in any
          navigator, so existing calls were orphaned. Registering here makes
          it reachable from the feed stack. */}
      <FeedStack.Screen
        name="EditMedia"
        component={EditMediaScreen}
        options={{ headerShown: true, title: 'Edit Photos' }}
      />
      <FeedStack.Screen
        name="EditPost"
        component={EditPostScreen}
        options={{ headerShown: false }}
      />
    </FeedStack.Navigator>
  );
}

// Recipes Stack Navigator
function RecipesStackNavigator() {
  return (
    <RecipesStack.Navigator
      screenOptions={{
        headerShown: false,
        headerTintColor: '#0F6E56',
      }}
    >
      <RecipesStack.Screen name="RecipeList" component={RecipeListScreen} />
      {/* 11D-CP2 — Books index. Own header (no native chrome). */}
      <RecipesStack.Screen
        name="BookList"
        component={BookListScreen}
        options={{ headerShown: false }}
      />
      {/* 11D-CP2 — BookDetail reachable from BookList card taps. CP3 redesigns
          the screen body; route registration here is just so navigation lands. */}
      <RecipesStack.Screen
        name="BookDetail"
        component={BookDetailScreen}
        options={{ headerShown: true, title: 'Cookbook' }}
      />
      <RecipesStack.Screen
        name="RecipeDetail"
        component={RecipeDetailScreen}
        options={{ headerShown: false }}
      />
      <RecipesStack.Screen
        name="WhatCanICook"
        component={WhatCanICookScreen}
        options={{ headerShown: true, title: 'Ready to cook' }}
      />
      <RecipesStack.Screen 
        name="Cooking" 
        component={CookingScreen}
        options={{
          headerShown: true,
          title: 'Cooking Mode',
        }}
      />
      <RecipesStack.Screen
        name="BookView"
        component={BookViewScreen}
        options={{
          headerShown: true,
          title: 'Cookbook',
        }}
      />
      <RecipesStack.Screen
        name="SourceView"
        component={SourceViewScreen}
        options={{
          headerShown: true,
          title: 'Source',
        }}
      />
      <RecipesStack.Screen 
        name="AuthorView" 
        component={AuthorViewScreen}
        options={{
          headerShown: true,
          title: 'Chef',
        }}
      />
      <RecipesStack.Screen 
        name="AddRecipeFromPhoto" 
        component={AddRecipeFromPhotoScreen}
        options={{
          headerShown: true,
          title: 'Add Recipe',
        }}
      />
      <RecipesStack.Screen 
        name="AddRecipeFromUrl" 
        component={AddRecipeFromUrlScreen}
        options={{
          headerShown: true,
          title: 'Add from URL',
        }}
      />
      <RecipesStack.Screen 
        name="MissingIngredients" 
        component={MissingIngredientsScreen}
        options={{
          headerShown: true,
          title: 'Missing Ingredients',
        }}
      />
      <RecipesStack.Screen 
        name="RecipeReview" 
        component={RecipeReviewScreen}
        options={{
          headerShown: true,
          title: 'Review Recipe',
        }}
      />
    </RecipesStack.Navigator>
  );
}

// Placeholder screens for future Stats drill-down routes

// Stats Stack Navigator (replaces MyPostsStack)
function StatsStackNavigator() {
  return (
    <StatsStackNav.Navigator
      screenOptions={{
        headerShown: false,
        headerTintColor: '#0F6E56',
      }}
    >
      <StatsStackNav.Screen name="StatsHome" component={StatsScreen} />
      <StatsStackNav.Screen
        name="DrillDown"
        component={DrillDownScreen}
        options={{ headerShown: true, title: 'Details' }}
      />
      <StatsStackNav.Screen
        name="ChefDetail"
        component={ChefDetailScreen}
        options={{ headerShown: true, title: 'Chef' }}
      />
      <StatsStackNav.Screen
        name="BookDetail"
        component={BookDetailScreen}
        options={{ headerShown: true, title: 'Cookbook' }}
      />
      <StatsStackNav.Screen
        name="RecipeDetail"
        component={RecipeDetailScreen}
        options={{ headerShown: false }}
      />
      <StatsStackNav.Screen
        name="MyPostDetails"
        component={MyPostDetailsScreen}
        options={{ headerShown: true, title: 'Post' }}
      />
      <StatsStackNav.Screen
        name="YasChefsList"
        component={YasChefScreen}
        options={{ headerShown: true, title: 'Yas Chefs' }}
      />
      <StatsStackNav.Screen
        name="UserPosts"
        component={UserPostsScreen}
        options={{ headerShown: true, title: 'Posts' }}
      />
      <StatsStackNav.Screen
        name="Profile"
        component={ProfileScreen}
      />
      <StatsStackNav.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: true, title: 'Settings' }}
      />
      {/* 10F — Dietary preferences (child of Settings); owns its own header */}
      <StatsStackNav.Screen
        name="DietaryPreferences"
        component={DietaryPreferencesScreen}
        options={{ headerShown: false }}
      />
      <StatsStackNav.Screen
        name="Admin"
        component={AdminScreen}
        options={{ headerShown: true, title: 'Admin Tools' }}
      />
      <StatsStackNav.Screen
        name="VerificationReview"
        component={VerificationReviewScreen}
        options={{ headerShown: true, title: 'Verification Review' }}
      />
      <StatsStackNav.Screen
        name="LogoPlayground"
        component={LogoPlaygroundScreen}
        options={{ headerShown: true, title: 'Logo Playground' }}
      />
      <StatsStackNav.Screen
        name="StaplesPlayground"
        component={StaplesPlaygroundScreen}
        options={{ headerShown: true, title: 'Staples Playground' }}
      />
      <StatsStackNav.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ headerShown: true, title: 'Edit Profile' }}
      />
      {/* Phase 7H: My Posts cards route here. Same screen as the FeedStack
          CookDetail registration; owns its own header. */}
      <StatsStackNav.Screen
        name="CookDetail"
        component={CookDetailScreen}
        options={{ headerShown: false }}
      />
      <StatsStackNav.Screen
        name="EditMedia"
        component={EditMediaScreen}
        options={{ headerShown: true, title: 'Edit Photos' }}
      />
      <StatsStackNav.Screen
        name="EditPost"
        component={EditPostScreen}
        options={{ headerShown: false }}
      />
    </StatsStackNav.Navigator>
  );
}

// Meals Stack Navigator
function MealsStackNavigator() {
  return (
    <MealsStack.Navigator
      screenOptions={{
        headerShown: false,
        headerTintColor: '#0F6E56',
      }}
    >
      <MealsStack.Screen 
        name="MyMealsList" 
        component={MyMealsScreen}
      />
      <MealsStack.Screen 
        name="MealDetail" 
        component={MealDetailScreen}
        options={{
          headerShown: true,
          title: 'Meal',
        }}
      />
    </MealsStack.Navigator>
  );
}

// UPDATED: Pantry Stack Navigator with SpaceSettings
const PantryStackNav = createNativeStackNavigator<PantryStackParamList>();

function PantryStackNavigator() {
  return (
    <PantryStackNav.Navigator
      screenOptions={{
        headerShown: false,
        headerTintColor: '#0F6E56',
      }}
    >
      <PantryStackNav.Screen name="Pantry" component={PantryScreen} />
      <PantryStackNav.Screen
        name="SpaceSettings"
        component={SpaceSettingsScreen}
        options={{
          headerShown: false, // SpaceSettingsScreen has its own header
        }}
      />
      <PantryStackNav.Screen
        name="SupplyDetail"
        component={SupplyDetailScreen}
        options={{
          headerShown: false, // SupplyDetailScreen has its own header
        }}
      />
    </PantryStackNav.Navigator>
  );
}

// Views (formerly Grocery) Stack Navigator
const ViewsStack = createNativeStackNavigator<ViewsStackParamList>();

function GroceryStackNavigator() {
  return (
    <ViewsStack.Navigator
      screenOptions={{
        headerShown: false,
        headerTintColor: '#0F6E56',
      }}
    >
      <ViewsStack.Screen name="Views" component={ViewsScreen} />
      <ViewsStack.Screen name="ViewDetail" component={ViewDetailScreen} />
    </ViewsStack.Navigator>
  );
}

function MainTabNavigator() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background.card,
          borderTopWidth: 1,
          borderTopColor: colors.border.medium,
          height: 88,
          paddingBottom: 34,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      {/* Home Tab - Feed with posts from people you follow */}
      <Tab.Screen
        name="FeedStack"
        component={FeedStackNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }: { color: string; focused: boolean }) => {
            const Icon = focused ? HomeFilled : HomeOutline;
            const iconColor = focused ? colors.primary : colors.text.tertiary;
            return <Icon size={24} color={iconColor} />;
          },
        }}
      />

      {/* Recipes Tab */}
      <Tab.Screen
        name="RecipesStack"
        component={RecipesStackNavigator}
        options={{
          tabBarLabel: 'Recipes',
          tabBarIcon: ({ focused }: { color: string; focused: boolean }) => {
            const Icon = focused ? RecipesFilled : RecipesOutline;
            const iconColor = focused ? colors.primary : colors.text.tertiary;
            return <Icon size={24} color={iconColor} />;
          },
        }}
      />

      {/* Meals Tab */}
      <Tab.Screen
        name="MealsStack"
        component={MealsStackNavigator}
        options={{
          tabBarLabel: 'Meals',
          tabBarIcon: ({ focused }: { color: string; focused: boolean }) => {
            const Icon = focused ? CalendarFilled : CalendarOutline;
            const iconColor = focused ? colors.primary : colors.text.tertiary;
            return <Icon size={24} color={iconColor} />;
          },
        }}
      />

      {/* Pantry Tab */}
      <Tab.Screen
        name="PantryStack"
        component={PantryStackNavigator}
        options={{
          tabBarLabel: 'Pantry',
          tabBarIcon: ({ focused }: { color: string; focused: boolean }) => {
            const Icon = focused ? PantryFilled : PantryOutline;
            const iconColor = focused ? colors.primary : colors.text.tertiary;
            return <Icon size={24} color={iconColor} />;
          },
        }}
      />

      {/* Grocery Tab */}
      <Tab.Screen
        name="GroceryStack"
        component={GroceryStackNavigator}
        options={{
          tabBarLabel: 'Grocery',
          tabBarIcon: ({ focused }: { color: string; focused: boolean }) => {
            const Icon = focused ? GroceryFilled : GroceryOutline;
            const iconColor = focused ? colors.primary : colors.text.tertiary;
            return <Icon size={24} color={iconColor} />;
          },
        }}
      />

      {/* You (Stats) Tab */}
      <Tab.Screen
        name="StatsStack"
        component={StatsStackNavigator}
        options={{
          tabBarLabel: 'You',
          tabBarIcon: ({ focused }: { color: string; focused: boolean }) => {
            const iconColor = focused ? colors.primary : colors.text.tertiary;
            if (focused) {
              return (
                <Image
                  source={require('./assets/icons/chefhat2inverse.png')}
                  style={{
                    width: 24,
                    height: 24,
                    tintColor: iconColor,
                  }}
                />
              );
            } else {
              return <ChefHat2 size={24} color={iconColor} />;
            }
          },
        }}
      />
    </Tab.Navigator>
  );
}

// Main App Component with Auth
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // CP9a (D-ON-10): null = unknown/loading; false = session but onboarding
  // incomplete → onboarding stack; true = main tabs. Binary, no mid-spine resume.
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setOnboardingCompleted(null);
      return;
    }
    let active = true;
    getOnboardingCompleted(userId)
      .then((completed) => {
        if (active) setOnboardingCompleted(completed);
      })
      .catch((error) => {
        // Fail OPEN to the tabs: a transient read error must not lock an
        // existing user into onboarding (new users just see tabs once; the
        // empty states catch them).
        console.error('❌ onboarding gate read failed — failing open to tabs:', error);
        if (active) setOnboardingCompleted(true);
      });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  // Load custom fonts
  // NOTE: Font files are in subdirectories:
  // - Poppins fonts in assets/fonts/Poppins/
  // - Outfit fonts in assets/fonts/Outfit/static/
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('./assets/fonts/Poppins/Poppins-Regular.ttf'),
    'Poppins-Medium': require('./assets/fonts/Poppins/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('./assets/fonts/Poppins/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('./assets/fonts/Poppins/Poppins-Bold.ttf'),
    'Outfit-Regular': require('./assets/fonts/Outfit/static/Outfit-Regular.ttf'),
    'Outfit-Medium': require('./assets/fonts/Outfit/static/Outfit-Medium.ttf'),
    'Outfit-SemiBold': require('./assets/fonts/Outfit/static/Outfit-SemiBold.ttf'),
    'Outfit-Bold': require('./assets/fonts/Outfit/static/Outfit-Bold.ttf'),
  });

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      console.log('Initial session:', session ? 'Logged in' : 'Not logged in');
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      console.log('Auth state changed:', session ? 'Logged in' : 'Not logged in');
    });

    return () => subscription.unsubscribe();
  }, []);

  // UPDATED: Wrap entire app with ThemeProvider and LogoConfigProvider
  return (
    <ThemeProvider initialScheme="tealMintSlate">
      <LogoConfigProvider>
        {(!fontsLoaded || loading) ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
            <Logo size="large" />
            <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 24 }} />
            <Text style={{ marginTop: 16, color: '#666', fontSize: 14 }}>Loading...</Text>
          </View>
        ) : (
          <NavigationContainer>
            {/* CP9a gate (D-ON-10): no session → onboarding entry (T1–T3 + Login);
                session ∧ ¬completed → post-auth onboarding (T4 for now);
                session ∧ completed → main tabs. */}
            {!session ? (
              <OnboardingEntryNavigator />
            ) : onboardingCompleted === null ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
                <Logo size="large" />
                <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 24 }} />
              </View>
            ) : onboardingCompleted === false ? (
              <SpaceProvider>
                <PostAuthOnboardingNavigator
                  userId={session.user.id}
                  onComplete={() => setOnboardingCompleted(true)}
                />
              </SpaceProvider>
            ) : (
              <SpaceProvider>
                <CookDepletionBannerProvider>
                  <SpawnOnOutToastProvider>
                    <TrackOnlyOutToastProvider>
                      <AcquireLotToastProvider>
                        <MainTabNavigator />
                        <CookDepletionBanner />
                        <SpawnOnOutToast />
                        <TrackOnlyOutToast />
                        <AcquireLotToast />
                      </AcquireLotToastProvider>
                    </TrackOnlyOutToastProvider>
                  </SpawnOnOutToastProvider>
                </CookDepletionBannerProvider>
              </SpaceProvider>
            )}
          </NavigationContainer>
        )}
      </LogoConfigProvider>
    </ThemeProvider>
  );
}

// Styles for notification badge
const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});