import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { StoreCard } from '../../components/StoreCard';
import { supabase } from '../../api/supabase';

const CATEGORIES = [
  { id: '1', name: 'Grocery', icon: 'cart-outline' },
  { id: '2', name: 'Fruits', icon: 'food-apple-outline' },
  { id: '3', name: 'Vegetables', icon: 'leaf-outline' },
  { id: '4', name: 'Pharmacy', icon: 'medical-bag' },
  { id: '5', name: 'Dairy', icon: 'cow' },
  { id: '6', name: 'Meat', icon: 'food-steak' },
];

export const HomeScreen = ({ navigation }: any) => {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setStores(data || []);
    } catch (e) {
      console.error('Error fetching stores:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderCategory = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        selectedCategory === item.name && styles.categoryItemActive,
      ]}
      onPress={() => setSelectedCategory(item.name)}
    >
      <View style={[
        styles.categoryIconContainer,
        selectedCategory === item.name ? styles.categoryIconActive : styles.inactiveCategoryBg
      ]}>
        <Icon 
          name={item.icon} 
          size={24} 
          color={selectedCategory === item.name ? Colors.white : Colors.primary} 
        />
      </View>
      <Text style={[
        styles.categoryText,
        selectedCategory === item.name ? styles.activeCategoryText : styles.inactiveCategoryText
      ]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.locationRow}>
            <Icon name="map-marker" size={20} color={Colors.primary} />
            <Text style={styles.locationLabel}>Delivering to</Text>
          </View>
          <Text style={styles.locationTitle}>Gurugram, Sector 45 ↓</Text>
        </View>
        <TouchableOpacity style={styles.profileButton}>
          <Icon name="bell-outline" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="magnify" size={24} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for stores or products..."
            placeholderTextColor={Colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingBottom: insets.bottom + 100 }
        ]}
      >
        {/* Categories */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
        </View>
        <FlatList
          data={CATEGORIES}
          renderItem={renderCategory}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />

        {/* Featured Stores */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby Stores</Text>
          <TouchableOpacity onPress={fetchStores}>
            <Text style={styles.seeAll}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : stores.length > 0 ? (
          <View style={styles.storesContainer}>
            {stores.map((store) => (
              <StoreCard 
                key={store.id} 
                store={store} 
                onPress={() => (navigation as any).navigate('StoreDetails', { store })} 
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="store-off-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyText}>No stores found in your area yet.</Text>
            <Text style={styles.emptySubtext}>We're expanding fast! Check back soon.</Text>
          </View>
        )}
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginLeft: 4,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginLeft: 2,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    height: 50,
    borderRadius: borderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 15,
    color: Colors.text,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  seeAll: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
  },
  categoriesList: {
    paddingHorizontal: Spacing.md,
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  categoryIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryIconActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  inactiveCategoryBg: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryLight,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  inactiveCategoryText: {
    color: Colors.primary,
  },
  activeCategoryText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  categoryItemActive: {
    // optional styling for active item
  },
  emptyContainer: {
    marginTop: 60,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  storesContainer: {
    paddingHorizontal: Spacing.md,
  },
});
