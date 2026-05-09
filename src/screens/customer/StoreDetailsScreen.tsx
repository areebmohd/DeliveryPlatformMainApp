import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Linking,
  Image,
  Platform,
  Dimensions,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../../components/ui/Button';
import { CustomerProductCard } from '../../components/CustomerProductCard';
import { getOfferDescription, getOfferConditionList, validateOffer, getTheme } from '../../utils/offerUtils';
import { ProductOptionsModal } from '../../components/ui/ProductOptionsModal';
import { useCart, Offer } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { supabase } from '../../api/supabase';

const formatOpeningHours = (hoursJson: string) => {
  try {
    if (!hoursJson) return 'Contact store for timings';
    const parsed = JSON.parse(hoursJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((slot: any) => `${slot.start} - ${slot.end}`).join('\n');
    }
    return hoursJson;
  } catch (e) {
  }
};

const StoreHeaderSection = React.memo(({ 
  store, 
  activeTab, 
  setActiveTab, 
  isFavourite, 
  favLoading, 
  toggleFavourite,
  insets
}: any) => {
  return (
    <View>
      <View style={styles.bannerContainer}>
        {store.banner_url ? (
          <Image source={{ uri: store.banner_url }} style={styles.banner} />
        ) : (
          <View style={[styles.banner, styles.bannerPlaceholder]}>
            <Icon name="store" size={60} color={Colors.border} />
            <Text style={styles.placeholderText}>Welcome to our store</Text>
          </View>
        )}
      </View>

      <View style={styles.brandingContainer}>
        <Text style={styles.storeName}>{store.name}</Text>
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

      {!store.is_currently_open && (
        <View style={styles.closedBanner}>
          <Icon name="clock-alert-outline" size={20} color={Colors.white} />
          <Text style={styles.closedText}>Store is currently closed for online orders</Text>
        </View>
      )}

      <View style={styles.tabWrapper}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'products' && styles.activeTab]}
            onPress={() => setActiveTab('products')}
          >
            <Icon
              name="package-variant-closed"
              size={20}
              color={activeTab === 'products' ? Colors.white : Colors.primary}
            />
            <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
              Products
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'offers' && styles.activeTab]}
            onPress={() => setActiveTab('offers')}
          >
            <Icon
              name={activeTab === 'offers' ? 'tag' : 'tag-outline'}
              size={20}
              color={activeTab === 'offers' ? Colors.white : Colors.primary}
            />
            <Text style={[styles.tabText, activeTab === 'offers' && styles.activeTabText]}>
              Offers
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'info' && styles.activeTab]}
            onPress={() => setActiveTab('info')}
          >
            <Icon
              name={activeTab === 'info' ? 'information' : 'information-outline'}
              size={20}
              color={activeTab === 'info' ? Colors.white : Colors.primary}
            />
            <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>
              Info
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

