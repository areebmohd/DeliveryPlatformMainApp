import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Colors, Spacing, borderRadius } from '../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { formatPriceShort } from '../utils/format';

interface CustomerProductCardProps {
  product: {
    id: string;
    name: string;
    description?: string;
    price: number;
    weight_kg?: number;
    category?: string;
    image_url?: string;
    barcode?: string;
    product_type?: string;
  };
  onAdd?: (product: any) => void;
  quantity?: number;
  onIncrease?: () => void;
  onDecrease?: () => void;
  onPress?: () => void;
  width?: any;
}

export const CustomerProductCard = React.memo(({ 
  product, 
  onAdd,
  quantity = 0,
  onIncrease,
  onDecrease,
  onPress,
  width = '100%',
}: CustomerProductCardProps) => {
  return (
    <TouchableOpacity 
      style={[styles.container, { width }]} 
      onPress={() => onPress?.(product)}
      activeOpacity={onPress ? 0.9 : 1}
      disabled={!onPress}
    >
      <View style={styles.imageContainer}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Icon name="package-variant" size={30} color={Colors.border} />
          </View>
        )}
        {onAdd && (
          <View style={styles.controlsLayer}>
            {quantity > 0 ? (
              <View style={styles.quantityControls}>
                <TouchableOpacity onPress={() => onDecrease?.(product)} style={styles.controlBtn}>
                  <Icon name="minus" size={14} color={Colors.white} />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{quantity}</Text>
                <TouchableOpacity onPress={() => onIncrease?.(product)} style={styles.controlBtn}>
                  <Icon name="plus" size={14} color={Colors.white} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.addButton} 
                onPress={() => onAdd?.(product)}
                activeOpacity={0.8}
              >
                <Icon name="plus" size={18} color={Colors.white} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{formatPriceShort(product.price)}</Text>
          {product.weight_kg ? (
            <Text style={styles.weight}>
               / {product.weight_kg < 1 ? `${product.weight_kg * 1000}gm` : `${product.weight_kg}kg`}
            </Text>
          ) : null}
        </View>

        <Text style={styles.name} numberOfLines={2}>
          {product.name || `Barcode: ${product.barcode}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    backgroundColor: Colors.primaryLight,
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: Colors.white,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  controlsLayer: {
    position: 'absolute',
    bottom: -4,
    right: -4,
  },
  addButton: {
    backgroundColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    padding: 3,
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  controlBtn: {
    padding: 3,
  },
  quantityText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 6,
  },
  content: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  weight: {
    fontSize: 11,
    color: Colors.primary,
    opacity: 0.8,
    marginLeft: 2,
  },
  name: {
    fontSize: 12.5,
    fontWeight: '500',
    color: Colors.text,
    height: 34,
    lineHeight: 17,
  },
});
