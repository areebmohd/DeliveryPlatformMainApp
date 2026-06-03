import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Platform,
  StatusBar,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { useAlert } from '../../context/AlertContext';
import { supabase } from '../../api/supabase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const AddStockScreen = ({ navigation, route }: any) => {
  const { storeId } = route.params;
  const insets = useSafeAreaInsets();
  const { showAlert, showToast } = useAlert();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [addedStock, setAddedStock] = useState('10');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    fetchProducts();
  }, [storeId]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_deleted', false)
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (e) {
      console.error('Error fetching products:', e);
      showAlert({
        title: 'Error',
        message: 'Could not fetch products.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const qty = product.stock_quantity ?? 0;
      if (stockFilter === 'in_stock') return qty > 0;
      if (stockFilter === 'out_of_stock') return qty <= 0;
      return true;
    });
  }, [products, stockFilter]);

  const isAllSelected = useMemo(() => {
    if (filteredProducts.length === 0) return false;
    return filteredProducts.every(p => selectedIds.has(p.id));
  }, [filteredProducts, selectedIds]);

  const toggleSelectProduct = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (isAllSelected) {
        filteredProducts.forEach(p => next.delete(p.id));
      } else {
        filteredProducts.forEach(p => next.add(p.id));
      }
      return next;
    });
  }, [filteredProducts, isAllSelected]);

  const handleBulkAddStock = async () => {
    const qtyToAdd = parseInt(addedStock);
    if (isNaN(qtyToAdd) || qtyToAdd <= 0) {
      showAlert({
        title: 'Invalid Input',
        message: 'Please enter a valid stock quantity greater than 0.',
        type: 'warning',
      });
      return;
    }
    if (selectedIds.size === 0) {
      showAlert({
        title: 'No Selection',
        message: 'Please select at least one product.',
        type: 'warning',
      });
      return;
    }

    try {
      setUpdating(true);
      const idsToUpdate = Array.from(selectedIds);

      const updates = idsToUpdate.map(async id => {
        const product = products.find(p => p.id === id);
        if (!product) return;

        const currentQty = product.stock_quantity ?? 0;
        const newQty = currentQty + qtyToAdd;
        const inStockStatus = newQty > 0;

        const { error } = await supabase
          .from('products')
          .update({
            stock_quantity: newQty,
            in_stock: inStockStatus,
          })
          .eq('id', id);

        if (error) throw error;
      });

      await Promise.all(updates);

      showToast(`Stock updated successfully for ${idsToUpdate.length} products!`, 'success');
      navigation.goBack();
    } catch (e: any) {
      console.error('Error updating stock:', e);
      showAlert({
        title: 'Error',
        message: e.message || 'Failed to update stock. Please try again.',
        type: 'error',
      });
    } finally {
      setUpdating(false);
    }
  };

  const renderProductItem = (product: any) => {
    const isSelected = selectedIds.has(product.id);
    const qty = product.stock_quantity ?? 0;

    return (
      <TouchableOpacity
        key={product.id}
        style={[styles.productCard, isSelected && styles.selectedProductCard]}
        onPress={() => toggleSelectProduct(product.id)}
        activeOpacity={0.8}
      >
        <View style={styles.productLeft}>
          <Icon
            name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={24}
            color={isSelected ? Colors.primary : Colors.textSecondary}
          />
          {product.image_url || product.raw_image_url ? (
            <Image
              source={{ uri: product.image_url || product.raw_image_url }}
              style={styles.productImage}
            />
          ) : (
            <View style={[styles.productImage, styles.placeholderImage]}>
              <Icon name="package-variant" size={20} color={Colors.textSecondary} />
            </View>
          )}
          <View style={styles.productInfo}>
            <Text style={[styles.productName, isSelected && styles.selectedProductName]} numberOfLines={1}>
              {product.name}
            </Text>
            <Text style={styles.productCategory}>
              {product.category || 'General'}
            </Text>
          </View>
        </View>
        <View style={styles.productRight}>
          <Text style={[styles.stockValue, qty > 0 ? styles.inStockQty : styles.outOfStockQty]}>
            {qty} stock
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <View style={{ height: insets.top, backgroundColor: Colors.background }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Bulk Stock</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filters and Select All Row */}
      {!loading && products.length > 0 && (
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={styles.checkboxSelectAll}
            onPress={toggleSelectAll}
            activeOpacity={0.8}
          >
            <Icon
              name={isAllSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={24}
              color={isAllSelected ? Colors.primary : Colors.textSecondary}
            />
          </TouchableOpacity>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterScrollContent}
          >
            <TouchableOpacity
              style={[
                styles.filterButton,
                stockFilter === 'all' && styles.activeFilterButton,
              ]}
              onPress={() => setStockFilter('all')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  stockFilter === 'all' && styles.activeFilterButtonText,
                ]}
              >
                All ({products.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                stockFilter === 'in_stock' && styles.activeFilterButton,
              ]}
              onPress={() => setStockFilter('in_stock')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  stockFilter === 'in_stock' && styles.activeFilterButtonText,
                ]}
              >
                In Stock ({products.filter(p => (p.stock_quantity ?? 0) > 0).length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                stockFilter === 'out_of_stock' && styles.activeFilterButton,
              ]}
              onPress={() => setStockFilter('out_of_stock')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  stockFilter === 'out_of_stock' && styles.activeFilterButtonText,
                ]}
              >
                Out of Stock ({products.filter(p => (p.stock_quantity ?? 0) <= 0).length})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Main List Area */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : products.length > 0 ? (
        filteredProducts.length > 0 ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredProducts.map(renderProductItem)}
          </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="package-variant-closed" size={60} color={Colors.border} />
            <Text style={styles.emptyTitle}>
              {stockFilter === 'in_stock' ? 'No Products In Stock' : 'No Out of Stock Products'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {stockFilter === 'in_stock'
                ? 'All products are currently out of stock.'
                : 'Great! All products are currently in stock.'}
            </Text>
          </View>
        )
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="package-variant" size={60} color={Colors.border} />
          <Text style={styles.emptyTitle}>No Products Found</Text>
          <Text style={styles.emptySubtitle}>
            Add some products in your storefront first.
          </Text>
        </View>
      )}

      {/* Bottom Panel */}
      {!loading && products.length > 0 && (
        <View
          style={[
            styles.bottomPanel,
            {
              paddingBottom: keyboardHeight > 0
                ? (Platform.OS === 'ios' ? keyboardHeight : keyboardHeight - insets.bottom + 8)
                : Math.max(16, insets.bottom)
            }
          ]}
        >
          <View style={styles.panelRow}>
            <View style={styles.inputContainer}>
              <View style={styles.labelWrapper}>
                <Text style={styles.inputLabel}>Stock Quantity</Text>
              </View>
              <TextInput
                style={styles.stockInput}
                keyboardType="numeric"
                value={addedStock}
                onChangeText={setAddedStock}
                selectTextOnFocus
              />
            </View>
            <TouchableOpacity
              style={[
                styles.submitBtn,
                (selectedIds.size === 0 || updating) && styles.submitBtnDisabled,
              ]}
              onPress={handleBulkAddStock}
              disabled={selectedIds.size === 0 || updating}
              activeOpacity={0.8}
            >
              {updating ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Icon name="plus-box" size={20} color={Colors.white} />
                  <Text style={styles.submitBtnText}>
                    Add Stock ({selectedIds.size})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  backButton: {
    backgroundColor: Colors.white,
    padding: 8,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  checkboxSelectAll: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterScroll: {
    flex: 1,
  },
  filterScrollContent: {
    gap: 6,
    paddingRight: Spacing.md,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.round,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeFilterButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  activeFilterButtonText: {
    color: Colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 24,
    gap: Spacing.sm,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
  },
  selectedProductCard: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
    backgroundColor: Colors.primaryLight,
  },
  selectedProductName: {
    color: Colors.primary,
    fontWeight: '800',
  },
  productLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  productImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.background,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  productCategory: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  productRight: {
    alignItems: 'flex-end',
  },
  stockValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  inStockQty: {
    color: Colors.success,
  },
  outOfStockQty: {
    color: Colors.error,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xl,
  },
  bottomPanel: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  panelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  inputContainer: {
    flex: 4,
    position: 'relative',
  },
  labelWrapper: {
    position: 'absolute',
    top: -8,
    left: 10,
    backgroundColor: Colors.white,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  stockInput: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  submitBtn: {
    flex: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  submitBtnDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
});
