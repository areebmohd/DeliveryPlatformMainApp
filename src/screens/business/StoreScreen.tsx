import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BusinessProductCard } from '../../components/BusinessProductCard';

const { width } = Dimensions.get('window');

type TabType = 'products' | 'info';

export const StoreScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  useEffect(() => {
    fetchStore();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchStore();
      fetchProducts();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (store?.id && activeTab === 'products') {
      fetchProducts();
    }
  }, [store?.id, activeTab]);

  const fetchStore = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) setStore(data);
    } catch (e) {
      console.error('Error fetching store:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    if (!store?.id) return;
    try {
      setProductsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (e) {
      console.error('Error fetching products:', e);
    } finally {
      setProductsLoading(false);
    }
  };

  const handleNavigateToStoreForm = () => {
    navigation.navigate('StoreDetailsForm', { store });
  };

  const handleNavigateToProductForm = (product?: any) => {
    if (product) {
      navigation.navigate('ProductForm', { 
        storeId: store.id,
        product 
      });
      return;
    }

    Alert.alert(
      'Add Product',
      'Choose product type:',
      [
        {
          text: 'Manual Product',
          onPress: () => navigation.navigate('ProductForm', { storeId: store.id, mode: 'manual' }),
        },
        {
          text: 'Barcode Product',
          onPress: () => navigation.navigate('ProductForm', { storeId: store.id, mode: 'barcode' }),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleToggleStock = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ in_stock: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      
      setProducts(products.map(p => 
        p.id === id ? { ...p, in_stock: !currentStatus } : p
      ));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteProduct = (id: string) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (!error) fetchProducts();
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
      <Text style={styles.headerTitle}>My Store</Text>
      <TouchableOpacity 
        style={styles.editButton}
        onPress={handleNavigateToStoreForm}
      >
        <Icon name="cog-outline" size={22} color={Colors.black} />
      </TouchableOpacity>
    </View>
  );

  const renderBanner = () => (
    <View style={styles.bannerContainer}>
      {store?.banner_url ? (
        <Image source={{ uri: store.banner_url }} style={styles.banner} />
      ) : (
        <View style={[styles.banner, styles.bannerPlaceholder]}>
          <Icon name="store" size={60} color={Colors.border} />
          <Text style={styles.placeholderText}>Design your storefront</Text>
        </View>
      )}
      <View style={styles.storeBasicInfo}>
        <Text style={styles.storeName}>{store?.name || 'Your Store'}</Text>
        <View style={styles.addressContainer}>
          <Icon name="map-marker-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.storeAddress}>{store?.address || 'Set your location'}</Text>
        </View>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{store?.category || 'General Store'}</Text>
        </View>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabWrapper}>
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'products' && styles.activeTab]}
          onPress={() => setActiveTab('products')}
        >
          <Icon 
            name={activeTab === 'products' ? 'package-variant' : 'package-variant-closed'} 
            size={20} 
            color={activeTab === 'products' ? Colors.black : Colors.textSecondary} 
          />
          <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>Inventory</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'info' && styles.activeTab]}
          onPress={() => setActiveTab('info')}
        >
          <Icon 
            name={activeTab === 'info' ? 'information' : 'information-outline'} 
            size={20} 
            color={activeTab === 'info' ? Colors.black : Colors.textSecondary} 
          />
          <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>Store Info</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView 
        stickyHeaderIndices={[3]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        {renderBanner()}
        
        <View style={{ height: 10 }} />

        {renderTabs()}

        <View style={styles.tabContent}>
          {activeTab === 'products' ? (
            <View style={styles.productsContainer}>
              {productsLoading ? (
                <View style={styles.centered}>
                  <ActivityIndicator color={Colors.primary} size="large" />
                </View>
              ) : products.length > 0 ? (
                products.map(item => (
                  <BusinessProductCard
                    key={item.id}
                    product={item}
                    onToggleStock={handleToggleStock}
                    onEdit={handleNavigateToProductForm}
                    onDelete={handleDeleteProduct}
                  />
                ))
              ) : (
                <View style={styles.emptyProducts}>
                  <View style={styles.emptyIconContainer}>
                    <Icon name="package-variant" size={60} color={Colors.border} />
                  </View>
                  <Text style={styles.emptyTitle}>No Products Yet</Text>
                  <Text style={styles.emptySubtitle}>Start adding items to your menu to begin selling.</Text>
                  <Button 
                    title="Add Your First Product" 
                    onPress={() => handleNavigateToProductForm()}
                    style={styles.emptyButton}
                  />
                </View>
              )}
            </View>
          ) : (
            <View style={styles.infoContainer}>
              <View style={styles.infoCard}>
                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>About the Store</Text>
                  <Text style={styles.infoValue}>{store?.description || 'Build your store profile to attract more customers.'}</Text>
                </View>
                
                <View style={styles.infoDivider} />
                
                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>Operating Hours</Text>
                  <View style={styles.hoursRow}>
                    <Icon name="clock-outline" size={18} color={Colors.primary} />
                    <Text style={styles.infoValue}>{store?.opening_hours || 'Schedule not set'}</Text>
                  </View>
                </View>

                <View style={styles.infoDivider} />

                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>Pickup Address</Text>
                  <View style={styles.hoursRow}>
                    <Icon name="map-marker-radius" size={18} color={Colors.error} />
                    <Text style={styles.infoValue}>{store?.address || 'Location required for deliveries'}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity 
        style={[styles.fab, { bottom: 20 + insets.bottom }]} 
        onPress={() => handleNavigateToProductForm()}
        activeOpacity={0.9}
      >
        <View style={styles.fabGradient}>
          <Icon name="plus" size={30} color={Colors.black} />
          <Text style={styles.fabText}>Add Product</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centered: {
    marginTop: 50,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  bannerContainer: {
    width: '100%',
    padding: Spacing.sm,
  },
  banner: {
    width: '100%',
    height: 180,
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
  storeBasicInfo: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  storeName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  categoryBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    color: Colors.black,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  storeAddress: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginLeft: 6,
    fontWeight: '500',
    flex: 1,
  },
  tabWrapper: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
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
    color: Colors.black,
  },
  tabContent: {
    padding: Spacing.sm,
  },
  productsContainer: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
  },
  emptyProducts: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
    marginBottom: Spacing.xl,
  },
  emptyButton: {
    width: '80%',
  },
  infoContainer: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoSection: {
    marginVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    fontWeight: '500',
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#F1F3F5',
    marginVertical: Spacing.lg,
  },
  fab: {
    position: 'absolute',
    right: 20,
    backgroundColor: Colors.primary,
    borderRadius: 30,
    height: 60,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fabText: {
    color: Colors.black,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 8,
  },
});
