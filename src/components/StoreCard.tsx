import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  DimensionValue,
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
    city?: string;
    banner_url?: string;
  };
  onPress: () => void;
  width?: DimensionValue;
  horizontal?: boolean;
}

export const StoreCard = React.memo(({ store, onPress, width, horizontal }: StoreCardProps) => {
  return (
    <TouchableOpacity
      style={[
        styles.container, 
        width ? { width } : null,
        horizontal ? { marginBottom: 0, marginRight: Spacing.md } : null
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={[styles.imageContainer, horizontal ? { aspectRatio: 2 / 1 } : null]}>
        {store.banner_url ? (
          <Image source={{ uri: store.banner_url }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholderImage]}>
            <Icon name="storefront-outline" size={48} color={Colors.textSecondary} />
          </View>
        )}
      </View>
      
      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{store.name}</Text>
        </View>
        
        <View style={styles.badgeRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{store.category}</Text>
          </View>
          {store.city && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{store.city}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

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
    aspectRatio: 2 / 1,
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
  infoContainer: {
    padding: Spacing.md,
    paddingTop: Spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
