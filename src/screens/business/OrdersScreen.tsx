import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { AlertModal } from '../../components/ui/AlertModal';
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

  // Alert Modal state
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    primaryAction?: any;
    secondaryAction?: any;
    showCancel?: boolean;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showAlert = (config: any) => {
    setAlertConfig({ visible: true, ...config });
  };

  const closeAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  useEffect(() => {
    fetchStoreAndOrders();

    if (!store?.id) return;

    // Subscribe to real-time order and item updates for this store
    const channel = supabase
      .channel(`store-orders-sync-${store.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `store_id=eq.${store.id}`,
        },
        () => {
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
        },
        () => {
          // We can't easily filter order_items by store_id in the subscription 
          // without a join, so we refresh orders to catch item changes
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [store?.id]);

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
        customer:profiles!orders_customer_id_fkey (full_name, phone),
        rider:profiles!orders_rider_id_fkey (full_name),
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
      showAlert({ 
        title: 'Status Updated', 
        message: `Order is now ${newStatus.replace('_', ' ')}`,
        type: 'success'
      });
      fetchOrders();
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message, type: 'error' });
    }
  };

  const handleRemoveItem = async (order: any, itemToRemove: any) => {
    const activeItemsCount = order.order_items?.filter((i: any) => !i.is_removed).length || 0;
    if (activeItemsCount <= 1) {
      showAlert({
        title: 'Cannot Remove',
        message: 'Order must have at least one item. Consider cancelling the order instead.',
        type: 'warning'
      });
      return;
    }

    showAlert({
      title: 'Remove Item',
      message: `Are you sure you want to remove ${itemToRemove.product_name} from this order?`,
      type: 'warning',
      primaryAction: {
        text: 'Remove',
        onPress: async () => {
          try {
            setLoading(true);
            const { error: itemError } = await supabase
              .from('order_items')
              .update({ is_removed: true })
              .eq('id', itemToRemove.id);

            if (itemError) throw itemError;

            const remainingItems = order.order_items.filter((i: any) => i.id !== itemToRemove.id && !i.is_removed);
            const newSubtotal = remainingItems.reduce((acc: number, curr: any) => acc + (curr.product_price * curr.quantity), 0);
            
            const deliveryFee = 25;
            const platformFee = 2;
            const newTotal = newSubtotal + deliveryFee + platformFee;

            const { error: orderError } = await supabase
              .from('orders')
              .update({
                subtotal: newSubtotal,
                total_amount: newTotal,
              })
              .eq('id', order.id);

            if (orderError) throw orderError;

            showAlert({ title: 'Success', message: 'Item removed and order total updated.', type: 'success' });
            fetchOrders();
          } catch (e: any) {
            showAlert({ title: 'Error', message: e.message, type: 'error' });
          } finally {
            setLoading(false);
          }
        },
        variant: 'destructive',
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_verification':
      case 'accepted':
      case 'preparing':
      case 'ready': 
        return Colors.warning;
      case 'picked_up': 
        return '#FF9800';
      case 'delivered': 
        return Colors.success;
      case 'cancelled': 
        return Colors.error;
      default: 
        return Colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending_verification':
      case 'accepted':
      case 'preparing':
      case 'ready': 
        return 'WAITING FOR PICKUP';
      case 'picked_up': 
        return 'PICKED UP';
      case 'delivered': 
        return 'DELIVERED';
      case 'cancelled': 
        return 'CANCELLED';
      default: 
        return status.toUpperCase().replace('_', ' ');
    }
  };

  const renderOrderItem = ({ item }: { item: any }) => {
    const activeItems = item.order_items?.filter((i: any) => !i.is_removed) || [];
    // Allow removal in any state before the rider picks it up
    const isModifiable = ['pending_verification', 'accepted', 'preparing', 'ready'].includes(item.status);

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>#{item.order_number}</Text>
            <Text style={styles.orderDate}>
              {new Date(item.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}, {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[
              styles.statusText, 
              { color: ['pending_verification', 'accepted', 'preparing', 'ready'].includes(item.status) ? Colors.black : getStatusColor(item.status) }
            ]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.customerInfo}>
          <Icon name="account" size={16} color={Colors.textSecondary} />
          <Text style={styles.customerName}>{item.customer?.full_name || 'Guest'}</Text>
        </View>

        {item.rider && (
          <View style={styles.riderInfo}>
            <Icon name="bike" size={16} color={Colors.secondary} />
            <Text style={styles.riderName}>Rider: {item.rider.full_name}</Text>
          </View>
        )}

        <View style={styles.itemsList}>
          {activeItems.map((product: any, idx: number) => (
            <View key={idx} style={styles.itemRowContainer}>
              <Text style={styles.itemRow}>
                {product.quantity}x {product.product_name} (₹{product.product_price})
              </Text>
              {isModifiable && (
                <TouchableOpacity onPress={() => handleRemoveItem(item, product)}>
                  <Icon name="trash-can-outline" size={18} color={Colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        <View style={styles.orderFooter}>
          <View>
            <Text style={styles.amountLabel}>Total (inc. fees)</Text>
            <Text style={styles.amountValue}>₹{item.total_amount}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={[styles.header, { paddingTop: insets.top }]}>
              <Text style={styles.title}>Manage Orders</Text>
              <Text style={styles.subtitle}>{store?.name || 'Store Dashboard'}</Text>
            </View>
          }
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
      <AlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={closeAlert}
        primaryAction={alertConfig.primaryAction}
        secondaryAction={alertConfig.secondaryAction}
      />
    </View>
);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 0,
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
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    backgroundColor: Colors.secondary + '10',
    padding: 6,
    borderRadius: 6,
  },
  riderName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.secondary,
    marginLeft: 6,
  },
  itemsList: {
    marginBottom: Spacing.md,
  },
  itemRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingRight: 4,
  },
  itemRow: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
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
