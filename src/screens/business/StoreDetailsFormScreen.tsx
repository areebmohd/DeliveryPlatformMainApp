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
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Geolocation from '@react-native-community/geolocation';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { supabase, uploadImage, deleteFile } from '../../api/supabase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { SafeTopBackground } from '../../components/ui/SafeTopBackground';

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
  const [phone, setPhone] = useState(store?.phone || '');
  const [email, setEmail] = useState(store?.email || '');
  const [instagramUrl, setInstagramUrl] = useState(store?.instagram_url || '');
  const [facebookUrl, setFacebookUrl] = useState(store?.facebook_url || '');
  const [whatsappNumber, setWhatsappNumber] = useState(store?.whatsapp_number || '');
  const [addressLine1, setAddressLine1] = useState(store?.address_line_1 || '');
  const [pincode, setPincode] = useState(store?.pincode || '');
  const [sectorArea, setSectorArea] = useState(store?.sector_area || '');
  const [city, setCity] = useState(store?.city || '');
  const [state, setState] = useState(store?.state || '');
  const [location, setLocation] = useState<any>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
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

  useEffect(() => {
    // Parse location if it exists in store params
    if (store?.location_wkt) {
      const match = store.location_wkt.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
      if (match) {
        setLocation({
          longitude: parseFloat(match[1]),
          latitude: parseFloat(match[2]),
        });
      }
    } else if (store?.location && typeof store.location === 'string' && !store.location.startsWith('0101')) {
      // Basic check for WKT if passed directly
      const match = store.location.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
      if (match) {
        setLocation({
          longitude: parseFloat(match[1]),
          latitude: parseFloat(match[2]),
        });
      }
    }
  }, [store]);

  const showAlert = (title: string, message: string, type: any = 'info', onConfirm?: () => void) => {
    setAlertConfig({ visible: true, title, message, type, onConfirm });
  };

  const getCurrentLocation = async () => {
    setFetchingLocation(true);

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'We need access to your location to pinpoint your store on the map.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setFetchingLocation(false);
          showAlert('Permission Denied', 'Location permission is required to use this feature.', 'error');
          return;
        }
      } catch (err) {
        setFetchingLocation(false);
        console.warn(err);
        return;
      }
    }

    Geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setFetchingLocation(false);
      },
      (error) => {
        setFetchingLocation(false);
        showAlert(
          'Location Error',
          'Could not get your current location. Please ensure GPS is enabled.',
          'error'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
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
    if (!user?.id) return; // Assuming 'unsubscribe' is not defined here, changed to 'return'

    try {
      setIsUploadingBanner(true);
      
      // Delete old banner if exists
      if (bannerUrl) {
        await deleteFile('banners', bannerUrl);
      }

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
    if (!name || !addressLine1 || !city || !state || !pincode) {
      showAlert('Required Info', 'Please fill in all required address fields', 'warning');
      return;
    }

    try {
      setLoading(true);
      const storeData: any = {
        owner_id: user?.id,
        name,
        description,
        address: `${addressLine1}, ${city}`, // Keep legacy address field updated
        address_line_1: addressLine1,
        city,
        state,
        pincode,
        sector_area: sectorArea,
        category,
        upi_id: upiId,
        banner_url: bannerUrl,
        opening_hours: openingHours,
        phone,
        email,
        instagram_url: instagramUrl,
        facebook_url: facebookUrl,
        whatsapp_number: whatsappNumber,
      };

      if (location) {
        storeData.location = `POINT(${location.longitude} ${location.latitude})`;
      } else if (store?.location) {
        storeData.location = store.location;
      } else {
        // Fallback or leave as is if not set
        storeData.location = 'POINT(77.0266 28.4595)';
      }

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
      <SafeTopBackground />
      <View style={[styles.header, { paddingTop: Spacing.sm }]}>
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
          <Text style={styles.sectionTitle}>Store Address</Text>
          <Input label="Address Line 1" value={addressLine1} onChangeText={setAddressLine1} placeholder="Flat/House No, Building, Street" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input label="Pin Code" value={pincode} onChangeText={setPincode} placeholder="122001" keyboardType="numeric" />
            </View>
            <View style={{ width: 16 }} />
            <View style={{ flex: 1 }}>
              <Input label="Sector/Area (Optional)" value={sectorArea} onChangeText={setSectorArea} placeholder="Sector 45" />
            </View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input label="City" value={city} onChangeText={setCity} placeholder="Gurugram" />
            </View>
            <View style={{ width: 16 }} />
            <View style={{ flex: 1 }}>
              <Input label="State" value={state} onChangeText={setState} placeholder="Haryana" />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live Location</Text>
          <Text style={styles.subtitle}>Pinpoint your store's exact location for riders</Text>
          
          <View style={styles.mapContainer}>
            {fetchingLocation ? (
              <View style={styles.mapLoading}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Fetching location...</Text>
              </View>
            ) : (
              <View style={styles.mapView}>
                <View style={styles.markerContainer}>
                  <View style={styles.pulse} />
                  <View style={styles.marker}>
                    <Icon name="store" size={30} color={Colors.white} />
                  </View>
                </View>
                {location && (
                  <View style={styles.locationBadge}>
                    <Icon name="check-circle" size={16} color={Colors.success} />
                    <Text style={styles.locationBadgeText}>Location Set</Text>
                  </View>
                )}
                {location && (
                  <Text style={styles.coordsText}>
                    Lat: {location.latitude.toFixed(4)}, Lng: {location.longitude.toFixed(4)}
                  </Text>
                )}
              </View>
            )}
          </View>

          <Button 
            title={location ? "Update Live Location" : "Set Live Location"}
            onPress={getCurrentLocation}
            variant="outline"
            style={{ marginTop: 16 }}
            loading={fetchingLocation}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Info</Text>
          <Input label="Store Phone" value={phone} onChangeText={setPhone} placeholder="e.g. +91 9876543210" keyboardType="phone-pad" />
          <Input label="Store Email" value={email} onChangeText={setEmail} placeholder="e.g. contact@store.com" keyboardType="email-address" autoCapitalize="none" />
          <Input label="WhatsApp Number" value={whatsappNumber} onChangeText={setWhatsappNumber} placeholder="For customer queries" keyboardType="phone-pad" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social Media</Text>
          <Input label="Instagram URL" value={instagramUrl} onChangeText={setInstagramUrl} placeholder="instagram.com/yourstore" autoCapitalize="none" />
          <Input label="Facebook URL" value={facebookUrl} onChangeText={setFacebookUrl} placeholder="facebook.com/yourstore" autoCapitalize="none" />
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
        showCancel={alertConfig.type !== 'success'}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  mapContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  mapLoading: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  mapView: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    zIndex: 2,
  },
  pulse: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    opacity: 0.2,
  },
  locationBadge: {
    position: 'absolute',
    bottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    elevation: 2,
  },
  locationBadgeText: {
    marginLeft: 4,
    fontWeight: '700',
    color: Colors.text,
    fontSize: 12,
  },
  coordsText: {
    position: 'absolute',
    top: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    fontSize: 10,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
});
