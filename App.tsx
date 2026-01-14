// App.tsx
// Updated with Social Features: Feed, Following, and Cooking Partners
// Updated: November 19, 2025
// Updated: December 10, 2025 - Added selection mode params for recipe selection flow
// Updated: December 18, 2025 - Added SpaceProvider for shared pantries
// Updated: January 12, 2026 - Added custom font loading (Poppins, Outfit)

import { useState, useEffect } from 'react';
import { Text, ActivityIndicator, View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import RecipeListScreen from './screens/RecipeListScreen';
import RecipeDetailScreen from './screens/RecipeDetailScreen';
import MealDetailScreen from './screens/MealDetailScreen';
import MyMealsScreen from './screens/MyMealsScreen';
import { AddRecipeFromPhotoScreen } from './screens/AddRecipeFromPhotoScreen';
import { AddRecipeFromUrlScreen } from './screens/AddRecipeFromUrlScreen';
import { MissingIngredientsScreen } from './screens/MissingIngredientsScreen';
import { RecipeReviewScreen } from './screens/RecipeReviewScreen';
import CookingScreen from './screens/CookingScreen';
import MyPostsScreen from './screens/MyPostsScreen';
import AdminScreen from './screens/AdminScreen';
import YasChefScreen from './screens/YasChefScreen';
import CommentsScreen from './screens/CommentsScreen';
import PantryScreen from './screens/PantryScreen';
import GroceryListsScreen from './screens/GroceryListsScreen';
import GroceryListDetailScreen from './screens/GroceryListDetailScreen';
import StoresScreen from './screens/StoresScreen';
import BookViewScreen from './screens/BookViewScreen';
import AuthorViewScreen from './screens/AuthorViewScreen';
import EditMediaScreen from './screens/EditMediaScreen';
import MyPostDetailsScreen from './screens/MyPostDetailsScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import LogoPlaygroundScreen from './screens/LogoPlaygroundScreen';

// Logo component for branding
import { Logo } from './components/branding';

// NEW: Social Feature Screens
import FeedScreen from './screens/FeedScreen';
import UserSearchScreen from './screens/UserSearchScreen';
import PendingApprovalsScreen from './screens/PendingApprovalsScreen';

// NEW: Space Settings Screen for shared pantries
import SpaceSettingsScreen from './screens/SpaceSettingsScreen';

// NEW: Space Provider for shared pantries
import { SpaceProvider } from './contexts/SpaceContext';

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
  } | undefined;
  RecipeDetail: { 
    recipe: any;
    planItemId?: string;   // NEW: Pass-through for meal plan
    mealId?: string;       // NEW: Pass-through for meal plan
    mealTitle?: string;    // NEW: Pass-through for meal plan
  };
  Cooking: { 
    recipe: any;  // Changed from recipeId to full recipe object
    planItemId?: string;   // NEW: For meal plan integration
    mealId?: string;       // NEW: For meal plan integration
    mealTitle?: string;    // NEW: For success message
  };
  BookView: { bookId: string };
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
  EditProfile: undefined;
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

export type MyPostsStackParamList = {
  MyPostsList: undefined;
  YasChefsList: { postId: string; postTitle: string };
  CommentsList: { postId: string };
  EditMedia: { postId: string; existingPhotos: PostPhoto[] };
  MyPostDetails: { postId: string };
  MealDetail: { mealId: string; currentUserId: string };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Settings: undefined;
  EditProfile: undefined;
  LogoPlayground: undefined;
};

export type GroceryStackParamList = {
  GroceryLists: undefined;
  GroceryListDetail: { listId: string; listName: string };
};

// NEW: Pantry Stack with Space Settings
export type PantryStackParamList = {
  Pantry: undefined;
  SpaceSettings: { spaceId: string };
};

