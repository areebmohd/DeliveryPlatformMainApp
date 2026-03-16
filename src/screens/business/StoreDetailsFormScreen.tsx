import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { supabase, uploadImage } from '../../api/supabase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';

const { width } = Dimensions.get('window');
const BANNER_HEIGHT = width * (9 / 16);

export const StoreDetailsFormScreen = ({ navigation, route }: any) => {
  const { user } = useAuth();
  const { store } = route.params || {};
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(store?.name || '');
  const [description, setDescription] = useState(store?.description || '');
  const [address, setAddress] = useState(store?.address || '');
  const [category, setCategory] = useState(store?.category || '');
  const [upiId, setUpiId] = useState(store?.upi_id || '');
  const [bannerUrl, setBannerUrl] = useState(store?.banner_url || '');
  const [openingHours, setOpeningHours] = useState(store?.opening_hours || '');
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const pickImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      quality: 0.7,
    });

    if (result.didCancel || !result.assets || result.assets.length === 0) return;

    const asset = result.assets[0];
    const base64 = asset.base64;
    if (!base64) return;

    try {
      setIsUploadingBanner(true);
      const fileName = `${user?.id}_b_${Date.now()}.jpg`;
      const publicUrl = await uploadImage('banners', fileName, base64);
      setBannerUrl(publicUrl);
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Could not upload image');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSaveStore = async () => {
    if (!name || !address) {
      Alert.alert('Error', 'Please provide store name and address');
      return;
    }

    try {
      setLoading(true);
      const storeData: any = {
        owner_id: user?.id,
        name,
        description,
        address,
        category,
        upi_id: upiId,
        banner_url: bannerUrl,
        opening_hours: openingHours,
        location: store?.location || 'SRID=4326;POINT(77.0266 28.4595)', 
      };

      if (store) {
        const { error } = await supabase
          .from('stores')
          .update(storeData)
          .eq('id', store.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('stores')
          .insert(storeData);
        if (error) throw error;
      }

      Alert.alert('Success', 'Store profile updated successfully!');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Store Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.inputLabel}>Store Banner</Text>
        <TouchableOpacity 
          style={styles.imagePickerButton} 
          onPress={pickImage}
          disabled={isUploadingBanner}
        >
          {bannerUrl ? (
            <Image source={{ uri: bannerUrl }} style={styles.pickedImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Icon name="camera-plus" size={32} color={Colors.textSecondary} />
              <Text style={styles.imagePlaceholderText}>Upload Banner</Text>
            </View>
          )}
          {isUploadingBanner && (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          )}
        </TouchableOpacity>

        <Input label="Store Name" value={name} onChangeText={setName} placeholder="Enter name" />
        <Input label="Category" value={category} onChangeText={setCategory} placeholder="Category" />
        <Input label="Description" value={description} onChangeText={setDescription} placeholder="Description" multiline />
        <Input label="Address" value={address} onChangeText={setAddress} placeholder="Full address" multiline />
        <Input label="Opening Hours" value={openingHours} onChangeText={setOpeningHours} placeholder="e.g. 9 AM - 9 PM" />
        <Input label="UPI ID" value={upiId} onChangeText={setUpiId} placeholder="UPI ID" />
        
        <Button 
          title="Save Changes" 
          onPress={handleSaveStore} 
          loading={loading} 
          style={styles.submitButton}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  imagePickerButton: {
    width: '100%',
    height: BANNER_HEIGHT * 0.7,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  pickedImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButton: {
    marginTop: Spacing.xl,
    marginBottom: 20,
  },
});
