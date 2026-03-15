import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
  Image,
} from 'react-native';
import { Colors, Spacing, borderRadius } from '../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    in_stock: boolean;
    weight_kg?: number;
    category?: string;
    image_url?: string;
  };
  onToggleStock: (id: string, currentStatus: boolean) => void;
  onEdit: (product: any) => void;
  onDelete: (id: string) => void;
}

export const BusinessProductCard = ({ 
  product, 
  onToggleStock, 
  onEdit, 
  onDelete 
}: ProductCardProps) => {
  return (
    <View style={styles.container}>
      {product.image_url ? (
        <Image source={{ uri: product.image_url }} style={styles.productImage} />
      ) : (
        <View style={[styles.productImage, styles.imagePlaceholder]}>
          <Icon name="package-variant" size={24} color={Colors.textSecondary} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.category}>{product.category || 'Standard'}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{product.price}</Text>
          {product.weight_kg ? (
            <Text style={styles.weight}> • {product.weight_kg} kg</Text>
          ) : null}
        </View>
      </View>
      
      <View style={styles.actions}>
        <View style={styles.stockToggle}>
          <Text style={[styles.stockText, !product.in_stock && styles.outOfStockText]}>
            {product.in_stock ? 'Live' : 'Off'}
          </Text>
          <Switch
            value={product.in_stock}
            onValueChange={() => onToggleStock(product.id, product.in_stock)}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={Colors.white}
          />
        </View>
        
        <View style={styles.iconButtons}>
          <TouchableOpacity onPress={() => onEdit(product)} style={styles.iconButton}>
            <Icon name="pencil" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(product.id)} style={styles.iconButton}>
            <Icon name="delete-outline" size={18} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    marginRight: Spacing.md,
    backgroundColor: Colors.surface,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  category: {
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  weight: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  actions: {
    alignItems: 'flex-end',
    marginLeft: Spacing.sm,
  },
  stockToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stockText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    marginRight: 6,
    textTransform: 'uppercase',
  },
  outOfStockText: {
    color: Colors.error,
  },
  iconButtons: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 12,
    padding: 6,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
