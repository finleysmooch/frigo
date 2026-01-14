// screens/CommentsScreen.tsx
// Updated: November 20, 2025 - Fixed user profiles and removed double header

import { useEffect, useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { MyPostsStackParamList, FeedStackParamList } from '../App';
import { useTheme } from '../lib/theme/ThemeContext';
import UserAvatar from '../components/UserAvatar';

// Support navigation from both stacks
type Props = NativeStackScreenProps<MyPostsStackParamList, 'CommentsList'> |
             NativeStackScreenProps<FeedStackParamList, 'CommentsList'>;

interface Comment {
  id: string;
  comment_text: string;
  created_at: string;
  user_id: string;
  user_name?: string;
  avatar_url?: string;
  subscription_tier?: string;
  likes: number;
  currentUserLiked: boolean;
}

interface Post {
  id: string;
  title: string;
  cooking_method: string;
  created_at: string;
  user_id: string;
  user_name?: string;
  avatar_url?: string;
}

interface Like {
  user_id: string;
  created_at: string;
  avatar_url?: string;
  subscription_tier?: string;
}

// Cooking method icons mapping
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

// Avatar emojis (same as other screens)
const AVATAR_EMOJIS = ['🧑‍🍳', '👨‍🍳', '👩‍🍳', '🍕', '🌮', '🍔', '🍜', '🥘', '🍱', '🥗', '🍝', '🥙'];

const getAvatarForUser = (userId: string): string => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_EMOJIS[hash % AVATAR_EMOJIS.length];
};

