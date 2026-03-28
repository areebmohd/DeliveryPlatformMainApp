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

import { formatPriceShort } from '../utils/format';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    in_stock: boolean;
    stock_quantity?: number;
    weight_kg?: number;
    category?: string;
    image_url?: string;
    barcode?: string;
    product_type?: string;
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
      <View style={styles.mainContent}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.productImage} />
        ) : (
          <View style={[styles.productImage, styles.imagePlaceholder]}>
            <Icon name="package-variant" size={28} color={Colors.textSecondary} />
          </View>
        )}
        
        <View style={styles.info}>
          <View>
            <Text style={styles.name} numberOfLines={1}>
              {product.name || `Barcode: ${product.barcode}`}
            </Text>
            <Text style={styles.category}>
              {product.product_type === 'barcode' ? `Barcode: ${product.barcode}` : (product.category || 'General')}
            </Text>
          </View>
          
          <View style={styles.detailsRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>₹{formatPriceShort(product.price)}</Text>
              {product.weight_kg ? (
                <Text style={styles.weight}>
                  / {product.weight_kg < 1 ? `${product.weight_kg * 1000}gm` : `${product.weight_kg}kg`}
                </Text>
              ) : null}
            </View>
            
            {product.stock_quantity !== undefined && (
              <View style={[styles.stockBadge, product.stock_quantity > 0 ? styles.inStockBadge : styles.outOfStockBadge]}>
                <Text style={[styles.stockBadgeText, product.stock_quantity > 0 ? styles.inStockText : styles.outOfStockText]}>
                  {product.stock_quantity} in stock
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
      
      <View style={styles.footer}>
        <View style={styles.stockToggleContainer}>
          <Text style={styles.toggleLabel}>Available</Text>
          <Switch
            value={product.in_stock}
            onValueChange={() => onToggleStock(product.id, product.in_stock)}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={Colors.white}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity onPress={() => onEdit(product)} style={styles.actionButton}>
            <Icon name="pencil-outline" size={20} color={Colors.primary} />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(product.id)} style={[styles.actionButton, styles.deleteButton]}>
            <Icon name="trash-can-outline" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginBottom: Spacing.md, // Reduced from LG
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
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
    marginLeft: Spacing.md,
    justifyContent: 'space-between',
    height: 80,
    paddingVertical: 2,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  category: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.black,
  },
  weight: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 2,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inStockBadge: {
    backgroundColor: Colors.success + '15',
  },
  outOfStockBadge: {
    backgroundColor: Colors.error + '15',
  },
  stockBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inStockText: {
    color: Colors.success,
  },
  outOfStockText: {
    color: Colors.error,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F5',
  },
  stockToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginRight: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginLeft: Spacing.sm,
  },
  actionButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  deleteButton: {
    backgroundColor: Colors.error + '10',
    paddingHorizontal: 10,
  },
});
