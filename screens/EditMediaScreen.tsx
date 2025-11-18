// screens/EditMediaScreen.tsx
// Edit and manage photos for a post (like Strava's Edit Media)
// November 16, 2025
// CORRECTED: Imports PostPhoto from App.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { chooseImageSource, uploadPostImages } from '../lib/services/imageStorageService';
import { MyPostsStackParamList, PostPhoto } from '../App'; // Import types from App

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = (SCREEN_WIDTH - 48) / 3; // 3 columns with padding

type Props = NativeStackScreenProps<MyPostsStackParamList, 'EditMedia'>;

export default function EditMediaScreen({ navigation, route }: Props) {
  const { postId, existingPhotos } = route.params;

  const [photos, setPhotos] = useState<PostPhoto[]>(existingPhotos || []);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const handleAddPhotos = async () => {
    if (photos.length >= 10) {
      Alert.alert('Maximum Photos', 'You can add up to 10 photos per post.');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    const uri = await chooseImageSource();
    if (!uri) return;

    setLoading(true);
    try {
      // Upload single photo
      const uploadedPhotos = await uploadPostImages([uri], currentUserId);
      
      if (uploadedPhotos.length === 0) {
        throw new Error('Upload failed');
      }

      // Add to photos array
      const newPhoto: PostPhoto = {
        url: uploadedPhotos[0].url,
        order: photos.length + 1,
        is_highlight: photos.length === 0, // First photo is highlight
      };

      setPhotos([...photos, newPhoto]);
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhoto = (index: number) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const newPhotos = photos.filter((_, i) => i !== index);
            
            // If we deleted the highlight, make the first photo the new highlight
            const reorderedPhotos = newPhotos.map((photo, i) => ({
              ...photo,
              order: i + 1,
              is_highlight: i === 0
            }));
            
            setPhotos(reorderedPhotos);
          },
        },
      ]
    );
  };

  const handleSetHighlight = (index: number) => {
    const newPhotos = photos.map((photo, i) => ({
      ...photo,
      is_highlight: i === index
    }));
    setPhotos(newPhotos);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({ photos })
        .eq('id', postId);

      if (error) throw error;

      Alert.alert('Success', 'Photos updated successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack()
        }
      ]);
    } catch (error) {
      console.error('Error saving photos:', error);
      Alert.alert('Error', 'Failed to save photos. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const sortedPhotos = [...photos].sort((a, b) => {
    if (a.is_highlight) return -1;
    if (b.is_highlight) return 1;
    return a.order - b.order;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Edit Media</Text>
        
        <TouchableOpacity 
          onPress={handleSave}
          style={styles.headerButton}
          disabled={saving}
        >
          <Text style={[
            styles.headerButtonText, 
            styles.headerButtonSave,
            saving && styles.headerButtonDisabled
          ]}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Photos Grid */}
      <ScrollView style={styles.content} contentContainerStyle={styles.gridContainer}>
        {sortedPhotos.map((photo, index) => (
          <View key={`photo-${index}`} style={styles.photoCard}>
            <Image source={{ uri: photo.url }} style={styles.photoThumbnail} />
            
            {/* Highlight badge */}
            {photo.is_highlight && (
              <View style={styles.highlightBadge}>
                <Text style={styles.highlightText}>Highlight</Text>
              </View>
            )}
            
            {/* Action buttons */}
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDeletePhoto(index)}
              >
                <Text style={styles.actionButtonText}>Delete</Text>
              </TouchableOpacity>
              
              {!photo.is_highlight && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonPrimary]}
                  onPress={() => handleSetHighlight(index)}
                >
                  <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                    Set as Highlight
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {/* Add Photo Button */}
        {photos.length < 10 && (
          <TouchableOpacity 
            style={styles.addPhotoCard}
            onPress={handleAddPhotos}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="large" color="#007AFF" />
            ) : (
              <>
                <Text style={styles.addPhotoIcon}>📷</Text>
                <Text style={styles.addPhotoText}>
                  Add Photo ({photos.length}/10)
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsText}>
          • The highlighted photo appears first on your post
        </Text>
        <Text style={styles.instructionsText}>
          • Tap "Set as Highlight" to change which photo shows first
        </Text>
        <Text style={styles.instructionsText}>
          • Swipe left on your post to view all photos
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    padding: 8,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerButtonSave: {
    fontWeight: '600',
  },
  headerButtonDisabled: {
    color: '#999',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  gridContainer: {
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  photoCard: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE + 60,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  photoThumbnail: {
    width: '100%',
    height: PHOTO_SIZE,
  },
  highlightBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  highlightText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  photoActions: {
    flexDirection: 'column',
    padding: 8,
    gap: 6,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  actionButtonTextPrimary: {
    color: '#fff',
  },
  addPhotoCard: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE + 60,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  addPhotoIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  addPhotoText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  instructions: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  instructionsText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
});