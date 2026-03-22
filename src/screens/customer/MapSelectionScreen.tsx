import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {
  MapView,
  Camera,
  RestApi,
  // requestAndroidLocationPermissions, // Removed
  // UserLocation, // Commented out
} from 'mappls-map-react-native';
import MapplsGL from 'mappls-map-react-native';

import MapplsUIWidgets from 'mappls-search-widgets-react-native';
import { Colors, Spacing } from '../../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '../../context/AlertContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

export const MapSelectionScreen = ({ navigation, route }: any) => {
  const { initialLocation, returnScreen } = route.params || {};
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState<number[] | null>(
    initialLocation ? [initialLocation.longitude, initialLocation.latitude] : [77.2090, 28.6139]
  );
  const [address, setAddress] = useState<string>('');
  const [addressDetails, setAddressDetails] = useState<any>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  // Reverse Geocoding whenever map movement stops
  const fetchAddress = async (lng: number, lat: number) => {
    try {
      setIsReverseGeocoding(true);
      const res = await RestApi.reverseGeocode({ latitude: lat, longitude: lng });
      if (res && res.results && res.results.length > 0) {
        const result = res.results[0];
        setAddress(result.formatted_address || '');
        setAddressDetails(result);
      }
    } catch (e) {
      console.error('Reverse Geocode failed:', e);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const onRegionDidChange = async (feature: any) => {
    const [lng, lat] = feature.geometry.coordinates;
    setMapCenter([lng, lat]);
    fetchAddress(lng, lat);
  };

  const getCurrentLocation = async () => {
    setLoading(true);
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          showAlert({ title: 'Permission Denied', message: 'Please enable location permissions in settings.', type: 'error' });
          setLoading(false);
          return;
        }
      }

      // Use standard Geolocation for a fresh fix
      Geolocation.getCurrentPosition(
        (info) => {
          centerOnLocation(info.coords.latitude, info.coords.longitude);
          setLoading(false);
        },
        (error) => {
          console.error('Geolocation Error:', error);
          showAlert({ title: 'Location Error', message: 'Could not get your current location. Please check your GPS.', type: 'error' });
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } catch (e) {
      console.error('Location Error:', e);
      setLoading(false);
    }
  };

  const centerOnLocation = (lat: number, lng: number) => {
    setMapCenter([lng, lat]);
    cameraRef.current?.setCamera({
      centerCoordinate: [lng, lat],
      zoomLevel: 16,
      animationDuration: 1000,
    });
    fetchAddress(lng, lat);
  };

  const handleSearchPress = async () => {
    try {
      const data = await MapplsUIWidgets.searchWidget({
        location: mapCenter ? [mapCenter[1], mapCenter[0]] : undefined,
      });
      
      if (data && data.eLocation) {
        const { latitude, longitude, placeName, placeAddress } = data.eLocation;
        const fullAddress = placeAddress || placeName;
        setAddress(fullAddress);
        setMapCenter([longitude, latitude]);
        cameraRef.current?.setCamera({
          centerCoordinate: [longitude, latitude],
          zoomLevel: 16,
          animationDuration: 1000,
        });
        
        // After search, also fetch granular details for that location
        fetchAddress(longitude, latitude);
      }
    } catch (e) {
      console.error('Search Widget Error:', e);
    }
  };

  const handleConfirm = () => {
    if (mapCenter) {
      navigation.navigate({
        name: returnScreen || 'AddAddress',
        params: { 
          selectedLocation: {
            latitude: mapCenter[1],
            longitude: mapCenter[0],
            address: address,
            details: addressDetails,
            preservedFormData: route.params?.preservedFormData,
          }
        },
        merge: true,
      });
    }
  };

  useEffect(() => {
    const initLocation = async () => {
      let granted = true;
      if (Platform.OS === 'android') {
        const status = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (!status) {
          const request = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
          granted = request === PermissionsAndroid.RESULTS.GRANTED;
        }
      }
      setHasLocationPermission(granted);
    };

    initLocation();
    
    if (mapCenter) {
      fetchAddress(mapCenter[0], mapCenter[1]);
    }
  }, [mapCenter]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        onRegionDidChange={onRegionDidChange}
        enableTraffic={false}
        enableTrafficClosure={false}
        enableTrafficFreeFlow={false}
        enableTrafficNonFreeFlow={false}
        enableTrafficStopIcon={false}
      >
        <Camera
          ref={cameraRef}
          zoomLevel={14}
          centerCoordinate={mapCenter ?? [77.2090, 28.6139]}
        />
        {/*
        {hasLocationPermission && (
          <UserLocation 
            visible={true} 
            onUpdate={(loc) => {
              if (loc && loc.coords && !mapCenter) {
                setMapCenter([loc.coords.longitude, loc.coords.latitude]);
              }
            }}
          />
        )}
        */}
      </MapView>

      {/* Center Pin */}
      <View style={styles.markerFixed} pointerEvents="none">
        <Icon name="map-marker" size={40} color={Colors.primary} />
      </View>

      {/* Header with Search Mock */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.searchRow}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color={Colors.text} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.searchBarMock}
            onPress={handleSearchPress}
          >
            <Icon name="magnify" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
            <Text style={styles.searchPlaceholder} numberOfLines={1}>
              {address || "Search for location..."}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Location Badge (Loading Indicator) */}
      {isReverseGeocoding && (
        <View style={styles.geocodingBadge}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.geocodingText}>Getting address...</Text>
        </View>
      )}

      {/* Footer Actions */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <TouchableOpacity 
          style={styles.liveLocationBtn}
          onPress={getCurrentLocation}
          disabled={loading}
        >
          <Icon name="crosshairs-gps" size={20} color={Colors.primary} />
          <Text style={styles.liveLocationText}>Use Live Location</Text>
          {loading && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.confirmBtn}
          onPress={handleConfirm}
        >
          <Text style={styles.confirmText}>Confirm Location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  map: {
    flex: 1,
  },
  markerFixed: {
    left: '50%',
    marginLeft: -20,
    marginTop: -40,
    position: 'absolute',
    top: '50%',
    zIndex: 2,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    zIndex: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  searchBarMock: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 20,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  searchPlaceholder: {
    color: '#9CA3AF',
    fontSize: 14,
    flex: 1,
  },
  geocodingBadge: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    elevation: 2,
    zIndex: 5,
  },
  geocodingText: {
    marginLeft: 6,
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    gap: 12,
  },
  liveLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  liveLocationText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  confirmText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
});
