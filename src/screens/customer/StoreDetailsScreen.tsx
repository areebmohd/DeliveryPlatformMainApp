import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../../api/supabase';
import { CustomerProductCard } from '../../components/CustomerProductCard';
import { useCart } from '../../context/CartContext';

const formatOpeningHours = (hoursJson: string) => {
  try {
    if (!hoursJson) return 'Contact store for timings';
    const parsed = JSON.parse(hoursJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((slot: any) => `${slot.start} - ${slot.end}`).join('\n');
    }
    return hoursJson;
  } catch (e) {
    return hoursJson || 'Contact store for timings';
  }
};

export const StoreDetailsScreen = ({ route, navigation }: any) => {
  const { store } = route.params;
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem, updateQuantity, items, totalItems, subtotal } = useCart();
  const [activeTab, setActiveTab] = useState<'products' | 'info'>('products');
  const [isFavourite, setIsFavourite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchProducts();
    checkFavourite();
  }, []);

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
        .eq('in_stock', true);

      if (error) throw error;
      setProducts(data || []);
    } catch (e) {
      console.error('Error fetching products:', e);
    } finally {
      setLoading(false);
    }
  };

  const getQuantity = (productId: string) => {
    const item = items.find(i => i.id === productId);
    return item ? item.quantity : 0;
  };

  const handleContact = (type: string, value: string) => {
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
      Linking.canOpenURL(url).then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          console.warn('Cannot open URL:', url);
          // Fallback for WhatsApp if the protocol isn't supported (e.g. web fallback)
          if (type === 'whatsapp') {
             Linking.openURL(`https://wa.me/${value.replace(/\D/g, '')}`);
          }
        }
      });
    }
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
        stickyHeaderIndices={[3]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: totalItems > 0 ? 120 : insets.bottom + 20 }}
      >
        {/* Banner */}
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

        {/* Store Branding (Moved below banner) */}
        <View style={styles.brandingContainer}>
          <Text style={styles.storeName}>{store.name}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{store.category}</Text>
            </View>
            {store.sector_area && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{store.sector_area}</Text>
              </View>
            )}
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

        {/* Tabs */}
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
              style={[styles.tab, activeTab === 'info' && styles.activeTab]}
              onPress={() => setActiveTab('info')}
            >
              <Icon
                name={activeTab === 'info' ? 'information' : 'information-outline'}
                size={20}
                color={activeTab === 'info' ? Colors.white : Colors.primary}
              />
              <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>
                Store Info
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabContent}>
          {activeTab === 'products' ? (
            <View style={styles.productsSection}>
              {loading ? (
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
              ) : products.length > 0 ? (
              <View style={styles.productsGrid}>
                {products.map((product) => (
                  <CustomerProductCard
                    key={product.id}
                    product={product}
                    onAdd={() => addItem(product, store)}
                    quantity={getQuantity(product.id)}
                    onIncrease={() => updateQuantity(product.id, 1)}
                    onDecrease={() => updateQuantity(product.id, -1)}
                    onPress={() => navigation.navigate('ProductDetail', { product, store })}
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
          ) : (
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
                        {store.sector_area ? `\n${store.sector_area}` : ''}
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
                        // Extract coordinates from Point string: POINT(lng lat)
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
  categoryBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bannerContainer: {
    width: '100%',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  banner: {
    width: '100%',
    height: 160,
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
  },
  productsSection: {
    flex: 1,
  },
  infoSection: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
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
  emptyContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  cartBar: {
    position: 'absolute',
    left: 20,
    right: 20,
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
});
