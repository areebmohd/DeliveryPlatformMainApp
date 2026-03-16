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

import { AlertModal } from '../../components/ui/AlertModal';

const { width } = Dimensions.get('window');
const BANNER_HEIGHT = width * (10 / 16);

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

  // Alert Modal state
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertConfig({ visible: true, title, message, type, onConfirm });
  };

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
      showAlert('Error', error.message || 'Could not upload banner', 'error');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSaveStore = async () => {
    if (!name || !address) {
      showAlert('Required Info', 'Please provide store name and address', 'warning');
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

      showAlert('Success', 'Store profile updated successfully!', 'success', () => {
        navigation.goBack();
      });
    } catch (e: any) {
      showAlert('Error', e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Store</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Branding</Text>
          <Text style={styles.inputLabel}>Store Banner</Text>
          <TouchableOpacity 
            style={styles.bannerPicker} 
            onPress={pickImage}
            disabled={isUploadingBanner}
          >
            {bannerUrl ? (
              <Image source={{ uri: bannerUrl }} style={styles.pickedImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Icon name="image-plus" size={40} color={Colors.primary} />
                <Text style={styles.imagePlaceholderText}>Upload Store Banner</Text>
              </View>
            )}
            {isUploadingBanner && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store Profile</Text>
          <Input label="Store Name" value={name} onChangeText={setName} placeholder="e.g. Daily Needs Supermarket" />
          <Input label="Category" value={category} onChangeText={setCategory} placeholder="e.g. Grocery, Pharmacy" />
          <Input label="Description" value={description} onChangeText={setDescription} placeholder="About your store..." multiline numberOfLines={3} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location & Hours</Text>
          <Input label="Address" value={address} onChangeText={setAddress} placeholder="Full building/street address" multiline numberOfLines={2} />
          <Input label="Opening Hours" value={openingHours} onChangeText={setOpeningHours} placeholder="e.g. 8 AM - 10 PM" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payments</Text>
          <Input label="UPI ID" value={upiId} onChangeText={setUpiId} placeholder="yourname@upi" />
          <Text style={styles.helperText}>Your payments will be credited to this UPI ID.</Text>
        </View>
        
        <Button 
          title="Save Store Details" 
          onPress={handleSaveStore} 
          loading={loading} 
          style={styles.submitButton}
        />
      </ScrollView>

      <AlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
        primaryAction={alertConfig.onConfirm ? {
          text: 'Confirm',
          onPress: alertConfig.onConfirm,
        } : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
    marginLeft: 2,
  },
  bannerPicker: {
    width: '100%',
    height: BANNER_HEIGHT * 0.7,
    backgroundColor: Colors.primaryLight,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickedImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helperText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: -8,
    marginLeft: 2,
  },
  submitButton: {
    marginTop: Spacing.md,
    elevation: 4,
  },
});
