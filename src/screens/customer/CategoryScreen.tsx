import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../../api/supabase';
import { StoreCard } from '../../components/StoreCard';
import { CustomerProductCard } from '../../components/CustomerProductCard';
import { useCart } from '../../context/CartContext';

export const CategoryScreen = ({ navigation, route }: any) => {
  const { categoryName } = route.params;
  const [activeTab, setActiveTab] = useState<'products' | 'stores'>('products');
  const [products, setProducts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const { addItem, updateQuantity, items } = useCart();

  const getQuantity = (productId: string) => {
    const item = items.find(i => i.id === productId);
    return item ? item.quantity : 0;
  };

  useEffect(() => {
    fetchResults();
  }, [categoryName]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      
      // Fetch Products in this category
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*, stores:stores_view!inner(*)')
        .ilike('category', `%${categoryName}%`)
        .eq('stores.is_active', true)
        .eq('is_deleted', false)
        .eq('in_stock', true);

      // Fetch Stores in this category
      const { data: storeData, error: storeError } = await supabase
        .from('stores_view')
        .select('*')
        .ilike('category', `%${categoryName}%`)
        .eq('is_active', true);

      if (productError) throw productError;
      if (storeError) throw storeError;

      setProducts(productData || []);
      setStores(storeData || []);
    } catch (e) {
      console.error('Category fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderProduct = ({ item }: { item: any }) => (
    <View style={styles.productItemWrapper}>
      <CustomerProductCard
        product={item}
        onPress={() => navigation.navigate('ProductDetail', { product: item, store: item.stores })}
        onAdd={() => addItem(item, item.stores)}
        quantity={getQuantity(item.id)}
        onIncrease={() => updateQuantity(item.id, 1)}
        onDecrease={() => updateQuantity(item.id, -1)}
        width="100%"
      />
    </View>
  );

  const renderStore = ({ item }: { item: any }) => (
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
        <Text style={styles.title}>{categoryName}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.activeTab]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
            Products ({products.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stores' && styles.activeTab]}
          onPress={() => setActiveTab('stores')}
        >
          <Text style={[styles.tabText, activeTab === 'stores' && styles.activeTabText]}>
            Stores ({stores.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={activeTab === 'products' ? products : stores}
          renderItem={activeTab === 'products' ? renderProduct : renderStore}
          keyExtractor={(item) => item.id}
          numColumns={activeTab === 'products' ? 2 : 1}
          key={activeTab === 'products' ? 'products-grid' : 'stores-list'}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="package-variant" size={64} color={Colors.border} />
              <Text style={styles.emptyText}>No {activeTab} found in {categoryName}.</Text>
            </View>
          }
        />
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
    padding: Spacing.md,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    gap: 12,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeTab: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.white,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  productItemWrapper: {
    width: '48.5%',
    marginBottom: 10,
    marginRight: '3%',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
});
