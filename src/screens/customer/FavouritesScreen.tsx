import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  RefreshControl,
  Modal,
  ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { CustomerProductCard } from '../../components/CustomerProductCard';
import { useCart } from '../../context/CartContext';
import { StoreCard } from '../../components/StoreCard';
import { Button } from '../../components/ui/Button';
import { useAlert } from '../../context/AlertContext';
import { getOfferDescription, getOfferConditionList, validateOffer, getTheme } from '../../utils/offerUtils';
import { deduplicateProducts, parseWKT } from '../../utils/productUtils';

const { width } = Dimensions.get('window');

export const FavouritesScreen = ({ navigation }: any) => {
  const [activeTab, setActiveTab] = useState<'products' | 'stores' | 'offers'>('products');
  const [loading, setLoading] = useState(true);
  const [favProducts, setFavProducts] = useState<any[]>([]);
  const [favStores, setFavStores] = useState<any[]>([]);
  const [favOffers, setFavOffers] = useState<any[]>([]);
  const [favouriteOfferIds, setFavouriteOfferIds] = useState<string[]>([]);
  const [conditionModal, setConditionModal] = useState<{ visible: boolean; offer: any | null }>({
    visible: false,
    offer: null
  });
  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { addItem, updateQuantity, items, setAppliedOffers, appliedOffers, sessionAddress } = useCart();
  const { showAlert } = useAlert();

  useEffect(() => {
    fetchFavourites();
  }, [user]);

  const fetchFavourites = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      // Fetch favourite stores
      const { data: storesData, error: storesError } = await supabase
        .from('favourites')
        .select(`
          id,
          stores (
            id,
            name,
            banner_url,
            category,
            city,
            address,
            description
          )
        `)
        .eq('user_id', user.id)
        .not('store_id', 'is', null);

      if (storesError) throw storesError;
      setFavStores(storesData?.map(item => item.stores) || []);

      // Fetch favourite products
      const { data: productsData, error: productsError } = await supabase
        .from('favourites')
        .select(`
          id,
          products (
            id,
            name,
            price,
            image_url,
            category,
            description,
            weight_kg,
            store_id,
            barcode,
            product_type,
            options,
            stores:stores_view (
              id,
              name,
              location_wkt
            )
          )
        `)
        .eq('user_id', user.id)
        .not('product_id', 'is', null)
        .eq('products.is_info_complete', true);

      if (productsError) throw productsError;
      const rawProducts = productsData?.map(item => ({ ...item.products, stores: (item.products as any).stores })) || [];
      const userCoords = sessionAddress ? (sessionAddress.location_wkt ? parseWKT(sessionAddress.location_wkt) : parseWKT(sessionAddress.location)) : null;
      setFavProducts(deduplicateProducts(rawProducts, userCoords));

      // Fetch favourite offers
      const { data: offersData, error: offersError } = await supabase
        .from('favourites')
        .select(`
          id,
          offers (
            *,
            stores (*)
          )
        `)
        .eq('user_id', user.id)
        .not('offer_id', 'is', null);

      if (offersError) throw offersError;
      
      const formattedOffers: any[] = offersData?.map(item => ({
        ...item.offers,
        store_name: (item.offers as any).stores?.name,
        store_location: (item.offers as any).stores?.location,
        store_full: (item.offers as any).stores
      })) || [];
      setFavOffers(formattedOffers);
      setFavouriteOfferIds(formattedOffers.map(o => o.id));

      // Fetch all products for these stores to resolve descriptions
      const storeIds = [...new Set(formattedOffers.map(o => o.store_id))];
      if (storeIds.length > 0) {
        const { data: storeProdsData } = await supabase
          .from('products')
          .select('id, name, store_id')
          .in('store_id', storeIds)
          .eq('is_deleted', false);
        setStoreProducts(storeProdsData || []);
      }

    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFavourites();
  }, [fetchFavourites]);

  const toggleOfferFavourite = useCallback(async (offerId: string) => {
    if (!user) return;
    const isFav = favouriteOfferIds.includes(offerId);
    try {
      if (isFav) {
        await supabase.from('favourites').delete().eq('user_id', user.id).eq('offer_id', offerId);
        setFavouriteOfferIds(prev => prev.filter(id => id !== offerId));
        setFavOffers(prev => prev.filter(o => o.id !== offerId));
      } else {
        await supabase.from('favourites').insert({ user_id: user.id, offer_id: offerId });
        setFavouriteOfferIds(prev => [...prev, offerId]);
        fetchFavourites();
      }
    } catch (e) {
      // Silent in production
    }
  }, [user, favouriteOfferIds, fetchFavourites]);

  const handleApplyOffer = useCallback(async (offer: any) => {
    if (!user) {
        showAlert({ title: 'Login Required', message: 'Please login to use offers.', type: 'info' });
        return;
    }

    const offerKey = offer.type === 'free_delivery' ? `${offer.store_id}_delivery` : offer.store_id;
    const isApplied = appliedOffers[offerKey]?.id === offer.id;

    if (isApplied) {
      const newOffers = { ...appliedOffers };
      delete newOffers[offerKey];
      setAppliedOffers(newOffers);
      return;
    }

    const storeInCart = items.some(item => item.store_id === offer.store_id);
    if (!storeInCart) {
        showAlert({ title: 'Add Items First', message: `Please add items from ${offer.store_name} to your cart to apply this offer.`, type: 'warning' });
        return;
    }

    const storeItems = items.filter(i => i.store_id === offer.store_id);
    const storeSubtotal = storeItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    
    // Check if ALL required products are in cart
    if (offer.conditions?.product_ids && offer.conditions.product_ids.length > 0) {
        const allPresent = offer.conditions.product_ids.every((pid: string) => 
            items.some(item => item.id === pid)
        );
        if (!allPresent) {
            showAlert({ 
                title: 'Missing Products', 
                message: `This offer requires all ${offer.conditions.product_ids.length} specific products in your cart.`, 
                type: 'warning' 
            });
            return;
        }
    }

    const validation = validateOffer(offer, storeSubtotal, 0, profile?.order_count || 0, items);
    
    if (!validation.valid) {
      showAlert({ title: 'Conditions Not Met', message: validation.errors.join('\n\n'), type: 'warning' });
      return;
    }

    setAppliedOffers({ ...appliedOffers, [offerKey]: offer });
    showAlert({ title: 'Offer Applied!', message: 'The offer has been applied to your cart.', type: 'success' });
    navigation.navigate('Cart');
  }, [user, items, appliedOffers, setAppliedOffers, profile?.order_count, navigation, showAlert]);

  const getQuantity = useCallback((productId: string) => {
    const item = items.find((i: any) => i.id === productId);
    return item ? item.quantity : 0;
  }, [items]);

  const getGroupedOffers = (offers: any[]) => {
    const groups: any = {};
    offers.forEach((offer: any) => {
      const storeId = offer.store_id || offer.store_full?.id;
      if (!groups[storeId]) {
        groups[storeId] = {
          ...offer.store_full,
          id: storeId,
          name: offer.store_name,
          offers: []
        };
      }
      groups[storeId].offers.push(offer);
    });
    return Object.values(groups);
  };

  const renderConditionLine = (offer: any) => {
    const list = getOfferConditionList(offer);
    const maxVisible = 3;
    const hasMore = list.length > maxVisible;
    const visibleList = hasMore ? list.slice(0, maxVisible - 1) : list;

    return (
      <View style={styles.conditionsLine}>
        <View style={{ flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center' }}>
          {visibleList.map((c, i) => (
            <View key={i} style={styles.offerTabCondPill}>
              <Text style={styles.offerTabCondText} numberOfLines={1}>{c}</Text>
            </View>
          ))}
          {hasMore && (
            <TouchableOpacity 
              style={styles.offerTabCondPill} 
              onPress={() => setConditionModal({ visible: true, offer })}
            >
              <Text style={styles.offerTabCondText}>+ More</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderOfferCard = (offer: any, isFullWidth: boolean = false) => {
    const theme = getTheme(offer.type);
    const offerKey = offer.type === 'free_delivery' ? `${offer.store_id}_delivery` : offer.store_id;
    const isApplied = appliedOffers[offerKey]?.id === offer.id;

    return (
      <View key={offer.id} style={[styles.offerCard, { 
        width: isFullWidth ? width - Spacing.md * 2 : width - 80, 
        marginRight: isFullWidth ? 0 : 16 
      }]}>
        <View style={styles.offerTabHeader}>
          <View style={styles.badgeStoreRow}>
            <View style={[styles.offerTabBadge, { backgroundColor: theme.bg }]}>
              <Text style={[styles.offerTabBadgeText, { color: theme.color }]}>
                {offer.type === 'cheap_product' ? 'PRICE DROP' : offer.type.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.offerTabTitle} numberOfLines={1}>{offer.name || 'Special Offer'}</Text>
        <Text style={styles.offerTabDesc} numberOfLines={2}>
          {(() => {
            const getNames = (ids?: string[]) => {
              if (!ids || ids.length === 0) return '';
              const names = ids.map(id => storeProducts.find(p => String(p.id) === String(id))?.name).filter(Boolean);
              if (names.length === 0) return '';
              return names.join(', ');
            };
            const resolvedName = getNames(offer.reward_data?.product_ids);
            return getOfferDescription(offer, resolvedName);
          })()}
        </Text>

        {renderConditionLine(offer)}

        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={styles.viewBtn}
            onPress={() => setConditionModal({ visible: true, offer })}
          >
            <Text style={styles.viewBtnText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.applyBtn, isApplied && styles.appliedBtn]}
            onPress={() => handleApplyOffer(offer)}
          >
            <Text style={[styles.applyBtnText, isApplied && styles.appliedBtnText]}>
              {isApplied ? "Remove" : "Apply"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStoreSection = (store: any) => (
    <View key={store.id} style={styles.storeSection}>
      <TouchableOpacity 
        style={styles.storeHeader}
        onPress={() => navigation.navigate('StoreDetails', { store })}
      >
        <Icon name="storefront" size={20} color={Colors.primary} />
        <Text style={styles.storeName}>{store.name}</Text>
        <Icon name="chevron-right" size={18} color={Colors.border} />
      </TouchableOpacity>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScrollContent}
        decelerationRate="fast"
      >
        {store.offers.map((o: any) => renderOfferCard(o, store.offers.length === 1))}
      </ScrollView>
    </View>
  );

  const renderProductItem = useCallback(({ item }: { item: any }) => (
    <CustomerProductCard
      product={item}
      onAdd={() => {
        if (!sessionAddress) {
          showAlert({
            title: 'Select Location',
            message: 'Please select a delivery location first to add products to your cart.',
            type: 'info',
            primaryAction: {
              text: 'Go Home',
              onPress: () => navigation.navigate('Home')
            }
          });
          return;
        }
        addItem(item, item.stores);
      }}
      quantity={getQuantity(item.id)}
      onIncrease={() => updateQuantity(item.id, 1)}
      onDecrease={() => updateQuantity(item.id, -1)}
      onPress={() => navigation.navigate('ProductDetail', { product: item, store: item.stores })}
      width="48.5%"
    />
  ), [addItem, getQuantity, updateQuantity, navigation, sessionAddress, showAlert]);

  const renderStoreItem = useCallback(({ item }: { item: any }) => (
    <StoreCard 
      store={item}
      onPress={() => navigation.navigate('StoreDetails', { store: item })}
    />
  ), [navigation]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favourites</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.activeTab]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>Products</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stores' && styles.activeTab]}
          onPress={() => setActiveTab('stores')}
        >
          <Text style={[styles.tabText, activeTab === 'stores' && styles.activeTabText]}>Stores</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'offers' && styles.activeTab]}
          onPress={() => setActiveTab('offers')}
        >
          <Text style={[styles.tabText, activeTab === 'offers' && styles.activeTabText]}>Offers</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <View style={styles.content}>
          {activeTab === 'products' ? (
            <FlatList
              key="products-list"
              data={favProducts}
              renderItem={renderProductItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Icon name="heart-outline" size={64} color={Colors.border} />
                  <Text style={styles.emptyText}>No favourite products yet</Text>
                </View>
              }
            />
          ) : activeTab === 'stores' ? (
            <FlatList
              key="stores-list"
              data={favStores}
              renderItem={renderStoreItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Icon name="heart-outline" size={64} color={Colors.border} />
                  <Text style={styles.emptyText}>No favourite stores yet</Text>
                </View>
              }
            />
          ) : (
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchFavourites} />}
            >
              {favOffers.length > 0 ? (
                <View style={styles.offersList}>
                  {getGroupedOffers(favOffers).map(renderStoreSection)}
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Icon name="heart-outline" size={64} color={Colors.border} />
                  <Text style={styles.emptyText}>No favourite offers yet</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* Offer Details Modal */}
      <Modal 
        visible={conditionModal.visible} 
        transparent 
        animationType="slide"
        onRequestClose={() => setConditionModal({ visible: false, offer: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={[styles.offerTabBadge, { 
                  backgroundColor: getTheme(conditionModal.offer?.type || '').bg,
                  alignSelf: 'flex-start',
                  marginBottom: 8
                }]}>
                  <Text style={[styles.offerTabBadgeText, { color: getTheme(conditionModal.offer?.type || '').color }]}>
                    {conditionModal.offer?.type === 'cheap_product' ? 'PRICE DROP' : (conditionModal.offer?.type || '').replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.modalTitle}>{conditionModal.offer?.name || 'Offer Details'}</Text>
              </View>
              <TouchableOpacity onPress={() => setConditionModal({ visible: false, offer: null })}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {conditionModal.offer && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalDesc}>
                  {(() => {
                    const getNames = (ids?: string[]) => {
                      if (!ids || ids.length === 0) return '';
                      const names = ids.map(id => storeProducts.find(p => String(p.id) === String(id))?.name).filter(Boolean);
                      if (names.length === 0) return '';
                      return names.join(', ');
                    };
                    const resolvedName = getNames(conditionModal.offer.reward_data?.product_ids);
                    return getOfferDescription(conditionModal.offer, resolvedName);
                  })()}
                </Text>
                
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Complete Offer Details</Text>
                  
                  <View style={styles.fullCondItem}>
                     <View style={styles.condBullet} />
                     <Text style={styles.fullCondText}>
                       <Text style={{ fontWeight: '800' }}>Eligibility: </Text>
                       {conditionModal.offer.conditions.applicable_orders === 'all' 
                         ? 'Open for all existing and new customers.' 
                         : `Valid only for your first ${conditionModal.offer.conditions.applicable_orders} orders from this store.`}
                     </Text>
                  </View>

                  {conditionModal.offer.conditions.min_price && (
                    <View style={styles.fullCondItem}>
                       <View style={styles.condBullet} />
                       <Text style={styles.fullCondText}>
                         <Text style={{ fontWeight: '800' }}>Minimum Purchase: </Text>
                         You need to buy products worth ₹{conditionModal.offer.conditions.min_price} or more to apply this offer.
                       </Text>
                    </View>
                  )}

                  {conditionModal.offer.conditions.product_ids && conditionModal.offer.conditions.product_ids.length > 0 && (
                    <View style={styles.fullCondItem}>
                       <View style={styles.condBullet} />
                       <View style={{ flex: 1 }}>
                         <Text style={styles.fullCondText}>
                           <Text style={{ fontWeight: '800' }}>Required Products: </Text>
                           To apply this offer, you must have at least one of these items in your cart:
                         </Text>
                         <View style={styles.productNamesList}>
                            {conditionModal.offer.conditions.product_ids.map((pid: string) => {
                               const product = storeProducts.find(p => p.id === pid);
                               return (
                                 <Text key={pid} style={styles.productNameItem}>• {product?.name || 'Specific Product'}</Text>
                               );
                            })}
                         </View>
                       </View>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 12 }}>
              <Button 
                title={appliedOffers[conditionModal.offer?.type === 'free_delivery' ? `${conditionModal.offer.store_id}_delivery` : conditionModal.offer?.store_id]?.id === conditionModal.offer?.id ? "Remove Offer" : "Apply Offer"} 
                onPress={() => {
                    const off = conditionModal.offer;
                    setConditionModal({ visible: false, offer: null });
                    handleApplyOffer(off);
                }} 
                style={{ flex: 1, marginVertical: 0 }}
              />
              <TouchableOpacity 
                onPress={() => toggleOfferFavourite(conditionModal.offer?.id)}
                style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: 16, 
                  backgroundColor: Colors.white,
                  borderWidth: 1.5,
                  borderColor: favouriteOfferIds.includes(conditionModal.offer?.id) ? Colors.error : Colors.border,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <Icon 
                  name={favouriteOfferIds.includes(conditionModal.offer?.id) ? "heart" : "heart-outline"} 
                  size={28} 
                  color={favouriteOfferIds.includes(conditionModal.offer?.id) ? Colors.error : Colors.border} 
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
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
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginLeft: Spacing.md,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.white,
  },
  content: {
    flex: 1,
    marginTop: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 40,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    fontWeight: '600',
  },
  offerTabCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  offerTabHeader: {
    marginBottom: 12,
  },
  badgeStoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offerTabBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  offerTabBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  storeHeaderFav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  storeNameSmall: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  offerTabTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 4,
  },
  offerTabDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  storeSection: {
    marginBottom: Spacing.md,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    marginBottom: 4,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    flex: 1,
  },
  horizontalScrollContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  offerCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  conditionsLine: {
    marginBottom: 16,
    height: 28,
  },
  offerTabCondPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  offerTabCondText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '800',
  },
  scrollContent: {
    paddingVertical: Spacing.md,
  },
  offersList: {
    paddingTop: 8,
  },
  viewBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  viewBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  applyBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  appliedBtn: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  appliedBtnText: {
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  modalDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  modalSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fullCondItem: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  condBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 8,
  },
  fullCondText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    flex: 1,
  },
  productNamesList: {
    marginTop: 8,
    gap: 4,
  },
  productNameItem: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    paddingLeft: 8,
  },
});
