// screens/MyPostsScreen.tsx
// FIXED: Hooks error resolved - moved carousel state to component level
// FIXED: Dynamic aspect ratio handling to prevent letterboxing
// Updated: November 16, 2025

import { useNavigation } from '@react-navigation/native';
import { useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
  Dimensions,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme/ThemeContext';
import { MyPostsStackParamList } from '../App';
import PostActionMenu from '../components/PostActionMenu';
import AddMediaModal from '../components/AddMediaModal';
import { uploadPostImages } from '../lib/services/imageStorageService';
import CreateMealModal from '../components/CreateMealModal';

type Props = NativeStackScreenProps<MyPostsStackParamList, 'MyPostsList'>;

const SCREEN_WIDTH = Dimensions.get('window').width;

interface PostPhoto {
  url: string;
  caption?: string;
  order: number;
  is_highlight?: boolean;
}

interface Post {
  id: string;
  title: string;
  rating: number | null;
  modifications: string | null;
  cooking_method: string | null;
  created_at: string;
  photos?: PostPhoto[];
  recipes?: any;
}

interface Like {
  user_id: string;
  created_at: string;
  avatar_url?: string | null;
  user_profiles?: {
    id: string;
    display_name?: string;
  } | null;
}

interface PostLikes {
  [postId: string]: {
    likes: Like[];
    currentUserLiked: boolean;
    totalCount: number;
  };
}

interface PostComments {
  [postId: string]: number;
}

// NEW: Interface for tracking image dimensions
interface ImageDimensions {
  [url: string]: {
    width: number;
    height: number;
  };
}

// Import icons
const COOKING_METHOD_ICON_IMAGES: { [key: string]: any } = {
  cook: require('../assets/icons/cook.png'),
  bake: require('../assets/icons/bake.png'),
  bbq: require('../assets/icons/bbq.png'),
  meal_prep: require('../assets/icons/meal-prep.png'),
  snack: require('../assets/icons/snack.png'),
  eating_out: require('../assets/icons/eating-out.png'),
  breakfast: require('../assets/icons/breakfast.png'),
  slow_cook: require('../assets/icons/slow-cook.png'),
  soup: require('../assets/icons/soup.png'),
  preserve: require('../assets/icons/preserve.png'),
};

export default function MyPostsScreen({ navigation }: Props) {
  const { colors, functionalColors } = useTheme();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('Tom Morley');
  const [userInitials, setUserInitials] = useState('TM');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [postLikes, setPostLikes] = useState<PostLikes>({});
  const [postComments, setPostComments] = useState<PostComments>({});

  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [createMealModalVisible, setCreateMealModalVisible] = useState(false);

  // FIXED: Moved carousel state to component level
  const [carouselIndices, setCarouselIndices] = useState<{ [postId: string]: number }>({});

  // NEW: State to track image dimensions for aspect ratio calculation
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions>({});

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    header: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    listContainer: {
      padding: 15,
    },
    postCard: {
      backgroundColor: colors.background.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    postHeader: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      borderWidth: 2,
      borderColor: colors.border.medium,
    },
    avatarText: {
      fontSize: 28,
    },
    headerInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    userName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 2,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    methodIconSmall: {
      width: 20,
      height: 20,
      marginRight: 6,
    },
    metaText: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    menuButton: {
      padding: 4,
    },
    menuButtonText: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text.tertiary,
      lineHeight: 20,
    },
    photoCarouselContainer: {
      marginHorizontal: -16,
      marginBottom: 12,
      position: 'relative',
    },
    photoSlide: {
      width: SCREEN_WIDTH - 32,
      // FIXED: No fixed heights - height is set dynamically per image
      backgroundColor: '#000',
    },
    photoImage: {
      width: '100%',
      height: '100%',
    },
    captionOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      padding: 12,
    },
    captionText: {
      color: colors.background.card,
      fontSize: 14,
    },
    photoIndicators: {
      position: 'absolute',
      bottom: 12,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    indicator: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    indicatorActive: {
      backgroundColor: colors.background.card,
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    postTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 6,
    },
    recipeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 12,
    },
    recipeTitle: {
      fontSize: 15,
      color: colors.text.secondary,
    },
    chefName: {
      fontSize: 15,
      color: colors.primary,
    },
    ratingContainer: {
      marginBottom: 12,
    },
    starsContainer: {
      flexDirection: 'row',
      gap: 2,
    },
    starSmall: {
      fontSize: 16,
    },
    modificationsContainer: {
      backgroundColor: colors.background.secondary,
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
    },
    modificationsLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 4,
    },
    modificationsText: {
      fontSize: 14,
      color: colors.text.primary,
      lineHeight: 20,
    },
    likesSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
    },
    likesSectionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      paddingRight: 8,
    },
    avatarStack: {
      flexDirection: 'row',
      marginRight: 8,
    },
    miniAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.background.card,
      borderWidth: 2,
      borderColor: colors.background.card,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    miniAvatarText: {
      fontSize: 14,
    },
    likesText: {
      fontSize: 10,
      color: colors.text.secondary,
      fontWeight: '500',
      flexShrink: 1,
    },
    commentsSectionRight: {
      paddingVertical: 4,
      paddingLeft: 8,
    },
    commentsText: {
      fontSize: 10,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    actionsRow: {
      flexDirection: 'row',
      paddingTop: 0,
      paddingHorizontal: '5%',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    actionButton: {
      padding: 8,
    },
    actionIcon: {
      width: 30,
      height: 30,
    },
    emptyEmoji: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 8,
      color: colors.text.primary,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 10,
      backgroundColor: colors.background.card,
    },
    createMealButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    createMealButtonText: {
      color: 'white',
      fontWeight: '600',
      fontSize: 14,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    viewMealsButton: {
      backgroundColor: colors.background.secondary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    viewMealsButtonText: {
      color: colors.text.primary,
      fontWeight: '600',
      fontSize: 14,
    },
  }), [colors]);

  useEffect(() => {
    loadUserInfo();
    loadPosts();
  }, []);

  // NEW: Load image dimensions when posts change
  useEffect(() => {
    loadAllImageDimensions();
  }, [posts]);

  const loadUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      
      // Load actual user profile with avatar
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name, username, avatar_url')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setUserName(profile.display_name || profile.username || 'User');
        
        // Use actual avatar_url from profile, or default if null
        const userAvatar = profile.avatar_url || '👤';
        setUserInitials(userAvatar);
      }
    }
  };

  // NEW: Function to load dimensions for all images
  const loadAllImageDimensions = () => {
    posts.forEach(post => {
      if (post.photos && post.photos.length > 0) {
        post.photos.forEach(photo => {
          if (!imageDimensions[photo.url]) {
            Image.getSize(
              photo.url,
              (width, height) => {
                setImageDimensions(prev => ({
                  ...prev,
                  [photo.url]: { width, height }
                }));
              },
              (error) => {
                console.error('Error loading image size:', error);
              }
            );
          }
        });
      }
    });
  };

  // NEW: Calculate dynamic height based on image aspect ratio
  const getImageHeight = (url: string): number => {
    const dims = imageDimensions[url];
    if (!dims) return 300; // Default height while loading
    
    const aspectRatio = dims.height / dims.width;
    const calculatedHeight = (SCREEN_WIDTH - 32) * aspectRatio;
    
    // Constrain to reasonable limits
    const minHeight = 200;
    const maxHeight = 600;
    return Math.max(minHeight, Math.min(maxHeight, calculatedHeight));
  };

  const loadPosts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('No user logged in');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          recipes (
            title,
            chefs (
              name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading posts:', error);
        throw error;
      }

      console.log('📸 Loaded posts with photos:', data?.map(p => ({ 
        id: p.id.substring(0, 8), 
        photoCount: p.photos?.length || 0 
      })));

      setPosts(data || []);
      
      if (data && data.length > 0) {
        await loadLikesForPosts(data.map(p => p.id), user.id);
        await loadCommentsCountForPosts(data.map(p => p.id));
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      Alert.alert('Error', 'Failed to load posts. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCommentsCountForPosts = async (postIds: string[]) => {
    try {
      const { data: commentsData, error } = await supabase
        .from('post_comments')
        .select('post_id')
        .in('post_id', postIds);

      if (error) throw error;

      const counts: PostComments = {};
      postIds.forEach(postId => {
        const count = (commentsData || []).filter((c: any) => c.post_id === postId).length;
        counts[postId] = count;
      });

      setPostComments(counts);
    } catch (error) {
      console.error('Error loading comment counts:', error);
    }
  };

  const loadLikesForPosts = async (postIds: string[], currentUserId: string) => {
    try {
      // Step 1: Get likes with created_at for ordering
      const { data: likesData, error } = await supabase
        .from('post_likes')
        .select('post_id, user_id, created_at')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Step 2: Get unique user IDs from all likes
      const likerUserIds = [...new Set(likesData?.map(l => l.user_id) || [])];
      
      // Step 3: Fetch user profiles for all likers (to get their avatars)
      let likerProfiles: Map<string, { avatar_url?: string | null }> = new Map();
      if (likerUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, avatar_url')
          .in('id', likerUserIds);
        
        likerProfiles = new Map(profiles?.map(p => [p.id, { avatar_url: p.avatar_url }]) || []);
      }

      // Step 4: Build likes map with avatar data
      const likesMap: PostLikes = {};
      
      postIds.forEach(postId => {
        const postLikesData = (likesData || [])
          .filter((like: any) => like.post_id === postId);
        const currentUserLiked = postLikesData.some((like: any) => like.user_id === currentUserId);
        
        const transformedLikes: Like[] = postLikesData.map((like: any) => ({
          user_id: like.user_id,
          created_at: like.created_at,
          avatar_url: likerProfiles.get(like.user_id)?.avatar_url || null,  // ← Include actual avatar
          user_profiles: null
        }));
        
        likesMap[postId] = {
          likes: transformedLikes,
          currentUserLiked,
          totalCount: transformedLikes.length
        };
      });

      setPostLikes(likesMap);
    } catch (error) {
      console.error('Error loading likes:', error);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!currentUserId) return;

    const postLikeData = postLikes[postId];
    const isLiked = postLikeData?.currentUserLiked || false;

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: currentUserId
          });

        if (error) throw error;
      }

      await loadLikesForPosts([postId], currentUserId);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPosts();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return 'Today at ' + date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 48) {
      return 'Yesterday at ' + date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    
    return (
      <View style={styles.starsContainer}>
        {[...Array(5)].map((_, i) => (
          <Text key={i} style={styles.starSmall}>
            {i < rating ? '⭐' : '☆'}
          </Text>
        ))}
      </View>
    );
  };

  function openMenu(post: Post) {
    setSelectedPost(post);
    setMenuVisible(true);
  }

  function handleAddMedia() {
    setMenuVisible(false);
    setMediaModalVisible(true);
  }

  async function handleSaveMedia(photos: Array<{ uri: string; caption?: string; order: number }>) {
    if (!selectedPost || !currentUserId) {
      Alert.alert('Error', 'No post selected or user not logged in');
      return;
    }

    console.log('🔵 Starting photo upload...', {
      postId: selectedPost.id.substring(0, 8),
      photoCount: photos.length,
      existingCount: selectedPost.photos?.length || 0
    });

    try {
      console.log('📤 Uploading to Supabase Storage...');
      const uploadedPhotos = await uploadPostImages(
        photos.map(p => p.uri),
        currentUserId
      );
      
      console.log('✅ Upload complete:', uploadedPhotos.length, 'photos');

      const photosWithCaptions: PostPhoto[] = uploadedPhotos.map((photo, index) => ({
        url: photo.url,
        caption: photos[index].caption,
        order: photo.order,
        is_highlight: index === 0 && (!selectedPost.photos || selectedPost.photos.length === 0)
      }));

      const existingPhotos = selectedPost.photos || [];
      const allPhotos = [...existingPhotos, ...photosWithCaptions];
      
      console.log('💾 Saving to database...', {
        postId: selectedPost.id,
        totalPhotos: allPhotos.length,
        newPhotos: photosWithCaptions.length
      });

      // FIXED: Explicit select to ensure data is returned
      const { data, error } = await supabase
        .from('posts')
        .update({ photos: allPhotos })
        .eq('id', selectedPost.id)
        .select('id, photos');

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Database save successful!', {
        returnedId: data?.[0]?.id,
        photoCount: data?.[0]?.photos?.length
      });

      // Verify the save worked
      if (!data || !data[0]?.photos || data[0].photos.length === 0) {
        console.error('⚠️ Warning: Photos array is empty after save');
        throw new Error('Photos were not saved to database. Check database permissions and schema.');
      }

      await loadPosts();
      Alert.alert('Success', `${photos.length} photo${photos.length > 1 ? 's' : ''} added successfully!`);
      
    } catch (error: any) {
      console.error('❌ Error in handleSaveMedia:', error);
      Alert.alert(
        'Upload Failed', 
        error?.message || 'Failed to save photos. Please check console for details.'
      );
      throw error;
    }
  }

  function handleEditPost() {
    if (!selectedPost) return;
    
    setMenuVisible(false);
    navigation.navigate('EditMedia', { 
      postId: selectedPost.id,
      existingPhotos: selectedPost.photos || []
    });
  }

  async function handleDeletePost() {
    if (!selectedPost) return;

    Alert.alert(
      'Delete Activity',
      'Are you sure you want to delete this activity? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('posts')
                .delete()
                .eq('id', selectedPost.id);

              if (error) throw error;

              setMenuVisible(false);
              await loadPosts();
              Alert.alert('Success', 'Activity deleted');
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete activity');
            }
          },
        },
      ]
    );
  }

  const renderLikesSection = (postId: string, postTitle: string) => {
    const likeData = postLikes[postId];
    const commentCount = postComments[postId] || 0;
    
    if (!likeData && commentCount === 0) return null;

    const { likes, currentUserLiked, totalCount } = likeData || { 
      likes: [], 
      currentUserLiked: false, 
      totalCount: 0 
    };
    
    let yasChefText = '';
    if (totalCount > 0) {
      if (currentUserLiked) {
        if (totalCount === 1) {
          yasChefText = 'You gave yas chef';
        } else {
          yasChefText = `You and ${totalCount - 1} other${totalCount - 1 !== 1 ? 's' : ''} gave yas chefs`;
        }
      } else {
        yasChefText = `${totalCount} gave yas chef${totalCount !== 1 ? 's' : ''}`;
      }
    }
    
    const displayLikes = likes.slice(0, 3);

    return (
      <View style={styles.likesSection}>
        {totalCount > 0 && (
          <TouchableOpacity 
            style={styles.likesSectionLeft}
            onPress={() => navigation.navigate('YasChefsList', { postId, postTitle })}
            activeOpacity={0.7}
          >
            <View style={styles.avatarStack}>
              {displayLikes.map((like, index) => (
                <View 
                  key={like.user_id} 
                  style={[
                    styles.miniAvatar,
                    { marginLeft: index > 0 ? -8 : 0, zIndex: 3 - index }
                  ]}
                >
                  <Text style={styles.miniAvatarText}>
                    {like.avatar_url || '👤'}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.likesText}>{yasChefText}</Text>
          </TouchableOpacity>
        )}

        {commentCount > 0 && (
          <TouchableOpacity 
            style={styles.commentsSectionRight}
            onPress={() => navigation.navigate('CommentsList', { postId })}
            activeOpacity={0.7}
          >
            <Text style={styles.commentsText}>
              {commentCount} comment{commentCount !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const handleMealCreated = (mealId: string) => {
    setCreateMealModalVisible(false);
    if (currentUserId) {
      navigation.navigate('MealDetail', { mealId, currentUserId });
    }
  };

  // FIXED: Render function with dynamic heights based on aspect ratios
  const renderPhotoCarousel = (photos: PostPhoto[], postId: string) => {
    if (!photos || photos.length === 0) return null;

    const sortedPhotos = [...photos].sort((a, b) => {
      if (a.is_highlight) return -1;
      if (b.is_highlight) return 1;
      return a.order - b.order;
    });

    const activeIndex = carouselIndices[postId] || 0;

    const onScroll = (event: any) => {
      const slideSize = event.nativeEvent.layoutMeasurement.width;
      const offset = event.nativeEvent.contentOffset.x;
      const index = Math.round(offset / slideSize);
      setCarouselIndices(prev => ({ ...prev, [postId]: index }));
    };

    return (
      <View style={styles.photoCarouselContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {sortedPhotos.map((photo, index) => {
            const imageHeight = getImageHeight(photo.url); // FIXED: Dynamic height
            
            return (
              <View 
                key={`photo-${index}`} 
                style={[
                  styles.photoSlide, 
                  { height: imageHeight } // FIXED: Use dynamic height
                ]}
              >
                <Image 
                  source={{ uri: photo.url }}
                  style={styles.photoImage}
                  resizeMode="cover" // FIXED: Changed from contain to cover
                />
                {photo.caption && (
                  <View style={styles.captionOverlay}>
                    <Text style={styles.captionText}>{photo.caption}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
        
        {sortedPhotos.length > 1 && (
          <View style={styles.photoIndicators}>
            {sortedPhotos.map((_, index) => (
              <View
                key={`dot-${index}`}
                style={[
                  styles.indicator,
                  index === activeIndex && styles.indicatorActive
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderPost = ({ item }: { item: Post }) => {
    const likeData = postLikes[item.id];
    const hasLike = likeData?.currentUserLiked || false;
    
    const recipe = Array.isArray(item.recipes) ? item.recipes[0] : item.recipes;
    const chef = recipe?.chefs ? (Array.isArray(recipe.chefs) ? recipe.chefs[0] : recipe.chefs) : null;
    
    return (
      <TouchableOpacity 
        style={styles.postCard}
        onPress={() => navigation.navigate('MyPostDetails', { postId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.postHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userInitials}</Text>
          </View>
          
          <View style={styles.headerInfo}>
            <Text style={styles.userName}>{userName}</Text>
            <View style={styles.metaRow}>
              <Image 
                source={COOKING_METHOD_ICON_IMAGES[item.cooking_method || 'cook']}
                style={styles.methodIconSmall}
                resizeMode="contain"
              />
              <Text style={styles.metaText}>
                {formatDate(item.created_at)} in Portland, Oregon
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => openMenu(item)}
          >
            <Text style={styles.menuButtonText}>•••</Text>
          </TouchableOpacity>
        </View>

        {/* FIXED: Pass postId to carousel */}
        {renderPhotoCarousel(item.photos || [], item.id)}

        <Text style={styles.postTitle}>{item.title || 'Cooking Session'}</Text>

        <View style={styles.recipeRow}>
          <Text style={styles.recipeTitle}>{recipe?.title}</Text>
          {chef?.name && (
            <Text style={styles.chefName}> by {chef.name}</Text>
          )}
        </View>

        {item.rating && (
          <View style={styles.ratingContainer}>
            {renderStars(item.rating)}
          </View>
        )}

        {item.modifications && (
          <View style={styles.modificationsContainer}>
            <Text style={styles.modificationsLabel}>💭 Notes:</Text>
            <Text style={styles.modificationsText} numberOfLines={3}>
              {item.modifications}
            </Text>
          </View>
        )}

        {renderLikesSection(item.id, item.title || 'Cooking Session')}

        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => toggleLike(item.id)}
          >
            <Image 
              source={hasLike 
                ? require('../assets/icons/like-outline-2-filled.png')
                : require('../assets/icons/like-outline-2-thick.png')
              }
              style={[
                styles.actionIcon,
                hasLike && { tintColor: functionalColors.like }
              ]}
              resizeMode="contain"
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('CommentsList', { postId: item.id })}
          >
            <Image 
              source={require('../assets/icons/comment.png')}
              style={styles.actionIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyEmoji}>🍳</Text>
        <Text style={styles.emptyTitle}>No cooking sessions yet!</Text>
        <Text style={styles.emptyText}>
          Finish cooking a recipe to see your posts here
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <Text style={styles.header}>My Cooking</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.viewMealsButton}
            onPress={() => {
              navigation.getParent()?.navigate('MealsStack');
            }}
          >
            <Text style={styles.viewMealsButtonText}>🍽️ Meals</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.createMealButton}
            onPress={() => setCreateMealModalVisible(true)}
          >
            <Text style={styles.createMealButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      <PostActionMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onAddMedia={handleAddMedia}
        onEditPost={handleEditPost}
        onDeletePost={handleDeletePost}
      />

      <AddMediaModal
        visible={mediaModalVisible}
        onClose={() => setMediaModalVisible(false)}
        onSave={handleSaveMedia}
        existingPhotos={selectedPost?.photos?.map(p => ({ 
          uri: p.url, 
          caption: p.caption, 
          order: p.order 
        }))}
      />

      {currentUserId && (
        <CreateMealModal
          visible={createMealModalVisible}
          onClose={() => setCreateMealModalVisible(false)}
          onSuccess={handleMealCreated}
          currentUserId={currentUserId}
        />
      )}
    </View>
  );
}