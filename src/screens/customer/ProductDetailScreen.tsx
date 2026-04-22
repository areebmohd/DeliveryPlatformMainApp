import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useCart } from '../../context/CartContext';
import { useAlert } from '../../context/AlertContext';
import { supabase } from '../../api/supabase';

const { width } = Dimensions.get('window');

import { formatPriceFull } from '../../utils/format';

export const ProductDetailScreen = ({ route, navigation }: any) => {
  const { product, store } = route.params;
  const insets = useSafeAreaInsets();
  const { addItem, updateQuantity, items } = useCart();
  const [isFavourite, setIsFavourite] = React.useState(false);
  const [favLoading, setFavLoading] = React.useState(false);
  const [selectedOptions, setSelectedOptions] = React.useState<Record<string, string>>({});
  const [storeCount, setStoreCount] = React.useState(0);
  const [currentStore, setCurrentStore] = React.useState(store);
  const { showAlert } = useAlert();

  React.useEffect(() => {
    checkFavourite();
    fetchStoreAvailability();
  }, [product.id]);

  const fetchStoreAvailability = async () => {
    try {
      let query = supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .neq('is_deleted', true);

      if (product.barcode) {
        query = query.eq('barcode', product.barcode);
      } else {
        query = query.eq('name', product.name);
      }

      const { count, error } = await query;
      if (error) throw error;
      setStoreCount(count || 1);

      if (!currentStore && product.store_id) {
        const { data: st, error: stErr } = await supabase
          .from('stores')
          .select('*')
          .eq('id', product.store_id)
          .eq('is_approved', true)
          .single();
        if (!stErr) setCurrentStore(st);
      }
    } catch (e) {
      console.error('Error fetching store count:', e);
    }
  };

  const checkFavourite = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('favourites')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();

      if (error) throw error;
      setIsFavourite(!!data);
    } catch (e) {
      console.error('Error checking favorite:', e);
    }
  };

  const toggleFavourite = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setFavLoading(true);
      if (isFavourite) {
        const { error } = await supabase
          .from('favourites')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id);
        if (error) throw error;
        setIsFavourite(false);
      } else {
        const { error } = await supabase
          .from('favourites')
          .insert({
            user_id: user.id,
            product_id: product.id,
          });
        if (error) throw error;
        setIsFavourite(true);
      }
    } catch (e) {
      console.error('Error toggling favorite:', e);
    } finally {
      setFavLoading(false);
    }
  };

  const cartItem = items.find(item => 
    item.id === product.id && 
    item.store_id === (currentStore?.id || store?.id) &&
    JSON.stringify(item.selected_options) === JSON.stringify(selectedOptions)
  );
  const quantity = cartItem ? cartItem.quantity : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Product Details</Text>
        </View>
        <TouchableOpacity 
          onPress={toggleFavourite} 
          style={styles.favButton}
          disabled={favLoading}
        >
          {favLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Icon 
              name={isFavourite ? "heart" : "heart-outline"} 
              size={24} 
              color={isFavourite ? Colors.error : Colors.primary} 
            />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Section */}
        <View style={styles.imageContainer}>
          {product.image_url ? (
            <Image source={{ uri: product.image_url }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Icon name="package-variant" size={80} color={Colors.border} />
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{product.name}</Text>
            {product.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{product.category}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.priceContainer}>
            <Text style={styles.price}>₹{formatPriceFull(product.price)}</Text>
            {product.weight_kg ? (
              <Text style={styles.weight}>
                ({product.weight_kg < 1 ? `${product.weight_kg * 1000}gm` : `${product.weight_kg}kg`})
              </Text>
            ) : null}
          </View>

          <View style={styles.divider} />

          {product.options && Array.isArray(product.options) && product.options.length > 0 && (
            <>
              {product.options.map((opt: any, idx: number) => (
                <View key={idx} style={styles.optionGroup}>
                  <View style={styles.optionHeader}>
                    <Text style={styles.optionTitle}>{opt.title}</Text>
                    {!selectedOptions[opt.title] && (
                      <View style={styles.requiredBadge}>
                        <Text style={styles.requiredText}>Choose One</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.optionsContainer}>
                    {opt.values.map((val: string, vIdx: number) => {
                      const isSelected = selectedOptions[opt.title] === val;
                      return (
                        <TouchableOpacity 
                          key={vIdx}
                          activeOpacity={0.7}
                          style={[
                            styles.optionChip,
                            isSelected && styles.optionChipSelected
                          ]}
                          onPress={() => setSelectedOptions({ ...selectedOptions, [opt.title]: val })}
                        >
                          {isSelected && (
                            <Icon name="check-circle" size={16} color={Colors.white} style={{ marginRight: 6 }} />
                          )}
                          <Text style={[
                            styles.optionChipText,
                            isSelected && styles.optionChipSelectedText
                          ]}>{val}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
              <View style={styles.divider} />
            </>
          )}

          {(() => {
            const hasDescription = product.description && product.description.trim().length > 0;
            if (!hasDescription) return null;

            let parsed: any[] = [];
            let isStructured = false;
            try {
              const data = JSON.parse(product.description);
              if (Array.isArray(data)) {
                parsed = data.filter((item: any) => item.title?.trim() || item.text?.trim());
                isStructured = true;

                // If structured but all items are empty, treat as no description
                if (parsed.length === 0) return null;
              }
            } catch (e) {
              isStructured = false;
            }

            return (
              <>
                <Text style={styles.sectionTitle}>Description</Text>
                {isStructured ? (
                  <View style={styles.specList}>
                    {parsed.map((item: any, idx: number) => (
                      <View 
                        key={idx} 
                        style={[
                          styles.specItem, 
                          idx === parsed.length - 1 && { borderBottomWidth: 0 }
                        ]}
                      >
                        <View style={styles.specLabelContainer}>
                          <Text style={styles.specLabel}>{item.title || 'Info'}</Text>
                        </View>
                        <View style={styles.specValueContainer}>
                          <Text style={styles.specValue}>{item.text}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.description}>{product.description}</Text>
                )}
                <View style={styles.divider} />
              </>
            );
          })()}

          <Text style={styles.sectionTitle}>Store</Text>
          {storeCount > 1 ? (
            <Text style={styles.storeNameText}>Available in {storeCount} Stores</Text>
          ) : (
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => currentStore && navigation.navigate('StoreDetails', { store: currentStore })}
            >
              <Text style={styles.storeLinkText}>
                {currentStore?.name || 'Loading store...'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Bottom Sticky Button */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
        {quantity > 0 ? (
          <View style={styles.cartControls}>
            <TouchableOpacity 
              style={styles.quantityBtn} 
              onPress={() => updateQuantity(product.id, -1, selectedOptions, currentStore?.id || store?.id)}
            >
              <Icon name="minus" size={20} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity 
              style={styles.quantityBtn} 
              onPress={() => updateQuantity(product.id, 1, selectedOptions, currentStore?.id || store?.id)}
            >
              <Icon name="plus" size={20} color={Colors.white} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.addToCartBtn}
            onPress={() => {
              // Validate all options are selected
                const missing = product.options?.find((opt: any) => !selectedOptions[opt.title]);
                if (missing) {
                  return showAlert?.({
                    title: 'Selection Required',
                    message: `Please select your preferred ${missing.title} for this product before adding it to the cart.`,
                    type: 'info',
                    primaryAction: {
                      text: 'Select Now',
                      onPress: () => {} // Just close
                    }
                  });
                }
              addItem({ ...product, selectedOptions }, store);
            }}
          >
            <Icon name="cart-plus" size={20} color={Colors.white} style={{ marginRight: 8 }} />
            <Text style={styles.addToCartText}>Add To Cart</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: Colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: Colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginLeft: Spacing.md,
  },
  scrollContent: {
    paddingTop: Spacing.sm,
  },
  imageContainer: {
    width: width,
    height: width, // Square image
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  infoContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: Spacing.xs,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: Spacing.xs,
  },
  categoryBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
  },
  weight: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 6,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: Spacing.md,
  },
  storeNameText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: Spacing.lg,
  },
  storeLinkText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '700',
    marginBottom: Spacing.lg,
  },
  specList: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  specItem: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#D1D1D6',
    minHeight: 48,
  },
  specLabelContainer: {
    width: '35%',
    backgroundColor: '#EDEEF0',
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#D1D1D6',
    justifyContent: 'center',
  },
  specLabel: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  specValueContainer: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  specValue: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    fontWeight: '500',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  optionGroup: {
    marginBottom: Spacing.lg,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  requiredBadge: {
    backgroundColor: Colors.error + '10',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  requiredText: {
    fontSize: 10,
    color: Colors.error,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 60,
    justifyContent: 'center',
  },
  optionChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    elevation: 3,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  optionChipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  optionChipSelectedText: {
    color: Colors.white,
    fontWeight: '700',
  },
  addToCartBtn: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  addToCartText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  cartControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  quantityBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '800',
  },
});
