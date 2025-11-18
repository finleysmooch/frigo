// App.tsx
// Updated with Web Recipe Extraction and Missing Ingredients features
// Updated: November 18, 2025

import { useState, useEffect } from 'react';
import { Text, ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RecipeListScreen from './screens/RecipeListScreen';
import RecipeDetailScreen from './screens/RecipeDetailScreen';
import { AddRecipeFromPhotoScreen } from './screens/AddRecipeFromPhotoScreen';
import { AddRecipeFromUrlScreen } from './screens/AddRecipeFromUrlScreen';
import { MissingIngredientsScreen } from './screens/MissingIngredientsScreen';
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
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { ProcessedIngredient } from './lib/types/recipeExtraction';

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

export type RecipesStackParamList = {
  RecipeList: undefined;
  RecipeDetail: { recipe: any };
  Cooking: { recipeId: string };
  BookView: { bookId: string };
  AuthorView: { chefName: string };
  AddRecipeFromPhoto: { userId: string; source: 'camera' | 'gallery' };
  AddRecipeFromUrl: { userId: string };
  MissingIngredients: {
    missingIngredients: ProcessedIngredient[];
    allIngredients: ProcessedIngredient[];
    onComplete: (updatedIngredients: ProcessedIngredient[]) => void;
  };
};

export type MyPostsStackParamList = {
  MyPostsList: undefined;
  YasChefsList: { postId: string; postTitle: string };
  CommentsList: { postId: string };
  EditMedia: { postId: string; existingPhotos: PostPhoto[] };
  MyPostDetails: { postId: string };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Settings: undefined;
  EditProfile: undefined;
};

export type GroceryStackParamList = {
  GroceryLists: undefined;
  GroceryListDetail: { listId: string; listName: string };
};

export type RootTabParamList = {
  RecipesStack: undefined;
  MyPostsStack: undefined;
  PantryStack: undefined;
  GroceryStack: undefined;
  ProfileStack: undefined;
  Stores: undefined;
  Admin: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RecipesStack = createNativeStackNavigator<RecipesStackParamList>();
const MyPostsStack = createNativeStackNavigator<MyPostsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

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

// Recipes Stack Navigator
function RecipesStackNavigator() {
  return (
    <RecipesStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <RecipesStack.Screen 
        name="RecipeList" 
        component={RecipeListScreen}
      />
      <RecipesStack.Screen 
        name="RecipeDetail" 
        component={RecipeDetailScreen}
      />
      <RecipesStack.Screen 
        name="Cooking" 
        component={CookingScreen}
        options={{
          gestureEnabled: false,
        }}
      />
      <RecipesStack.Screen 
        name="BookView" 
        component={BookViewScreen}
        options={{
          headerShown: true,
          title: 'Book',
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
          headerShown: false, 
          presentation: 'modal'
        }}
      />
      <RecipesStack.Screen 
        name="AddRecipeFromUrl" 
        component={AddRecipeFromUrlScreen}
        options={{ 
          headerShown: false, 
          presentation: 'modal'
        }}
      />
      <RecipesStack.Screen 
        name="MissingIngredients" 
        component={MissingIngredientsScreen}
        options={{ 
          headerShown: false, 
          presentation: 'modal'
        }}
      />
    </RecipesStack.Navigator>
  );
}

// MyPosts Stack Navigator
function MyPostsStackNavigator() {
  return (
    <MyPostsStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <MyPostsStack.Screen 
        name="MyPostsList" 
        component={MyPostsScreen}
      />
      <MyPostsStack.Screen 
        name="YasChefsList" 
        component={YasChefScreen}
      />
      <MyPostsStack.Screen 
        name="CommentsList" 
        component={CommentsScreen}
      />
      <MyPostsStack.Screen 
        name="EditMedia" 
        component={EditMediaScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <MyPostsStack.Screen 
        name="MyPostDetails" 
        component={MyPostDetailsScreen}
        options={{
          headerShown: false,
        }}
      />
    </MyPostsStack.Navigator>
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
    </ProfileStack.Navigator>
  );
}

// Pantry Stack Navigator
const PantryStack = createNativeStackNavigator();

function PantryStackNavigator() {
  return (
    <PantryStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <PantryStack.Screen name="Pantry" component={PantryScreen} />
    </PantryStack.Navigator>
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

// Main Tab Navigator
function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          height: 88,
          paddingBottom: 34,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="RecipesStack"
        component={RecipesStackNavigator}
        options={{
          tabBarLabel: 'Recipes',
          tabBarIcon: ({ focused }: { color: string; focused: boolean }) => (
            <Text style={{ fontSize: 24 }}>{focused ? '📖' : '📕'}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="MyPostsStack"
        component={MyPostsStackNavigator}
        options={{
          tabBarLabel: 'My Posts',
          tabBarIcon: ({ focused }: { color: string; focused: boolean }) => (
            <Text style={{ fontSize: 24 }}>{focused ? '🍳' : '🥘'}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="PantryStack"
        component={PantryStackNavigator}
        options={{
          tabBarLabel: 'Pantry',
          tabBarIcon: ({ focused }: { color: string; focused: boolean }) => (
            <Text style={{ fontSize: 24 }}>{focused ? '🏪' : '📦'}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="GroceryStack"
        component={GroceryStackNavigator}
        options={{
          tabBarLabel: 'Grocery',
          tabBarIcon: ({ focused }: { color: string; focused: boolean }) => (
            <Text style={{ fontSize: 24 }}>{focused ? '🛒' : '🛍️'}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="ProfileStack"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }: { color: string; focused: boolean }) => (
            <Text style={{ fontSize: 24 }}>{focused ? '👤' : '👥'}</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Main App Component with Auth
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FC4C02" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? <MainTabNavigator /> : <AuthStackNavigator />}
    </NavigationContainer>
  );
}