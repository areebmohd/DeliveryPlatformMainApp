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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../../api/supabase';
import { CustomerProductCard } from '../../components/CustomerProductCard';
import { useCart } from '../../context/CartContext';

export const StoreDetailsScreen = ({ route, navigation }: any) => {
  const { store } = route.params;
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem, updateQuantity, items, totalItems, subtotal } = useCart();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', store.id)
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{store.name}</Text>
          <Text style={styles.headerSubTitle} numberOfLines={1}>{store.address}</Text>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: totalItems > 0 ? 100 : insets.bottom + 20 }}
      >
        <View style={styles.content}>
          <View style={styles.storeHero}>
            <View style={styles.storeBadge}>
              <Text style={styles.badgeText}>{store.category}</Text>
            </View>
            <Text style={styles.storeName}>{store.name}</Text>
            <Text style={styles.storeDesc}>{store.description || 'Quality products from your neighborhood.'}</Text>
            
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Icon name="star" size={18} color={Colors.primary} />
                <Text style={styles.statText}>4.5</Text>
              </View>
              <View style={styles.statDot} />
              <View style={styles.stat}>
                <Icon name="clock-outline" size={18} color={Colors.primary} />
                <Text style={styles.statText}>25-30 mins</Text>
              </View>
              <View style={styles.statDot} />
              <View style={styles.stat}>
                <Icon name="map-marker-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.statText}>2.4 km</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Store Information</Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Icon name="clock-outline" size={20} color={Colors.primary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Opening Hours</Text>
                <Text style={styles.infoText}>{store.opening_hours || 'Contact store for timings'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Icon name="map-marker-outline" size={20} color={Colors.primary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoText}>{store.address}</Text>
              </View>
            </View>

            {(store.phone || store.email || store.whatsapp_number) && (
              <View style={styles.contactActions}>
                {store.phone && (
                  <TouchableOpacity 
                    style={styles.contactButton} 
                    onPress={() => handleContact('tel', store.phone)}
                  >
                    <Icon name="phone" size={20} color={Colors.white} />
                    <Text style={styles.contactButtonText}>Call</Text>
                  </TouchableOpacity>
                )}
                {store.whatsapp_number && (
                  <TouchableOpacity 
                    style={[styles.contactButton, { backgroundColor: '#25D366' }]} 
                    onPress={() => handleContact('whatsapp', store.whatsapp_number)}
                  >
                    <Icon name="whatsapp" size={20} color={Colors.white} />
                    <Text style={styles.contactButtonText}>WhatsApp</Text>
                  </TouchableOpacity>
                )}
                {store.email && (
                  <TouchableOpacity 
                    style={[styles.contactButton, { backgroundColor: Colors.textSecondary }]} 
                    onPress={() => handleContact('mailto', store.email)}
                  >
                    <Icon name="email" size={20} color={Colors.white} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {(store.instagram_url || store.facebook_url) && (
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
            )}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Products</Text>
            <Text style={styles.productCount}>{products.length} Items</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
          ) : products.length > 0 ? (
            products.map((product) => (
              <CustomerProductCard
                key={product.id}
                product={product}
                onAdd={() => addItem(product, store)}
                quantity={getQuantity(product.id)}
                onIncrease={() => updateQuantity(product.id, 1)}
                onDecrease={() => updateQuantity(product.id, -1)}
              />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="package-variant" size={64} color={Colors.border} />
              <Text style={styles.emptyText}>No products available right now.</Text>
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
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSubTitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  storeHero: {
    marginBottom: Spacing.xl,
  },
  storeBadge: {
    backgroundColor: Colors.primary + '15',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  badgeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  storeName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  storeDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 4,
  },
  statDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  productCount: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  infoTextContainer: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  contactButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
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
    bottom: 20,
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
});
