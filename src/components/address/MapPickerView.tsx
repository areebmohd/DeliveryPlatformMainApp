import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { MapView, Camera, PointAnnotation } from 'mappls-map-react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing } from '../../theme/colors';

const { width } = Dimensions.get('window');

interface MapPickerViewProps {
  location: {
    latitude: number;
    longitude: number;
  } | null;
  onPress: () => void;
  label?: string;
}

export const MapPickerView: React.FC<MapPickerViewProps> = ({ location, onPress, label = 'Select Location' }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity 
        style={styles.mapWrapper} 
        onPress={onPress}
        activeOpacity={0.8}
      >
        {location ? (
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              enableTraffic={false}
              enableTrafficClosure={false}
              enableTrafficFreeFlow={false}
              enableTrafficNonFreeFlow={false}
              enableTrafficStopIcon={false}
            >
              <Camera
                zoomLevel={14}
                centerCoordinate={[location.longitude, location.latitude]}
              />
              <PointAnnotation
                id="marker"
                coordinate={[location.longitude, location.latitude]}
              >
                <View style={styles.markerContainer}>
                  <Icon name="map-marker" size={30} color={Colors.primary} />
                </View>
              </PointAnnotation>
            </MapView>
            <View style={styles.overlay}>
              <View style={styles.changeBtn}>
                <Icon name="pencil" size={16} color={Colors.white} />
                <Text style={styles.changeText}>Change</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Icon name="map-marker-plus" size={40} color={Colors.primary} />
            <Text style={styles.placeholderText}>Tap to pinpoint location on map</Text>
            <Text style={styles.placeholderSub}>Required for accurate delivery</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    marginLeft: 2,
  },
  mapWrapper: {
    width: '100%',
    height: 150,
    borderRadius: 16,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 20,
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  placeholderSub: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 12,
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  changeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
