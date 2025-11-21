// screens/MyPostDetailsScreen.tsx
// NEW: Detailed view of a single post (like Strava's activity detail screen)
// Created: November 16, 2025

import { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { MyPostsStackParamList, PostPhoto } from '../App';
import PostActionMenu from '../components/PostActionMenu';
import AddMediaModal from '../components/AddMediaModal';
import AddCookingPartnersModal from '../components/AddCookingPartnersModal';  // ← NEW
import { uploadPostImages } from '../lib/services/imageStorageService';
import { addParticipantsToPost, getPostParticipants, ParticipantRole } from '../lib/services/postParticipantsService';  // ← NEW

type Props = NativeStackScreenProps<MyPostsStackParamList, 'MyPostDetails'>;

const SCREEN_WIDTH = Dimensions.get('window').width;

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
  user_profiles?: {
    id: string;
    display_name?: string;
  } | null;
}

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

const AVATAR_EMOJIS = ['🧑‍🍳', '👨‍🍳', '👩‍🍳', '🍕', '🌮', '🍔', '🍜', '🥘', '🍱', '🥗', '🍝', '🥙'];

const getAvatarForUser = (userId: string): string => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_EMOJIS[hash % AVATAR_EMOJIS.length];
};

export default function MyPostDetailsScreen({ navigation, route }: Props) {
  const { postId } = route.params;
  
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('Tom Morley');
  const [userInitials, setUserInitials] = useState('TM');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likes, setLikes] = useState<Like[]>([]);
  const [currentUserLiked, setCurrentUserLiked] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions>({});
  
  const [menuVisible, setMenuVisible] = useState(false);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [partnersModalVisible, setPartnersModalVisible] = useState(false);  // ← NEW
  const [participants, setParticipants] = useState<{
    sous_chefs: Array<{ user_id: string; username: string; avatar_url?: string | null; display_name?: string }>;
    ate_with: Array<{ user_id: string; username: string; avatar_url?: string | null; display_name?: string }>;
  }>({ sous_chefs: [], ate_with: [] });  // ← NEW

  useEffect(() => {
    loadUserInfo();
    loadPost();
    loadParticipants();  // ← NEW
  }, [postId]);

  useEffect(() => {
    if (post?.photos) {
      loadImageDimensions();
    }
  }, [post]);

  const loadUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const consistentAvatar = getAvatarForUser(user.id);
      setUserName('Tom Morley');
      setUserInitials(consistentAvatar);
    }
  };

  const loadImageDimensions = () => {
    if (!post?.photos) return;
    
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
  };

  const getImageHeight = (url: string): number => {
    const dims = imageDimensions[url];
    if (!dims) return 400;
    
    const aspectRatio = dims.height / dims.width;
    const calculatedHeight = SCREEN_WIDTH * aspectRatio;
    
    const minHeight = 300;
    const maxHeight = 700;
    return Math.max(minHeight, Math.min(maxHeight, calculatedHeight));
  };

  const loadPost = async () => {
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
        .eq('id', postId)
        .single();
      
      if (error) {
        console.error('Error loading post:', error);
        throw error;
      }

      setPost(data);
      
      // Load likes and comments
      await loadLikes(postId, user.id);
      await loadCommentCount(postId);
    } catch (error) {
      console.error('Error loading post:', error);
      Alert.alert('Error', 'Failed to load post. Please try again.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const loadLikes = async (postId: string, currentUserId: string) => {
    try {
      const { data: likesData, error } = await supabase
        .from('post_likes')
        .select('post_id, user_id, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const transformedLikes: Like[] = (likesData || []).map((like: any) => ({
        user_id: like.user_id,
        created_at: like.created_at,
        user_profiles: null
      }));
      
      setLikes(transformedLikes);
      setCurrentUserLiked(transformedLikes.some(like => like.user_id === currentUserId));
    } catch (error) {
      console.error('Error loading likes:', error);
    }
  };

  const loadCommentCount = async (postId: string) => {
    try {
      const { data: commentsData, error } = await supabase
        .from('post_comments')
        .select('id')
        .eq('post_id', postId);

      if (error) throw error;
      setCommentCount(commentsData?.length || 0);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const loadParticipants = async () => {
    try {
      const participantsList = await getPostParticipants(postId);
      const approved = participantsList.filter(p => p.status === 'approved');
      
      setParticipants({
        sous_chefs: approved
          .filter(p => p.role === 'sous_chef')
          .map(p => ({
            user_id: p.participant_user_id,
            username: p.participant_profile?.username || 'Unknown',
            avatar_url: p.participant_profile?.avatar_url || null,
            display_name: p.participant_profile?.display_name,
          })),
        ate_with: approved
          .filter(p => p.role === 'ate_with')
          .map(p => ({
            user_id: p.participant_user_id,
            username: p.participant_profile?.username || 'Unknown',
            avatar_url: p.participant_profile?.avatar_url || null,
            display_name: p.participant_profile?.display_name,
          })),
      });
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  const handleAddPartners = async (selectedUserIds: string[], role: ParticipantRole) => {
    if (!currentUserId) return;
    
    try {
      const result = await addParticipantsToPost(postId, selectedUserIds, role, currentUserId);
      
      if (result.success) {
        Alert.alert(
          'Invitations Sent!',
          'Your cooking partners have been notified.',
          [{ text: 'OK', onPress: () => {
            setPartnersModalVisible(false);
            loadParticipants();  // Reload to show pending invitations
          }}]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to send invitations');
      }
    } catch (error) {
      console.error('Error adding partners:', error);
      Alert.alert('Error', 'Failed to send invitations');
    }
  };

  const toggleLike = async () => {
    if (!currentUserId || !post) return;

    try {
      if (currentUserLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', currentUserId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: post.id,
            user_id: currentUserId
          });

        if (error) throw error;
      }

      await loadLikes(post.id, currentUserId);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    
    return (
      <View style={styles.starsContainer}>
        {[...Array(5)].map((_, i) => (
          <Text key={i} style={styles.star}>
            {i < rating ? '⭐' : '☆'}
          </Text>
        ))}
      </View>
    );
  };

  function handleAddMedia() {
    setMenuVisible(false);
    setMediaModalVisible(true);
  }

  async function handleSaveMedia(photos: Array<{ uri: string; caption?: string; order: number }>) {
    if (!post || !currentUserId) {
      Alert.alert('Error', 'No post selected or user not logged in');
      return;
    }

    try {
      const uploadedPhotos = await uploadPostImages(
        photos.map(p => p.uri),
        currentUserId
      );

      const photosWithCaptions: PostPhoto[] = uploadedPhotos.map((photo, index) => ({
        url: photo.url,
        caption: photos[index].caption,
        order: photo.order,
        is_highlight: index === 0 && (!post.photos || post.photos.length === 0)
      }));

      const existingPhotos = post.photos || [];
      const allPhotos = [...existingPhotos, ...photosWithCaptions];

      const { error } = await supabase
        .from('posts')
        .update({ photos: allPhotos })
        .eq('id', post.id);

      if (error) throw error;

      await loadPost();
      Alert.alert('Success', `${photos.length} photo${photos.length > 1 ? 's' : ''} added successfully!`);
    } catch (error) {
      console.error('Error saving media:', error);
      Alert.alert('Error', 'Failed to save photos. Please try again.');
    }
  }

  function handleEditPost() {
    if (!post) return;
    
    setMenuVisible(false);
    navigation.navigate('EditMedia', { 
      postId: post.id,
      existingPhotos: post.photos || []
    });
  }

  async function handleDeletePost() {
    if (!post) return;

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
                .eq('id', post.id);

              if (error) throw error;

              Alert.alert('Success', 'Activity deleted');
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete activity');
            }
          },
        },
      ]
    );
  }

  const renderPhotoCarousel = () => {
    if (!post?.photos || post.photos.length === 0) return null;

    const sortedPhotos = [...post.photos].sort((a, b) => {
      if (a.is_highlight) return -1;
      if (b.is_highlight) return 1;
      return a.order - b.order;
    });

    const onScroll = (event: any) => {
      const slideSize = event.nativeEvent.layoutMeasurement.width;
      const offset = event.nativeEvent.contentOffset.x;
      const index = Math.round(offset / slideSize);
      setCarouselIndex(index);
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
            const imageHeight = getImageHeight(photo.url);
            
            return (
              <View 
                key={`photo-${index}`} 
                style={[styles.photoSlide, { height: imageHeight }]}
              >
                <Image 
                  source={{ uri: photo.url }}
                  style={styles.photoImage}
                  resizeMode="cover"
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
                  index === carouselIndex && styles.indicatorActive
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Post not found</Text>
      </View>
    );
  }

  const recipe = Array.isArray(post.recipes) ? post.recipes[0] : post.recipes;
  const chef = recipe?.chefs ? (Array.isArray(recipe.chefs) ? recipe.chefs[0] : recipe.chefs) : null;

  const yasChefText = currentUserLiked
    ? likes.length === 1
      ? 'You gave yas chef'
      : `You and ${likes.length - 1} other${likes.length - 1 !== 1 ? 's' : ''} gave yas chefs`
    : `${likes.length} gave yas chef${likes.length !== 1 ? 's' : ''}`;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Activity</Text>
        
        <TouchableOpacity onPress={() => setMenuVisible(true)}>
          <Text style={styles.menuButton}>•••</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* User Header */}
        <View style={styles.postHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userInitials}</Text>
          </View>
          
          <View style={styles.headerInfo}>
            <Text style={styles.userName}>{userName}</Text>
            <View style={styles.metaRow}>
              <Image 
                source={COOKING_METHOD_ICON_IMAGES[post.cooking_method || 'cook']}
                style={styles.methodIconSmall}
                resizeMode="contain"
              />
              <Text style={styles.metaText}>
                {formatDate(post.created_at)} in Portland, Oregon
              </Text>
            </View>
          </View>
        </View>

        {/* Photos */}
        {renderPhotoCarousel()}

        {/* Post Details */}
        <View style={styles.detailsContainer}>
          <Text style={styles.postTitle}>{post.title || 'Cooking Session'}</Text>

          <View style={styles.recipeRow}>
            <Text style={styles.recipeTitle}>{recipe?.title}</Text>
            {chef?.name && (
              <Text style={styles.chefName}> by {chef.name}</Text>
            )}
          </View>

          {post.rating && (
            <View style={styles.ratingContainer}>
              {renderStars(post.rating)}
            </View>
          )}

          {post.modifications && (
            <View style={styles.modificationsContainer}>
              <Text style={styles.modificationsLabel}>💭 Notes:</Text>
              <Text style={styles.modificationsText}>
                {post.modifications}
              </Text>
            </View>
          )}

          {/* Cooking Partners Section */}
          {(participants.sous_chefs.length > 0 || participants.ate_with.length > 0) && (
            <View style={styles.participantsSection}>
              <Text style={styles.sectionTitle}>Cooking Partners</Text>
              {participants.sous_chefs.length > 0 && (
                <View style={styles.participantRow}>
                  <Text style={styles.participantEmoji}>👨‍🍳</Text>
                  <Text style={styles.participantText}>
                    Cooked with {participants.sous_chefs.map(p => p.display_name || p.username).join(', ')}
                  </Text>
                </View>
              )}
              {participants.ate_with.length > 0 && (
                <View style={styles.participantRow}>
                  <Text style={styles.participantEmoji}>🍽️</Text>
                  <Text style={styles.participantText}>
                    Ate with {participants.ate_with.map(p => p.display_name || p.username).join(', ')}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Add Cooking Partners Button */}
          <TouchableOpacity
            style={styles.addPartnersButton}
            onPress={() => setPartnersModalVisible(true)}
          >
            <Text style={styles.addPartnersButtonText}>
              {participants.sous_chefs.length > 0 || participants.ate_with.length > 0
                ? '➕ Add More Partners'
                : '➕ Add Cooking Partners'}
            </Text>
          </TouchableOpacity>

          {/* Likes and Comments */}
          {(likes.length > 0 || commentCount > 0) && (
            <View style={styles.socialSection}>
              {likes.length > 0 && (
                <TouchableOpacity 
                  style={styles.likesSectionLeft}
                  onPress={() => navigation.navigate('YasChefsList', { 
                    postId: post.id, 
                    postTitle: post.title || 'Cooking Session' 
                  })}
                >
                  <View style={styles.avatarStack}>
                    {likes.slice(0, 3).map((like, index) => (
                      <View 
                        key={like.user_id} 
                        style={[
                          styles.miniAvatar,
                          { marginLeft: index > 0 ? -8 : 0, zIndex: 3 - index }
                        ]}
                      >
                        <Text style={styles.miniAvatarText}>
                          {getAvatarForUser(like.user_id)}
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
                  onPress={() => navigation.navigate('CommentsList', { postId: post.id })}
                >
                  <Text style={styles.commentsText}>
                    {commentCount} comment{commentCount !== 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={toggleLike}
            >
              <Image 
                source={currentUserLiked 
                  ? require('../assets/icons/like-outline-2-filled.png')
                  : require('../assets/icons/like-outline-2-thick.png')
                }
                style={[
                  styles.actionIcon,
                  currentUserLiked && { tintColor: colors.like }
                ]}
                resizeMode="contain"
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('CommentsList', { postId: post.id })}
            >
              <Image 
                source={require('../assets/icons/comment.png')}
                style={styles.actionIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

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
        existingPhotos={post.photos?.map(p => ({ 
          uri: p.url, 
          caption: p.caption, 
          order: p.order 
        }))}
      />

      <AddCookingPartnersModal
        visible={partnersModalVisible}
        onClose={() => setPartnersModalVisible(false)}
        onConfirm={handleAddPartners}
        currentUserId={currentUserId || ''}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    fontSize: 32,
    color: '#007AFF',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  menuButton: {
    fontSize: 20,
    fontWeight: '600',
    color: '#999',
  },
  content: {
    flex: 1,
  },
  postHeader: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
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
    color: '#333',
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
    color: '#666',
  },
  photoCarouselContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  photoSlide: {
    width: SCREEN_WIDTH,
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
    color: '#fff',
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
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  detailsContainer: {
    paddingHorizontal: 16,
  },
  postTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  recipeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  recipeTitle: {
    fontSize: 16,
    color: '#888',
  },
  chefName: {
    fontSize: 16,
    color: '#007AFF',
  },
  ratingContainer: {
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  star: {
    fontSize: 20,
  },
  modificationsContainer: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  modificationsLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  modificationsText: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  participantsSection: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  participantEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  participantText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  addPartnersButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  addPartnersButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  socialSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
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
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#fff',
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
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
    flexShrink: 1,
  },
  commentsSectionRight: {
    paddingVertical: 4,
    paddingLeft: 8,
  },
  commentsText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: '5%',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    padding: 8,
  },
  actionIcon: {
    width: 30,
    height: 30,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
  },
});