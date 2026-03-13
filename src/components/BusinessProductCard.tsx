import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
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
      <View style={styles.info}>
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.price}>₹{product.price}</Text>
        {product.weight_kg ? (
          <Text style={styles.weight}>{product.weight_kg} kg</Text>
        ) : null}
      </View>
      
      <View style={styles.actions}>
        <View style={styles.stockToggle}>
          <Text style={[styles.stockText, !product.in_stock && styles.outOfStockText]}>
            {product.in_stock ? 'In Stock' : 'Out of Stock'}
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
            <Icon name="pencil" size={20} color={Colors.secondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(product.id)} style={styles.iconButton}>
            <Icon name="delete" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  price: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 2,
  },
  weight: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    alignItems: 'flex-end',
  },
  stockToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginRight: 8,
  },
  outOfStockText: {
    color: Colors.error,
  },
  iconButtons: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 12,
    padding: 4,
  },
});