const StoreInfoSection = React.memo(({ 
  store, 
  handleContact 
}: any) => {
  return (
    <View style={styles.infoSection}>
      <View style={styles.infoCard}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>About the Store</Text>
          <Text style={styles.infoValue}>
            {store.description || 'Quality products from your neighborhood store.'}
          </Text>
        </View>

        <View style={styles.infoDivider} />

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Operating Hours</Text>
          <View style={styles.infoRow}>
            <Icon name="clock-outline" size={18} color={Colors.primary} />
            <Text style={styles.infoValue}>{formatOpeningHours(store.opening_hours)}</Text>
          </View>
        </View>

        <View style={styles.infoDivider} />

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Address</Text>
          <View style={styles.infoRow}>
            <Icon name="map-marker-outline" size={18} color={Colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoValue}>
                {store.address_line_1 || store.address}
                {store.pincode ? ` - ${store.pincode}` : ''}
                {store.city ? `\n${store.city}` : ''}
                {store.state ? `, ${store.state}` : ''}
              </Text>
            </View>
          </View>
          
          {store.location_wkt && (
            <TouchableOpacity 
              style={styles.mapLink}
              onPress={() => {
                const match = store.location_wkt.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
                if (match) {
                  const lng = match[1];
                  const lat = match[2];
                  const url = Platform.select({
                    ios: `maps:0,0?q=${store.name}@${lat},${lng}`,
                    android: `geo:0,0?q=${lat},${lng}(${store.name})`
                  });
                  if (url) Linking.openURL(url);
                }
              }}
            >
              <Icon name="google-maps" size={16} color={Colors.primary} />
              <Text style={styles.mapLinkText}>View on Map</Text>
            </TouchableOpacity>
          )}
        </View>

        {(store.phone || store.email || store.whatsapp_number) && (
          <>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Contact Information</Text>
              <View style={styles.contactActions}>
                {store.phone && (
                  <TouchableOpacity 
                    style={styles.contactButton} 
                    onPress={() => handleContact('tel', store.phone)}
                  >
                    <Icon name="phone" size={18} color={Colors.white} />
                    <Text style={styles.contactButtonText}>Call</Text>
                  </TouchableOpacity>
                )}
                {store.whatsapp_number && (
                  <TouchableOpacity 
                    style={[styles.contactButton, { backgroundColor: '#25D366' }]} 
                    onPress={() => handleContact('whatsapp', store.whatsapp_number)}
                  >
                    <Icon name="whatsapp" size={18} color={Colors.white} />
                    <Text style={styles.contactButtonText}>WhatsApp</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        )}

        {(store.instagram_url || store.facebook_url) && (
          <>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Social Media</Text>
              <View style={styles.socialRow}>
                {store.instagram_url && (
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => handleContact('browser', store.instagram_url)}
                  >
                    <Icon name="instagram" size={24} color="#E4405F" />
                  </TouchableOpacity>
                )}
                {store.facebook_url && (
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => handleContact('browser', store.facebook_url)}
                  >
                    <Icon name="facebook" size={24} color="#1877F2" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
});

export const StoreDetailsScreen = ({ route, navigation }: any) => {
  const { store } = route.params;
  const [products, setProducts] = useState<any[]>([]);
  const [storeOffers, setStoreOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [offersLoading, setOffersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'offers' | 'info'>('products');
  const [isFavourite, setIsFavourite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [selectedProductOptions, setSelectedProductOptions] = useState<any>(null);
  const [conditionModal, setConditionModal] = useState<{ visible: boolean; offer: any | null }>({
    visible: false,
    offer: null
  });
  const [favouriteOfferIds, setFavouriteOfferIds] = useState<string[]>([]);
  const { addItem, updateQuantity, items, subtotal, totalItems, appliedOffers, setAppliedOffers, sessionAddress } = useCart();
  const { user, profile } = useAuth();
  const { showAlert } = useAlert();
  const { width } = Dimensions.get('window');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchProducts();
    fetchStoreOffers();
    checkFavourite();
    fetchFavouriteOfferIds();
  }, []);

  const fetchFavouriteOfferIds = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('favourites')
        .select('offer_id')
        .eq('user_id', user.id)
        .not('offer_id', 'is', null);
      
      if (error) throw error;
      setFavouriteOfferIds((data || []).map(f => f.offer_id));
    } catch (e) {
      console.error('Error fetching favorite offers:', e);
    }
  };

  const toggleOfferFavourite = async (offerId: string) => {
    if (!user) {
      showAlert({ title: 'Authentication Required', message: 'Please sign in to favorite offers', type: 'info' });
      return;
    }

    const isFav = favouriteOfferIds.includes(offerId);
    
    try {
      if (isFav) {
        const { error } = await supabase
          .from('favourites')
          .delete()
          .eq('user_id', user.id)
          .eq('offer_id', offerId);
        if (error) throw error;
        setFavouriteOfferIds(prev => prev.filter(id => id !== offerId));
      } else {
        const { error } = await supabase
          .from('favourites')
          .insert({ user_id: user.id, offer_id: offerId });
        if (error) throw error;
        setFavouriteOfferIds(prev => [...prev, offerId]);
      }
    } catch (e) {
      console.error('Error toggling offer favorite:', e);
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
        .eq('store_id', store.id)
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
          .eq('store_id', store.id);
        if (error) throw error;
        setIsFavourite(false);
      } else {
        const { error } = await supabase
          .from('favourites')
          .insert({
            user_id: user.id,
            store_id: store.id,
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

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', store.id)
        .eq('is_deleted', false)
        .eq('is_info_complete', true)
        .eq('in_stock', true);

      if (error) throw error;
      setProducts(data || []);
    } catch (e) {
      console.error('Error fetching products:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStoreOffers = async () => {
    try {
      setOffersLoading(true);
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('store_id', store.id)
        .eq('status', 'active');

      if (error) throw error;
      setStoreOffers(data || []);
    } catch (e) {
      console.error('Error fetching store offers:', e);
    } finally {
      setOffersLoading(false);
    }
  };
  const handleAddToCart = useCallback((product: any) => {
    if (!sessionAddress) {
      showAlert({
        title: 'Select Location',
        message: 'Please select a delivery location first to add products to your cart.',
        type: 'info',
        primaryAction: {
          text: 'Select Location',
          onPress: () => navigation.navigate('Account', { screen: 'Addresses' })
        }
      });
      return;
    }

    if (product.options && product.options.length > 0) {
      setSelectedProductOptions(product);
    } else {
      addItem(product, store, true);
    }
  }, [sessionAddress, showAlert, navigation, addItem, store]);

  const handleIncrease = useCallback((productId: string) => {
    updateQuantity(productId, 1, undefined, store.id);
  }, [updateQuantity, store.id]);

  const handleDecrease = useCallback((productId: string) => {
    updateQuantity(productId, -1, undefined, store.id);
  }, [updateQuantity, store.id]);

  const handleProductPress = useCallback((product: any) => {
    navigation.navigate('ProductDetail', { product, store, isFromStore: true });
  }, [navigation, store]);

  const handleApplyOffer = useCallback((offer: any) => {
    handleApplyOfferInternal(offer, appliedOffers, setAppliedOffers);
  }, [appliedOffers, setAppliedOffers, items, subtotal, profile?.order_count]);

  const getQuantity = (productId: string) => {
    const item = items.find(i => i.id === productId && i.store_id === store.id);
    return item ? item.quantity : 0;
  };

  const handleContact = async (type: string, value: string) => {
    let url = '';
    switch (type) {
      case 'tel':
        url = `tel:${value}`;
        break;
      case 'mailto':
        url = `mailto:${value}`;
        break;
      case 'whatsapp':
        // Remove non-numeric characters for WhatsApp
        const cleanedNumber = value.replace(/\D/g, '');
        url = `whatsapp://send?phone=${cleanedNumber}`;
        break;
      case 'browser':
        url = value.startsWith('http') ? value : `https://${value}`;
        break;
    }
    
    if (url) {
      try {
        if (type === 'whatsapp') {
          // Special handling for WhatsApp to ensure it falls back to web if app is not installed
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
          } else {
            await Linking.openURL(`https://wa.me/${value.replace(/\D/g, '')}`);
          }
        } else {
          // For other links, just try to open them directly
          await Linking.openURL(url);
        }
      } catch (error) {
        console.warn('Error opening URL:', url, error);
        showAlert({
          title: 'Cannot Open Link',
          message: 'This link could not be opened on your device.',
          type: 'error'
        });
      }
    }
  };

  const handleApplyOfferInternal = (offer: any, appliedOffers: any, setAppliedOffers: any) => {
    const offerKey = offer.type === 'free_delivery' ? `${offer.store_id}_delivery` : offer.store_id;
    const isApplied = appliedOffers[offerKey]?.id === offer.id;

    if (isApplied) {
      const newOffers = { ...appliedOffers };
      delete newOffers[offerKey];
      setAppliedOffers(newOffers);
      return;
    }

    // Check if ALL required products are in cart
    if (offer.conditions.product_ids && offer.conditions.product_ids.length > 0) {
        const allPresent = offer.conditions.product_ids.every((pid: string) => 
            items.some(item => item.id === pid)
        );
        if (!allPresent) {
            showAlert({ 
                title: 'Missing Products', 
                message: `This offer requires all ${offer.conditions.product_ids.length} specific products in your cart. Click "View" to see the list.`, 
                type: 'warning' 
            });
            return;
        }
    }

    // Validation
    const validation = validateOffer(offer, subtotal, 0, profile?.order_count || 0, items);
    
    if (!validation.valid) {
      showAlert({
        title: 'Conditions Not Met',
        message: validation.errors.join('\n\n'),
        type: 'warning'
      });
      return;
    }

    setAppliedOffers({
      ...appliedOffers,
      [offerKey]: offer
    });
    
    showAlert({ title: 'Offer Applied!', message: 'The offer has been applied to your cart.', type: 'success' });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      {/* Custom Header with Branding */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerMainTitle}>Store</Text>
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
              size={28} 
              color={isFavourite ? Colors.error : Colors.primary} 
            />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: totalItems > 0 ? 120 : insets.bottom + 20 }}
      >
        <StoreHeaderSection
          store={store}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isFavourite={isFavourite}
          favLoading={favLoading}
          toggleFavourite={toggleFavourite}
          insets={insets}
        />

        <View style={styles.tabContent}>
          {activeTab === 'products' ? (
            <View style={styles.productsSection}>
              {loading ? (
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
              ) : products.length > 0 ? (
              <View style={styles.productsGrid}>
                {products.map((product) => (
                    <CustomerProductCard
                      key={`${product.id}_${product.store_id}`}
                      product={product}
                      onAdd={handleAddToCart}
                      quantity={getQuantity(product.id)}
                      onIncrease={handleIncrease}
                      onDecrease={handleDecrease}
                      onPress={handleProductPress}
                      width="48.5%"
                    />
                ))}
              </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Icon name="package-variant" size={64} color={Colors.border} />
                  <Text style={styles.emptyText}>No products available right now.</Text>
                </View>
              )}
            </View>
          ) : activeTab === 'offers' ? (
            <View style={styles.offersSection}>
              {offersLoading ? (
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
              ) : storeOffers.length > 0 ? (
                <View style={{ paddingHorizontal: Spacing.md }}>
                  {storeOffers.map((offer) => {
                    const theme = getTheme(offer.type);
                    const offerKey = offer.type === 'free_delivery' ? `${offer.store_id}_delivery` : offer.store_id;
                    const isApplied = appliedOffers[offerKey]?.id === offer.id;
                    const conditionTexts = getOfferConditionList(offer);

                    return (
                      <View key={offer.id} style={styles.offerTabCard}>
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
                              const names = ids.map(id => products.find(p => String(p.id) === String(id))?.name).filter(Boolean);
                              if (names.length === 0) return '';
                              return names.join(', ');
                            };
                            const resolvedName = getNames(offer.reward_data?.product_ids);
                            return getOfferDescription(offer, resolvedName);
                          })()}
                        </Text>

                        <View style={styles.conditionsLine}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {conditionTexts.slice(0, 2).map((text, idx) => (
                              <View key={idx} style={styles.offerTabCondPill}>
                                <Text style={styles.offerTabCondText}>{text}</Text>
                              </View>
                            ))}
                            {conditionTexts.length > 2 && (
                              <TouchableOpacity 
                                style={styles.offerTabCondPill}
                                onPress={() => setConditionModal({ visible: true, offer })}
                              >
                                <Text style={styles.offerTabCondText}>+ More</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>

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
                  })}
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Icon name="tag-off-outline" size={64} color={Colors.border} />
                  <Text style={styles.emptyText}>No active offers at the moment.</Text>
                </View>
              )}
            </View>
          ) : (
            <StoreInfoSection
              store={store}
              handleContact={handleContact}
            />
          )}
        </View>
      </ScrollView>

      {/* Floating Cart Bar */}
      {totalItems > 0 && (
        <TouchableOpacity 
          style={[styles.cartBar, { bottom: insets.bottom + 10 }]}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Cart')}
        >
          <View style={styles.cartInfo}>
            <Text style={styles.cartCount}>{totalItems} Item{totalItems > 1 ? 's' : ''}</Text>
            <Text style={styles.cartTotal}>₹{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.viewCartAction}>
            <Text style={styles.viewCartText}>View Cart</Text>
            <Icon name="cart-outline" size={20} color={Colors.white} />
          </View>
        </TouchableOpacity>
      )}

      <ProductOptionsModal
        visible={!!selectedProductOptions}
        product={selectedProductOptions}
        onClose={() => setSelectedProductOptions(null)}
        onConfirm={(options, finalPrice) => addItem({ ...selectedProductOptions, price: finalPrice, selectedOptions: options }, store, true)}
      />

      {/* Detailed View Modal */}
      <Modal 
        visible={conditionModal.visible} 
        transparent 
        animationType="slide"
        onRequestClose={() => setConditionModal({ visible: false, offer: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderHeader}>
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
                <Text style={styles.modalTitleDetail}>{conditionModal.offer?.name || 'Offer Details'}</Text>
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
                      const names = ids.map(id => products.find((p: any) => p.id === id)?.name).filter(Boolean);
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
                         You need to buy products worth ₹{conditionModal.offer.conditions.min_price} or more from this store to apply this offer.
                       </Text>
                    </View>
                  )}

                  {conditionModal.offer.conditions.start_time && (
                    <View style={styles.fullCondItem}>
                       <View style={styles.condBullet} />
                       <Text style={styles.fullCondText}>
                         <Text style={{ fontWeight: '800' }}>Offer Timing: </Text>
                         This offer is only available between {conditionModal.offer.conditions.start_time} and {conditionModal.offer.conditions.end_time}.
                       </Text>
                    </View>
                  )}

                  {conditionModal.offer.conditions.max_distance && (
                    <View style={styles.fullCondItem}>
                       <View style={styles.condBullet} />
                       <Text style={styles.fullCondText}>
                         <Text style={{ fontWeight: '800' }}>Distance Limit: </Text>
                         Your delivery address must be within {conditionModal.offer.conditions.max_distance}km from this store.
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
                               const product = products.find(p => p.id === pid);
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
            
            <View>
              {(() => {
                const off = conditionModal.offer;
                const isApp = off && appliedOffers[off.type === 'free_delivery' ? `${off.store_id}_delivery` : off.store_id]?.id === off.id;
                
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 12 }}>
                    <Button 
                      title={isApp ? "Remove Offer" : "Apply Offer"} 
                      onPress={() => {
                          setConditionModal({ visible: false, offer: null });
                          handleApplyOfferInternal(off, appliedOffers, setAppliedOffers);
                      }} 
                      style={{ flex: 1, marginVertical: 0 }}
                    />
                    <TouchableOpacity 
                      onPress={() => toggleOfferFavourite(off?.id)}
                      style={{ 
                        width: 56, 
                        height: 56, 
                        borderRadius: 16, 
                        backgroundColor: Colors.white,
                        borderWidth: 1.5,
                        borderColor: favouriteOfferIds.includes(off?.id) ? Colors.error : Colors.border,
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}
                    >
                      <Icon 
                        name={favouriteOfferIds.includes(off?.id) ? "heart" : "heart-outline"} 
                        size={28} 
                        color={favouriteOfferIds.includes(off?.id) ? Colors.error : Colors.border} 
                      />
                    </TouchableOpacity>
                  </View>
                );
              })()}
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
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
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
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerMainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  brandingContainer: {
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  storeName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 7,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  categoryText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  bannerContainer: {
    width: '100%',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  banner: {
    width: '100%',
    aspectRatio: 2 / 1,
    borderRadius: 24,
    backgroundColor: Colors.surface,
  },
  bannerPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  placeholderText: {
    marginTop: 8,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  closedBanner: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.error,
    padding: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  closedText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  tabWrapper: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    padding: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  activeTabText: {
    color: Colors.white,
  },
  tabContent: {
    paddingVertical: Spacing.sm,
  },
  productsSection: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
  },
  offersSection: {
    flex: 1,
  },
  offerTabCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
  cardActions: {
    flexDirection: 'row',
    gap: 12,
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
  infoSection: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: Spacing.lg,
  },
  infoItem: {
    marginVertical: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#F1F3F5',
    marginVertical: Spacing.lg,
  },
  mapLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 28,
    gap: 4,
  },
  mapLinkText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
  },
  contactActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  contactButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cartBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    elevation: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cartInfo: {
  },
  cartCount: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
  cartTotal: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  viewCartAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewCartText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
    marginRight: 8,
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
  modalHeaderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  modalTypeLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primary,
    marginBottom: 4,
  },
  modalTitleDetail: {
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
  emptyContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
  },
});
