import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Colors, Spacing, borderRadius } from '../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

interface StoreCardProps {
  store: {
    id: string;
    name: string;
    description: string;
    category: string;
    banner_url?: string;
    distance?: string;
    rating?: number;
  };
  onPress: () => void;
}

export const StoreCard = ({ store, onPress }: StoreCardProps) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.imageContainer}>
        {store.banner_url ? (
          <Image source={{ uri: store.banner_url }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholderImage]}>
            <Icon name="storefront-outline" size={48} color={Colors.textSecondary} />
          </View>
        )}
        <View style={styles.distanceBadge}>
          <Text style={styles.distanceText}>{store.distance || '2.4 km'}</Text>
        </View>
      </View>
      
      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{store.name}</Text>
          <View style={styles.ratingRow}>
            <Icon name="star" size={16} color="#FFD700" />
            <Text style={styles.ratingText}>{store.rating || '4.5'}</Text>
          </View>
        </View>
        
        <Text style={styles.category} numberOfLines={1}>
          {store.category} • Grocery • 20-30 mins
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  imageContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: Colors.glass,
    borderRadius: borderRadius.round,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  infoContainer: {
    padding: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 2,
  },
  category: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
