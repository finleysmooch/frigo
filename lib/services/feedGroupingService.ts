// lib/services/feedGroupingService.ts
// Service for grouping linked posts in the feed (Strava-style)
// Created: November 20, 2025

import { supabase } from '../supabase';

export interface GroupedPost {
  type: 'grouped';
  id: string; // Use the earliest post ID as the group ID
  mainPost: any;
  linkedPosts: any[];
  relationshipType: 'dish_pair' | 'meal_group';
}

export interface SinglePost {
  type: 'single';
  post: any;
}

export type FeedItem = GroupedPost | SinglePost;

/**
 * Get all post relationships for a set of posts
 */
async function getPostRelationships(postIds: string[]): Promise<Map<string, Set<string>>> {
  try {
    const { data, error } = await supabase
      .from('post_relationships')
      .select('post_id_1, post_id_2, relationship_type')
      .or(`post_id_1.in.(${postIds.join(',')}),post_id_2.in.(${postIds.join(',')})`);

    if (error) throw error;

    // Build a map of post_id -> set of related post_ids
    const relationshipsMap = new Map<string, Set<string>>();
    
    data?.forEach(rel => {
      // Add bidirectional relationships
      if (!relationshipsMap.has(rel.post_id_1)) {
        relationshipsMap.set(rel.post_id_1, new Set());
      }
      if (!relationshipsMap.has(rel.post_id_2)) {
        relationshipsMap.set(rel.post_id_2, new Set());
      }
      
      relationshipsMap.get(rel.post_id_1)!.add(rel.post_id_2);
      relationshipsMap.get(rel.post_id_2)!.add(rel.post_id_1);
    });

    return relationshipsMap;
  } catch (error) {
    console.error('Error getting post relationships:', error);
    return new Map();
  }
}

/**
 * Group connected posts together using Union-Find algorithm
 */
function groupConnectedPosts(
  posts: any[],
  relationshipsMap: Map<string, Set<string>>
): Map<string, Set<string>> {
  const groups = new Map<string, Set<string>>();
  const visited = new Set<string>();

  function dfs(postId: string, currentGroup: Set<string>) {
    if (visited.has(postId)) return;
    visited.add(postId);
    currentGroup.add(postId);

    const relatedPosts = relationshipsMap.get(postId);
    if (relatedPosts) {
      relatedPosts.forEach(relatedId => {
        if (!visited.has(relatedId)) {
          dfs(relatedId, currentGroup);
        }
      });
    }
  }

  posts.forEach(post => {
    if (!visited.has(post.id)) {
      const group = new Set<string>();
      dfs(post.id, group);
      
      if (group.size > 1) {
        // Use the earliest post ID as the group key
        const sortedIds = Array.from(group).sort();
        groups.set(sortedIds[0], group);
      }
    }
  });

  return groups;
}

/**
 * Transform a list of posts into feed items (grouped and single)
 */
export async function groupPostsForFeed(posts: any[]): Promise<FeedItem[]> {
  if (posts.length === 0) return [];

  const postIds = posts.map(p => p.id);
  const relationshipsMap = await getPostRelationships(postIds);

  // Group connected posts
  const groups = groupConnectedPosts(posts, relationshipsMap);

  // Create a map for quick post lookup
  const postMap = new Map(posts.map(p => [p.id, p]));

  // Track which posts are already in groups
  const postsInGroups = new Set<string>();

  // Create feed items
  const feedItems: FeedItem[] = [];

  // Add grouped posts
  groups.forEach((postIds, groupId) => {
    const postIdArray = Array.from(postIds);
    const groupPosts = postIdArray
      .map(id => postMap.get(id))
      .filter(Boolean)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (groupPosts.length > 1) {
      const [mainPost, ...linkedPosts] = groupPosts;
      
      feedItems.push({
        type: 'grouped',
        id: groupId,
        mainPost,
        linkedPosts,
        relationshipType: 'dish_pair', // Could be enhanced to detect type
      });

      postIdArray.forEach(id => postsInGroups.add(id));
    }
  });

  // Add single posts (not in any group)
  posts.forEach(post => {
    if (!postsInGroups.has(post.id)) {
      feedItems.push({
        type: 'single',
        post,
      });
    }
  });

  // Sort all feed items by creation date (use mainPost date for groups)
  feedItems.sort((a, b) => {
    const dateA = a.type === 'grouped' 
      ? new Date(a.mainPost.created_at).getTime()
      : new Date(a.post.created_at).getTime();
    const dateB = b.type === 'grouped'
      ? new Date(b.mainPost.created_at).getTime()
      : new Date(b.post.created_at).getTime();
    return dateB - dateA; // Newest first
  });

  return feedItems;
}

/**
 * Check if a specific post is part of a group
 */
export async function isPostInGroup(postId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('post_relationships')
      .select('id')
      .or(`post_id_1.eq.${postId},post_id_2.eq.${postId}`)
      .limit(1)
      .single();

    return !!data;
  } catch (error) {
    return false;
  }
}