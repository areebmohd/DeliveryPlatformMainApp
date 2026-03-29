import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { CustomerProductCard } from '../../components/CustomerProductCard';
import { useCart } from '../../context/CartContext';
import { StoreCard } from '../../components/StoreCard';

const { width } = Dimensions.get('window');

export const FavouritesScreen = ({ navigation }: any) => {
  const [activeTab, setActiveTab] = useState<'products' | 'stores'>('products');
  const [loading, setLoading] = useState(true);
  const [favProducts, setFavProducts] = useState<any[]>([]);
  const [favStores, setFavStores] = useState<any[]>([]);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { addItem, updateQuantity, items } = useCart();

  useEffect(() => {
    fetchFavourites();
  }, [user]);

  const fetchFavourites = async () => {
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
            stores (
              id,
              name
            )
          )
        `)
        .eq('user_id', user.id)
        .not('product_id', 'is', null)
        .eq('products.is_info_complete', true);

      if (productsError) throw productsError;
      setFavProducts(productsData?.map(item => item.products) || []);

    } catch (error) {
      console.error('Error fetching favourites:', error);
    } finally {
      setLoading(false);
    }
  };

  const getQuantity = (productId: string) => {
    const item = items.find((i: any) => i.id === productId);
    return item ? item.quantity : 0;
  };

  const renderProductItem = ({ item }: { item: any }) => (
    <CustomerProductCard
      product={item}
      onAdd={() => addItem(item, item.stores)}
      quantity={getQuantity(item.id)}
      onIncrease={() => updateQuantity(item.id, 1)}
      onDecrease={() => updateQuantity(item.id, -1)}
      onPress={() => navigation.navigate('ProductDetail', { product: item, store: item.stores })}
      width="48.5%"
    />
  );

  const renderStoreItem = ({ item }: { item: any }) => (
    <StoreCard 
      store={item}
      onPress={() => navigation.navigate('StoreDetails', { store: item })}
    />
  );

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
          ) : (
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
          )}
        </View>
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
});
