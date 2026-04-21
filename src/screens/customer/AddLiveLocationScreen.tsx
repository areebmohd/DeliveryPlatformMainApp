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
  StatusBar,
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Live Location</Text>
      </View>

      <View style={styles.content}>
        {fetchingLocation ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Fetching your location...</Text>
          </View>
        ) : (
          <View style={styles.mapWrapper}>
            <MapView 
              style={StyleSheet.absoluteFillObject}
              onCameraChanged={(e: any) => {
                // Mappls v2 / Mapbox based structure
                const center = e.geometry?.coordinates || e.properties?.center || e.nativeEvent?.payload?.center;
                if (center && Array.isArray(center)) {
                  setLocation({
                    latitude: center[1],
                    longitude: center[0]
                  });
                }
              }}
              onRegionDidChange={(e: any) => {
                // Fallback for some versions
                const center = e.geometry?.coordinates || e.properties?.center || e.nativeEvent?.payload?.center;
                if (center && Array.isArray(center)) {
                  setLocation({
                    latitude: center[1],
                    longitude: center[0]
                  });
                }
              }}
            >
              <Camera 
                centerCoordinate={location ? [location.longitude, location.latitude] : [77.2090, 28.6139]}
                zoomLevel={16}
              />
            </MapView>

            {/* Static Center Marker Overlay */}
            <View style={styles.centerMarkerOverlay} pointerEvents="none">
              <View style={styles.markerContainer}>
                <View style={styles.pulse} />
                <Icon name="map-marker" size={42} color={Colors.primary} />
              </View>
            </View>

            {/* Repositioned Overlays */}
            <View style={styles.pinNotification}>
              <View style={styles.locationBadge}>
                <Icon name="check-circle" size={16} color={Colors.success} />
                <Text style={styles.locationBadgeText}>Location Pinpointed</Text>
              </View>
            </View>

            <View style={[styles.locationMetaContainer, { bottom: insets.bottom + 100 }]}>
              <TouchableOpacity 
                onPress={getCurrentLocation} 
                style={styles.refreshTextBtn}
              >
                <Text style={styles.refreshBtnText}>Refresh</Text>
              </TouchableOpacity>

              {location && (
                <View style={styles.coordinatesWrapper}>
                  <Text style={styles.coordsText}>
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
              <Button
                title={loading ? "Saving..." : "Save Delivery Location"}
                onPress={handleSave}
                loading={loading}
                disabled={fetchingLocation}
                style={styles.saveBtn}
              />
            </View>
          </View>
        )}
      </View>
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
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.white,
    zIndex: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'transparent',
    marginRight: Spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  centerMarkerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -21, // Shift up so the tip (bottom) of the marker is at the center
  },
  marker: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
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
  pinNotification: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  locationBadgeText: {
    marginLeft: 6,
    fontWeight: '800',
    color: Colors.text,
    fontSize: 13,
  },
  locationMetaContainer: {
    position: 'absolute',
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  },
  coordinatesWrapper: {
    zIndex: 5,
  },
  coordsText: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: Colors.white,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
  },
  refreshTextBtn: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  refreshBtnText: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    zIndex: 10,
  },
  saveBtn: {
    height: 58,
    borderRadius: 18,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
});
