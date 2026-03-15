import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const OrdersScreen = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const [store, setStore] = useState<any>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchStoreAndOrders();

    // Subscribe to real-time order updates
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStoreAndOrders = async () => {
    try {
      setLoading(true);
      // 1. Get store owned by user
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('id, name')
        .eq('owner_id', user?.id)
        .single();

      if (storeError) throw storeError;
      setStore(storeData);

      // 2. Fetch orders for this store
      await fetchOrders(storeData.id);
    } catch (e) {
      console.error('Error fetching store/orders:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async (storeId?: string) => {
    const id = storeId || store?.id;
    if (!id) return;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        profiles:customer_id (full_name, phone),
        order_items (*)
      `)
      .eq('store_id', id)
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching orders:', error);
    else setOrders(data || []);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      Alert.alert('Status Updated', `Order is now ${newStatus.replace('_', ' ')}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_verification': return Colors.warning;
      case 'accepted': return Colors.secondary;
      case 'preparing': return '#2196F3';
      case 'ready': return '#9C27B0';
      case 'delivered': return Colors.success;
      case 'cancelled': return Colors.error;
      default: return Colors.textSecondary;
    }
  };

  const renderOrderItem = ({ item }: { item: any }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderNumber}>{item.order_number}</Text>
          <Text style={styles.orderDate}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase().replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View style={styles.customerInfo}>
        <Icon name="account" size={16} color={Colors.textSecondary} />
        <Text style={styles.customerName}>{item.profiles?.full_name || 'Guest Customer'}</Text>
      </View>

      <View style={styles.itemsList}>
        {item.order_items?.map((product: any, idx: number) => (
          <Text key={idx} style={styles.itemRow}>
            {product.quantity}x {product.product_name}
          </Text>
        ))}
      </View>

      <View style={styles.orderFooter}>
        <View>
          <Text style={styles.amountLabel}>Grand Total</Text>
          <Text style={styles.amountValue}>₹{item.total_amount}</Text>
        </View>

        <View style={styles.actions}>
          {item.status === 'pending_verification' && (
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: Colors.secondary }]}
              onPress={() => updateStatus(item.id, 'accepted')}
            >
              <Text style={styles.actionBtnText}>Accept</Text>
            </TouchableOpacity>
          )}
          {item.status === 'accepted' && (
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#2196F3' }]}
              onPress={() => updateStatus(item.id, 'preparing')}
            >
              <Text style={styles.actionBtnText}>Prepare</Text>
            </TouchableOpacity>
          )}
          {item.status === 'preparing' && (
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#9C27B0' }]}
              onPress={() => updateStatus(item.id, 'ready')}
            >
              <Text style={styles.actionBtnText}>Ready</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Orders</Text>
        <Text style={styles.subtitle}>{store?.name || 'Store Dashboard'}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="clipboard-text-off" size={64} color={Colors.border} />
              <Text style={styles.emptyText}>No orders found yet.</Text>
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
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  listContent: {
    padding: Spacing.md,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  orderDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 6,
  },
  itemsList: {
    marginBottom: Spacing.md,
  },
  itemRow: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  amountLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  actions: {
    flexDirection: 'row',
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  actionBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  center: {
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
    marginTop: 12,
  },
});