export type RootTabParamList = {
  FeedStack: undefined;
  RecipesStack: undefined;
  MealsStack: undefined;
  MyPostsStack: undefined;
  PantryStack: undefined;
  GroceryStack: undefined;
  Stores: undefined;
  Admin: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const FeedStack = createNativeStackNavigator<FeedStackParamList>(); // NEW
const RecipesStack = createNativeStackNavigator<RecipesStackParamList>();
const MyPostsStack = createNativeStackNavigator<MyPostsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();
const MealsStack = createNativeStackNavigator<MealsStackParamList>();

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
      <FeedStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          headerShown: true,
          title: 'Edit Profile',
        }}
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
      }}
    >
      <RecipesStack.Screen name="RecipeList" component={RecipeListScreen} />
      <RecipesStack.Screen 
        name="RecipeDetail" 
        component={RecipeDetailScreen}
        options={{
          headerShown: true,
          title: 'Recipe',
        }}
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

// My Posts Stack Navigator
function MyPostsStackNavigator() {
  return (
    <MyPostsStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <MyPostsStack.Screen name="MyPostsList" component={MyPostsScreen} />
      <MyPostsStack.Screen 
        name="YasChefsList" 
        component={YasChefScreen}
        options={{
          headerShown: true,
          title: 'Yas Chefs',
        }}
      />
      <MyPostsStack.Screen 
        name="CommentsList" 
        component={CommentsScreen}
        options={{
          headerShown: true,
          title: 'Comments',
        }}
      />
      <MyPostsStack.Screen 
        name="EditMedia" 
        component={EditMediaScreen}
        options={{
          headerShown: true,
          title: 'Edit Photos',
        }}
      />
      <MyPostsStack.Screen 
        name="MyPostDetails" 
        component={MyPostDetailsScreen}
        options={{
          headerShown: true,
          title: 'Post Details',
        }}
      />
      <MyPostsStack.Screen 
        name="MealDetail" 
        component={MealDetailScreen}
        options={{
          headerShown: true,
          title: 'Meal',
        }}
      />
    </MyPostsStack.Navigator>
  );
}

// Meals Stack Navigator
function MealsStackNavigator() {
  return (
    <MealsStack.Navigator
      screenOptions={{
        headerShown: false,
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

// Profile Stack Navigator
function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <ProfileStack.Screen
        name="ProfileHome"
        component={ProfileScreen}
      />
      <ProfileStack.Screen
        name="Settings"
        component={SettingsScreen}
      />
      <ProfileStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
      />
      <ProfileStack.Screen
        name="LogoPlayground"
        component={LogoPlaygroundScreen}
        options={{
          headerShown: true,
          title: 'Logo Playground',
        }}
      />
    </ProfileStack.Navigator>
  );
}

// UPDATED: Pantry Stack Navigator with SpaceSettings
const PantryStackNav = createNativeStackNavigator<PantryStackParamList>();

function PantryStackNavigator() {
  return (
    <PantryStackNav.Navigator
      screenOptions={{
        headerShown: false,
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
    </PantryStackNav.Navigator>
  );
}

// Grocery Stack Navigator
const GroceryStack = createNativeStackNavigator<GroceryStackParamList>();

function GroceryStackNavigator() {
  return (
    <GroceryStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <GroceryStack.Screen 
        name="GroceryLists" 
        component={GroceryListsScreen}
      />
      <GroceryStack.Screen 
        name="GroceryListDetail" 
        component={GroceryListDetailScreen}
      />
    </GroceryStack.Navigator>
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

      {/* My Posts Tab */}
      <Tab.Screen
        name="MyPostsStack"
        component={MyPostsStackNavigator}
        options={{
          tabBarLabel: 'My Posts',
          tabBarIcon: ({ focused }: { color: string; focused: boolean }) => {
            const iconColor = focused ? colors.primary : colors.text.tertiary;
            if (focused) {
              // Use PNG image for filled state (matches premium avatar badge)
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
              // Use outline SVG for inactive state
              return <ChefHat2 size={24} color={iconColor} />;
            }
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
    </Tab.Navigator>
  );
}

// Main App Component with Auth
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
            {session ? (
              <SpaceProvider>
                <MainTabNavigator />
              </SpaceProvider>
            ) : (
              <AuthStackNavigator />
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