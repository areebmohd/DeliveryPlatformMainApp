import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  PermissionsAndroid,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Geolocation from '@react-native-community/geolocation';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useCart } from '../../context/CartContext';
import { MapView, Camera, PointAnnotation } from 'mappls-map-react-native';
import MapplsGL from 'mappls-map-react-native';

const { width } = Dimensions.get('window');

export const AddLiveLocationScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(true);
  const [location, setLocation] = useState<any>(null);
  const { user, profile } = useAuth();
  const { setSessionAddress } = useCart();
  const { showAlert, showToast } = useAlert();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    setFetchingLocation(true);

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'We need access to your location to pinpoint your delivery address.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setFetchingLocation(false);
          showAlert({ title: 'Permission Denied', message: 'Location permission is required to use this feature.', type: 'error' });
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
        showAlert({
          title: 'Location Error',
          message: 'Could not get your current location. Please ensure GPS is enabled and permissions are granted.',
          type: 'error',
          primaryAction: { text: 'Retry', onPress: getCurrentLocation },
          showCancel: true,
          cancelText: 'Back',
          onClose: () => navigation.goBack(),
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const handleSave = async () => {
    if (!location) {
      showAlert({ title: 'Error', message: 'Location not found. Please try again.', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      
      // Store in session instead of database
      setSessionAddress({
        address_line: 'Live GPS Location',
        city: 'Live Location Area',
        state: 'Haryana',
        pincode: '',
        location: `SRID=4326;POINT(${location.longitude} ${location.latitude})`,
        label: `${profile?.full_name || 'My'}'s Live Location`
      });
      
      showToast('Using live location for this order!', 'success');
      navigation.goBack();
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Live Location</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Map Visualization */}
        <View style={styles.mapContainer}>
          {fetchingLocation ? (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Fetching your location...</Text>
            </View>
          ) : (
            <View style={styles.mapView}>
              <MapView 
                style={StyleSheet.absoluteFillObject}
                key={location ? `${location.latitude}-${location.longitude}` : 'no-location'}
              >
                <Camera 
                  centerCoordinate={location ? [location.longitude, location.latitude] : [77.2090, 28.6139]}
                  zoomLevel={16}
                />
                {location && (
                  <PointAnnotation
                    id="currentLocation"
                    coordinate={[location.longitude, location.latitude]}
                  >
                    <View style={styles.markerContainer}>
                      <View style={styles.pulse} />
                      <View style={styles.marker}>
                        <Icon name="map-marker" size={24} color={Colors.white} />
                      </View>
                    </View>
                  </PointAnnotation>
                )}
              </MapView>

              <View style={styles.locationBadge}>
                <Icon name="check-circle" size={16} color={Colors.success} />
                <Text style={styles.locationBadgeText}>Location Pinpointed</Text>
              </View>
              
              <Text style={styles.coordsText}>
                Lat: {location?.latitude?.toFixed(6)}, Lng: {location?.longitude?.toFixed(6)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.form}>
          <Button
            title={loading ? "Saving..." : "Save Delivery Location"}
            onPress={handleSave}
            loading={loading}
            disabled={fetchingLocation}
            style={styles.saveBtn}
          />
          
          {!fetchingLocation && (
            <TouchableOpacity onPress={getCurrentLocation} style={styles.retryBtn}>
              <Icon name="refresh" size={18} color={Colors.primary} />
              <Text style={styles.retryText}>Refresh Location</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: Colors.white,
    marginRight: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  mapContainer: {
    width: width,
    height: 300,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapLoading: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 2,
  },
  pulse: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary,
    opacity: 0.2,
  },
  locationBadge: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
  },
  locationBadgeText: {
    marginLeft: 6,
    fontWeight: '700',
    color: Colors.text,
    fontSize: 14,
  },
  coordsText: {
    position: 'absolute',
    top: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  form: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  saveBtn: {
    marginTop: 32,
    height: 56,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
  },
  retryText: {
    marginLeft: 8,
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
});
