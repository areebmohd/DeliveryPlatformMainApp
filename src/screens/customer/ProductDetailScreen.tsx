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
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useCart } from '../../context/CartContext';
import { useAlert } from '../../context/AlertContext';
import { supabase } from '../../api/supabase';

import { calculateProductPrice, calculateProductWeight, getPriceAdjustmentLabel } from '../../utils/priceUtils';

const { width } = Dimensions.get('window');

import { formatPriceFull } from '../../utils/format';

export const ProductDetailScreen = ({ route, navigation }: any) => {
  const { product: initialProduct, store: initialStore, productId, isFromStore = false } = route.params || {};
  const insets = useSafeAreaInsets();
  const { addItem, updateQuantity, items } = useCart();
  const [product, setProduct] = React.useState<any>(initialProduct);
  const [currentStore, setCurrentStore] = React.useState(initialStore);
  const [loading, setLoading] = React.useState(!initialProduct);
  const [isFavourite, setIsFavourite] = React.useState(false);
  const [favLoading, setFavLoading] = React.useState(false);
  const [selectedOptions, setSelectedOptions] = React.useState<Record<string, string>>({});
  const [returnPolicySummary, setReturnPolicySummary] = React.useState<string>('');
  const [otherStores, setOtherStores] = React.useState<any[]>([]);
  const [loadingOtherStores, setLoadingOtherStores] = React.useState(false);
  const { showAlert } = useAlert();

  const currentPrice = product ? calculateProductPrice(product, selectedOptions) : 0;
  const currentWeight = product ? calculateProductWeight(product, selectedOptions) : null;

  React.useEffect(() => {
    const loadProductAndStore = async () => {
      let activeProduct = initialProduct;
      let activeStore = initialStore;
      
      if (!activeProduct && productId) {
        try {
          setLoading(true);
          const { data: prod, error: prodError } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();
          if (prodError) throw prodError;
          setProduct(prod);
          activeProduct = prod;
        } catch (e) {
          console.error('Error loading product for deep link:', e);
          showAlert?.({
            title: 'Product Not Found',
            message: 'This product could not be found or is no longer available.',
            type: 'error',
            primaryAction: {
              text: 'Go Home',
              onPress: () => navigation.navigate('HomeMain')
            }
          });
          setLoading(false);
          return;
        }
      }
      
      if (activeProduct) {
        // Fetch store details if missing
        if (!activeStore && activeProduct.store_id) {
          try {
            const { data: st, error: stError } = await supabase
              .from('stores')
              .select('*')
              .eq('id', activeProduct.store_id)
              .single();
            if (stError) throw stError;
            setCurrentStore(st);
          } catch (e) {
            console.error('Error fetching store for product deep link:', e);
          }
        }
        
        checkFavourite(activeProduct.id);
        setReturnPolicySummary('Available for Return with Exchange within 24 Hours');
        
        if (activeProduct.master_product_id) {
          fetchOtherStores(activeProduct.master_product_id, activeProduct.id);
        }
      }
      setLoading(false);
    };
    
    loadProductAndStore();
  }, [productId]);

  const fetchOtherStores = async (masterProductId?: string, activeProductId?: string) => {
    const targetMasterId = masterProductId || product?.master_product_id;
    const targetProdId = activeProductId || product?.id;
    if (!targetMasterId || !targetProdId) return;

    try {
      setLoadingOtherStores(true);
      const { data, error } = await supabase
        .from('products')
        .select('*, stores:stores_view(*)')
        .eq('master_product_id', targetMasterId)
        .eq('is_info_complete', true)
        .eq('in_stock', true)
        .eq('is_deleted', false)
        .neq('id', targetProdId);

      if (error) throw error;
      setOtherStores(data || []);
    } catch (e) {
      console.error('Error fetching other stores:', e);
    } finally {
      setLoadingOtherStores(false);
    }
  };

  const checkFavourite = async (activeProductId?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const targetProdId = activeProductId || product?.id;
      if (!targetProdId) return;

      const { data, error } = await supabase
        .from('favourites')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', targetProdId)
        .maybeSingle();

      if (error) throw error;
      setIsFavourite(!!data);
    } catch (e) {
      console.error('Error checking favorite:', e);
    }
  };

  const toggleFavourite = async () => {
    if (!product) return;
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

  const handleShare = async () => {
    if (!product) return;
    try {
      const shareUrl = `https://zorodelivery.vercel.app/product/${product.id}`;
      const message = `Check out "${product.name}" on Zoro Delivery! Order fresh food, groceries, and packages instantly:\n\n${shareUrl}`;
      
      await Share.share({
        message: message,
        url: shareUrl,
        title: `Share ${product.name}`,
      });
    } catch (error: any) {
      console.error('Error sharing:', error);
    }
  };

  if (loading || !product) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const cartItem = items.find(item => 
    item.id === product.id && 
    item.store_id === currentStore?.id &&
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
          <TouchableOpacity 
            onPress={handleShare} 
            style={styles.favButton}
          >
            <Icon name="share-variant" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
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
          {product.product_type === 'common' && (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.commonImageBadge}
              onPress={() => {
                showAlert?.({
                  title: 'Common Product Image',
                  message: 'This image is a common image for the product, real product may look different.',
                  type: 'info',
                  primaryAction: {
                    text: 'Got it',
                    onPress: () => {}
                  }
                });
              }}
            >
              <Text style={styles.commonImageText}>Common product image</Text>
              <Icon name="information" size={16} color={Colors.white} style={styles.infoIcon} />
            </TouchableOpacity>
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
            <Text style={styles.price}>₹{formatPriceFull(currentPrice)}</Text>
            {currentWeight ? (
              <Text style={styles.weight}>
                ({currentWeight < 1 ? `${currentWeight * 1000}gm` : `${currentWeight}kg`})
              </Text>
            ) : null}
          </View>


          <View style={styles.divider} />

          {product.options && Array.isArray(product.options) && product.options.filter((o: any) => o && o.title && o.values && o.values.length > 0).length > 0 && (
            <>
              {product.options.filter((o: any) => o && o.title && o.values && o.values.length > 0).map((opt: any, idx: number) => (
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
                    {opt.values.map((val: string | any, vIdx: number) => {
                      const isSelected = selectedOptions[opt.title] === (typeof val === 'string' ? val : val.value);
                      return (
                        <TouchableOpacity 
                          key={vIdx}
                          activeOpacity={0.7}
                          style={[
                            styles.optionChip,
                            isSelected && styles.optionChipSelected
                          ]}
                          onPress={() => setSelectedOptions({ ...selectedOptions, [opt.title]: (typeof val === 'string' ? val : val.value) })}
                        >
                          {isSelected && (
                            <Icon name="check-circle" size={16} color={Colors.white} style={{ marginRight: 6 }} />
                          )}
                          <Text style={[
                            styles.optionChipText,
                            isSelected && styles.optionChipSelectedText
                          ]}>
                            {(typeof val === 'string' ? val : val.value)}
                            {getPriceAdjustmentLabel(val)}
                          </Text>
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

          <Text style={styles.sectionTitle}>Shop</Text>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => currentStore && navigation.navigate('StoreDetails', { store: currentStore })}
          >
            <Text style={styles.storeLinkText}>
              {currentStore?.name || 'Loading store...'}
            </Text>
          </TouchableOpacity>

          {otherStores.length > 0 && (
            <View style={styles.otherStoresContainer}>
              <Text style={styles.sectionTitle}>Also Available At</Text>
              {otherStores.map((item, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.otherStoreItem}
                  onPress={() => navigation.push('ProductDetail', { product: item, store: item.stores, isFromStore: false })}
                >
                  <View style={styles.otherStoreInfo}>
                    <Text style={styles.otherStoreName}>{item.stores?.name}</Text>
                    <Text style={styles.otherStorePrice}>₹{formatPriceFull(item.price)}</Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Return Policy Section */}
          <View style={styles.returnPolicyContainer}>
            <Text style={styles.sectionTitle}>Return Policy</Text>
            <Text style={[
              styles.returnPolicyText,
              !returnPolicySummary.includes('No') && { color: Colors.primary },
              returnPolicySummary.includes('No') && { color: Colors.error }
            ]}>
              {returnPolicySummary || 'Loading policy...'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Sticky Button */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
        {quantity > 0 ? (
          <View style={styles.cartControls}>
            <TouchableOpacity 
              style={styles.quantityBtn} 
              onPress={() => updateQuantity(product, -1, selectedOptions, currentStore?.id)}
            >
              <Icon name="minus" size={20} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity 
              style={styles.quantityBtn} 
              onPress={() => updateQuantity(product, 1, selectedOptions, currentStore?.id)}
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
              addItem({ ...product, price: currentPrice, selectedOptions }, currentStore, isFromStore);
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
  commonImageBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  commonImageText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  infoIcon: {
    marginLeft: 2,
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
  returnPolicyContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  returnPolicyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  otherStoresContainer: {
    marginTop: Spacing.md,
  },
  otherStoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  otherStoreInfo: {
    flex: 1,
  },
  otherStoreName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  otherStorePrice: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
});