export default function CommentsScreen({ route, navigation }: Props) {
  const { colors, functionalColors } = useTheme();
  const { postId } = route.params;
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [yasChefs, setYasChefs] = useState<Like[]>([]);
  const [yasChefCount, setYasChefCount] = useState(0);
  const [currentUserYasChef, setCurrentUserYasChef] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const textInputRef = useRef<TextInput>(null);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.card,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    postInfo: {
      flexDirection: 'row',
      padding: 15,
      paddingTop: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    postInfoText: {
      flex: 1,
    },
    postInfoTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 4,
      color: colors.text.primary,
    },
    postInfoMeta: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    postInfoName: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    postInfoDot: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    postInfoIcon: {
      width: 16,
      height: 16,
      marginRight: 6,
    },
    postInfoDate: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    yasChefsSection: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 15,
    },
    yasChefsSectionIcon: {
      width: 24,
      height: 24,
      marginRight: 8,
      tintColor: colors.primary,
    },
    yasChefsCount: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginRight: 12,
    },
    avatarStack: {
      flexDirection: 'row',
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
      shadowColor: colors.text.primary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    miniAvatarText: {
      fontSize: 14,
    },
    yasChefButtonSimple: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 15,
    },
    yasChefButtonSimpleIcon: {
      width: 24,
      height: 24,
      marginRight: 8,
    },
    yasChefButtonSimpleText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text.primary,
    },
    commentsList: {
      paddingVertical: 10,
    },
    emptyComments: {
      padding: 40,
      alignItems: 'center',
    },
    emptyCommentsText: {
      fontSize: 15,
      color: colors.text.tertiary,
    },
    commentContainer: {
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 15,
    },
    commentAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.border.light,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      borderWidth: 2,
      borderColor: colors.border.medium,
    },
    commentAvatarText: {
      fontSize: 24,
    },
    commentContent: {
      flex: 1,
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    commentUserName: {
      fontSize: 15,
      fontWeight: '600',
      marginRight: 8,
    },
    commentTime: {
      fontSize: 13,
      color: colors.text.tertiary,
    },
    commentText: {
      fontSize: 15,
      lineHeight: 20,
      color: colors.text.primary,
    },
    commentLikesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
    },
    commentLikeIcon: {
      width: 12,
      height: 12,
      marginRight: 4,
      tintColor: colors.primary,
    },
    commentLikesCount: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    commentLikeButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentLikeButtonIcon: {
      width: 20,
      height: 20,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border.medium,
      backgroundColor: colors.background.card,
    },
    input: {
      flex: 1,
      backgroundColor: colors.background.secondary,
      borderRadius: 20,
      paddingHorizontal: 15,
      paddingVertical: 10,
      fontSize: 15,
      maxHeight: 100,
      marginRight: 10,
      color: colors.text.primary,
    },
    sendButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
    },
    sendButtonDisabled: {
      backgroundColor: colors.border.medium,
    },
    sendButtonText: {
      color: colors.background.card,
      fontSize: 15,
      fontWeight: '600',
    },
  }), [colors, functionalColors]);

  useEffect(() => {
    loadData();
    // Auto-focus the text input when screen opens
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      // Load post info (without user profile join to avoid foreign key issues)
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('id, title, cooking_method, created_at, user_id')
        .eq('id', postId)
        .single();

      if (postError) throw postError;

      // Fetch user profile separately
      const { data: userProfileData } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', postData.user_id)
        .single();

      setPost({
        id: postData.id,
        title: postData.title,
        cooking_method: postData.cooking_method,
        created_at: postData.created_at,
        user_id: postData.user_id,
        user_name: userProfileData?.display_name || userProfileData?.username || 'Someone',
        avatar_url: userProfileData?.avatar_url || undefined,
      });

      // Load yas chefs (post likes)
      const { data: likesData, error: likesError } = await supabase
        .from('post_likes')
        .select('user_id, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (!likesError && likesData) {
        // Fetch user profiles for yas chefs
        const likeUserIds = [...new Set(likesData.map(l => l.user_id))];
        const { data: likeProfilesData } = await supabase
          .from('user_profiles')
          .select('id, avatar_url, subscription_tier')
          .in('id', likeUserIds);

        const likeProfilesMap = new Map(likeProfilesData?.map(p => [p.id, p]) || []);

        const formattedLikes: Like[] = likesData.map(like => {
          const profile = likeProfilesMap.get(like.user_id);
          return {
            user_id: like.user_id,
            created_at: like.created_at,
            avatar_url: profile?.avatar_url || undefined,
            subscription_tier: profile?.subscription_tier || 'free'
          };
        });

        setYasChefs(formattedLikes);
        setYasChefCount(formattedLikes.length);
        setCurrentUserYasChef(formattedLikes.some(l => l.user_id === user.id));
      }

      // Load comments
      await loadComments(user.id);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async (userId: string) => {
    try {
      // Fetch comments without join to avoid foreign key issues
      const { data: commentsData, error: commentsError } = await supabase
        .from('post_comments')
        .select('id, comment_text, created_at, user_id')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        return;
      }

      // Get unique user IDs from comments
      const userIds = [...new Set(commentsData.map((c: any) => c.user_id))];

      // Fetch user profiles separately
      const { data: profilesData } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url, subscription_tier')
        .in('id', userIds);

      // Create a map for quick lookup
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Load likes for all comments
      const commentIds = commentsData.map((c: any) => c.id);
      const { data: likesData } = await supabase
        .from('comment_likes')
        .select('comment_id, user_id')
        .in('comment_id', commentIds);

      // Format comments with like info and user profiles
      const formattedComments: Comment[] = commentsData.map((comment: any) => {
        const commentLikes = likesData?.filter(l => l.comment_id === comment.id) || [];
        const userProfile = profilesMap.get(comment.user_id);

        return {
          id: comment.id,
          comment_text: comment.comment_text,
          created_at: comment.created_at,
          user_id: comment.user_id,
          user_name: userProfile?.display_name || userProfile?.username || 'Someone',
          avatar_url: userProfile?.avatar_url || undefined,
          subscription_tier: userProfile?.subscription_tier || 'free',
          likes: commentLikes.length,
          currentUserLiked: commentLikes.some(l => l.user_id === userId)
        };
      });

      setComments(formattedComments);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const toggleYasChef = async () => {
    if (!currentUserId) return;

    try {
      if (currentUserYasChef) {
        // Unlike
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserId);

        setYasChefCount(prev => prev - 1);
        setCurrentUserYasChef(false);
      } else {
        // Like
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: currentUserId });

        setYasChefCount(prev => prev + 1);
        setCurrentUserYasChef(true);
      }

      // Reload yas chefs to update avatars
      const { data: likesData } = await supabase
        .from('post_likes')
        .select('user_id, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (likesData) {
        // Fetch user profiles for yas chefs
        const likeUserIds = [...new Set(likesData.map(l => l.user_id))];
        const { data: likeProfilesData } = await supabase
          .from('user_profiles')
          .select('id, avatar_url, subscription_tier')
          .in('id', likeUserIds);

        const likeProfilesMap = new Map(likeProfilesData?.map(p => [p.id, p]) || []);

        const formattedLikes: Like[] = likesData.map(like => {
          const profile = likeProfilesMap.get(like.user_id);
          return {
            user_id: like.user_id,
            created_at: like.created_at,
            avatar_url: profile?.avatar_url || undefined,
            subscription_tier: profile?.subscription_tier || 'free'
          };
        });

        setYasChefs(formattedLikes);
      }
    } catch (error) {
      console.error('Error toggling yas chef:', error);
    }
  };

  const toggleCommentLike = async (commentId: string, currentlyLiked: boolean) => {
    if (!currentUserId) return;

    try {
      if (currentlyLiked) {
        // Unlike
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', currentUserId);
      } else {
        // Like
        await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: currentUserId });
      }

      // Reload comments to update like counts
      if (currentUserId) {
        await loadComments(currentUserId);
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !currentUserId || submitting) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: currentUserId,
          comment_text: commentText.trim()
        });

      if (error) throw error;

      // Clear input
      setCommentText('');

      // Reload comments
      await loadComments(currentUserId);

      // Keep focus on input
      textInputRef.current?.focus();
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;

    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks}w`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
      return 'Today at ' + date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
    } else if (date.toDateString() === new Date(now.setDate(now.getDate() - 1)).toDateString()) {
      return 'Yesterday at ' + date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }) + ' at ' + date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
    }
  };

  const navigateToYasChefs = () => {
    if (yasChefCount > 0) {
      navigation.navigate('YasChefsList', {
        postId: postId,
        postTitle: post?.title || 'Cooking Session'
      });
    }
  };

  const renderComment = ({ item }: { item: Comment }) => {
    return (
      <View style={styles.commentContainer}>
        <UserAvatar
          user={{
            avatar_url: item.avatar_url,
            subscription_tier: item.subscription_tier
          }}
          size={40}
        />

        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentUserName}>{item.user_name}</Text>
            <Text style={styles.commentTime}>{formatTimeAgo(item.created_at)}</Text>
          </View>

          <Text style={styles.commentText}>{item.comment_text}</Text>

          {item.likes > 0 && (
            <View style={styles.commentLikesRow}>
              <Image
                source={require('../assets/icons/heart-filled.png')}
                style={styles.commentLikeIcon}
                resizeMode="contain"
              />
              <Text style={styles.commentLikesCount}>{item.likes}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.commentLikeButton}
          onPress={() => toggleCommentLike(item.id, item.currentUserLiked)}
        >
          <Image
            source={item.currentUserLiked
              ? require('../assets/icons/heart-filled.png')
              : require('../assets/icons/heart-outline.png')
            }
            style={styles.commentLikeButtonIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.centerContainer}>
        <Text>Post not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Post Info */}
      <View style={styles.postInfo}>
        <View style={styles.postInfoText}>
          <Text style={styles.postInfoTitle}>{post.title}</Text>
          <View style={styles.postInfoMeta}>
            <Text style={styles.postInfoName}>{post.user_name}</Text>
            <Text style={styles.postInfoDot}> • </Text>
            <Image
              source={COOKING_METHOD_ICON_IMAGES[post.cooking_method || 'cook']}
              style={styles.postInfoIcon}
              resizeMode="contain"
            />
            <Text style={styles.postInfoDate}>{formatDateTime(post.created_at)}</Text>
          </View>
        </View>
      </View>

      {/* Yas Chefs Section */}
      {yasChefCount > 0 && (
        <TouchableOpacity
          style={styles.yasChefsSection}
          onPress={toggleYasChef}
          activeOpacity={0.7}
        >
          <Image
            source={currentUserYasChef
              ? require('../assets/icons/like-outline-2-filled.png')
              : require('../assets/icons/like-outline-2-thick.png')
            }
            style={[
              styles.yasChefsSectionIcon,
              currentUserYasChef && { tintColor: colors.primary }
            ]}
            resizeMode="contain"
          />
          <Text style={styles.yasChefsCount}>{yasChefCount}</Text>
          <View style={styles.avatarStack}>
            {yasChefs.slice(0, 10).map((like, index) => (
              <View
                key={like.user_id}
                style={{ marginLeft: index > 0 ? -8 : 0, zIndex: 10 - index }}
              >
                <UserAvatar
                  user={{
                    avatar_url: like.avatar_url,
                    subscription_tier: like.subscription_tier
                  }}
                  size={28}
                />
              </View>
            ))}
          </View>
        </TouchableOpacity>
      )}

      {/* Yas Chef Button (when no likes yet) */}
      {yasChefCount === 0 && (
        <TouchableOpacity
          style={styles.yasChefButtonSimple}
          onPress={toggleYasChef}
        >
          <Image
            source={require('../assets/icons/like-outline-2-thick.png')}
            style={styles.yasChefButtonSimpleIcon}
            resizeMode="contain"
          />
          <Text style={styles.yasChefButtonSimpleText}>Yas Chef</Text>
        </TouchableOpacity>
      )}

      {/* Comments List */}
      <FlatList
        data={comments}
        renderItem={renderComment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.commentsList}
        ListEmptyComponent={
          <View style={styles.emptyComments}>
            <Text style={styles.emptyCommentsText}>No comments yet. Be the first!</Text>
          </View>
        }
      />

      {/* Comment Input */}
      <View style={styles.inputContainer}>
        <TextInput
          ref={textInputRef}
          style={styles.input}
          placeholder="Add a comment"
          placeholderTextColor={colors.text.tertiary}
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={submitComment}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!commentText.trim() || submitting) && styles.sendButtonDisabled
          ]}
          onPress={submitComment}
          disabled={!commentText.trim() || submitting}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
