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

interface CustomerProductCardProps {
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    weight_kg?: number;
    category?: string;
  };
  onAdd: (product: any) => void;
  quantity?: number;
  onIncrease?: () => void;
  onDecrease?: () => void;
}

export const CustomerProductCard = ({ 
  product, 
  onAdd,
  quantity = 0,
  onIncrease,
  onDecrease 
}: CustomerProductCardProps) => {
  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.name}>{product.name}</Text>
        {product.description ? (
          <Text style={styles.description} numberOfLines={2}>{product.description}</Text>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={styles.price}>₹{product.price}</Text>
          {product.weight_kg ? (
            <Text style={styles.weight}>
              • {product.weight_kg < 1 ? `${product.weight_kg * 1000} gm` : `${product.weight_kg} kg`}
            </Text>
          ) : null}
        </View>
      </View>
      
      <View style={styles.actionContainer}>
        {quantity > 0 ? (
          <View style={styles.quantityControls}>
            <TouchableOpacity onPress={onDecrease} style={styles.qtyBtn}>
              <Icon name="minus" size={18} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.quantity}>{quantity}</Text>
            <TouchableOpacity onPress={onIncrease} style={styles.qtyBtn}>
              <Icon name="plus" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => onAdd(product)}
            activeOpacity={0.8}
          >
            <Text style={styles.addButtonText}>ADD</Text>
            <Icon name="plus" size={16} color={Colors.primary} style={styles.addIcon} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginRight: Spacing.md,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  description: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  price: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  weight: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  actionContainer: {
    width: 100,
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 80,
  },
  addButtonText: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  addIcon: {
    marginLeft: 4,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: borderRadius.sm,
    padding: 2,
  },
  qtyBtn: {
    padding: 4,
  },
  quantity: {
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },
});
