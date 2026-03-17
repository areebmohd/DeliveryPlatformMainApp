import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
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

    const channel = supabase
      .channel(`store-orders-sync-${store.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${store.id}` }, () => fetchOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchOrders())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [store?.id]);

  const fetchStoreAndOrders = async () => {
    try {
      setLoading(true);
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('id, name')
        .eq('owner_id', user?.id)
        .single();

      if (storeError) throw storeError;
      setStore(storeData);
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
    else {
      // Filter out only completed (delivered) orders, keep cancelled and others
      const visibleOrders = (data || []).filter((o: any) => o.status !== 'delivered');
      setOrders(visibleOrders);
    }
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
        type: 'success',
        showCancel: false
      });
      fetchOrders();
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message, type: 'error' });
    }
  };

  const handleRemoveItem = async (order: any, itemToRemove: any) => {
    const activeItems = order.order_items?.filter((i: any) => !i.is_removed) || [];
    const isLastItem = activeItems.length <= 1;

    showAlert({
      title: isLastItem ? 'Cancel Order?' : 'Remove Item',
      message: isLastItem 
        ? `Removing "${itemToRemove.product_name}" will cancel the entire order. Proceed?`
        : `Are you sure you want to remove "${itemToRemove.product_name}" from this order?`,
      type: 'warning',
      primaryAction: {
        text: isLastItem ? 'Remove & Cancel' : 'Remove',
        onPress: async () => {
          try {
            setLoading(true);
            const { error: itemError } = await supabase
              .from('order_items')
              .update({ is_removed: true })
              .eq('id', itemToRemove.id);

            if (itemError) throw itemError;

            if (isLastItem) {
              const { error: orderError } = await supabase
                .from('orders')
                .update({ status: 'cancelled' })
                .eq('id', order.id);
              if (orderError) throw orderError;
              showAlert({ title: 'Order Cancelled', message: 'The order was cancelled because all items were removed.', type: 'info' });
            } else {
              const remainingItems = activeItems.filter((i: any) => i.id !== itemToRemove.id);
              const newSubtotal = remainingItems.reduce((acc: number, curr: any) => acc + (curr.product_price * curr.quantity), 0);
              const deliveryFee = 25;
              const platformFee = 2;
              const newTotal = newSubtotal + deliveryFee + platformFee;

              const { error: orderError } = await supabase
                .from('orders')
                .update({ subtotal: newSubtotal, total_amount: newTotal })
                .eq('id', order.id);

              if (orderError) throw orderError;
              showAlert({ title: 'Success', message: 'Item removed and total updated.', type: 'success', showCancel: false });
            }
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
      case 'ready': return Colors.warning;
      case 'picked_up': return '#FF9800';
      case 'delivered': return Colors.success;
      case 'cancelled': return Colors.error;
      default: return Colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending_verification':
      case 'accepted':
      case 'preparing':
      case 'ready': return 'Waiting for Pickup';
      case 'picked_up': return 'Picked Up';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return status.replace('_', ' ');
    }
  };

  const stats = {
    active: orders.length,
  };

  // Group orders by date
  const groupedOrders = orders.reduce((groups: any, order: any) => {
    const dateObj = new Date(order.created_at);
    // Explicitly format as Day Month Year
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = dateObj.toLocaleDateString([], { month: 'short' });
    const year = dateObj.getFullYear();
    const formattedDate = `${day} ${month} ${year}`;
    
    if (!groups[formattedDate]) groups[formattedDate] = [];
    groups[formattedDate].push(order);
    return groups;
  }, {});

  const orderList = Object.keys(groupedOrders).map(date => ({
    title: date,
    data: groupedOrders[date],
  }));

  const renderOrderCard = (item: any) => {
    const activeItems = item.order_items?.filter((i: any) => !i.is_removed) || [];
    const isModifiable = ['pending_verification', 'accepted', 'preparing', 'ready'].includes(item.status);
    const statusColor = getStatusColor(item.status);

    return (
      <View key={item.id} style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>#{item.order_number}</Text>
            <Text style={styles.orderTime}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.peopleSection}>
          <View style={styles.personRow}>
            <View style={styles.iconCircle}>
              <Icon name="account" size={16} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.personName}>{item.customer?.full_name || 'Guest Customer'}</Text>
              <Text style={styles.personRole}>Customer • {item.customer?.phone || 'No phone'}</Text>
            </View>
          </View>

          {item.rider && (
            <View style={[styles.personRow, { marginTop: Spacing.sm }]}>
              <View style={[styles.iconCircle, { backgroundColor: Colors.secondary + '15' }]}>
                <Icon name="bike" size={16} color={Colors.secondary} />
              </View>
              <View>
                <Text style={[styles.personName, { color: Colors.secondary }]}>{item.rider.full_name}</Text>
                <Text style={styles.personRole}>Delivery Partner</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.itemsList}>
          <Text style={styles.itemsTitle}>ORDER ITEMS</Text>
          {activeItems.map((product: any, idx: number) => (
            <View key={idx} style={styles.itemRowContainer}>
              <View style={styles.itemQuantityBox}>
                <Text style={styles.itemQuantityText}>{product.quantity}x</Text>
              </View>
              <Text style={styles.itemRowText} numberOfLines={1}>
                {product.product_name}
              </Text>
              <Text style={styles.itemPriceText}>₹{product.product_price * product.quantity}</Text>
              {isModifiable && (
                <TouchableOpacity onPress={() => handleRemoveItem(item, product)} style={styles.removeBtn}>
                  <Icon name="close-circle-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        <View style={styles.orderFooter}>
          <View>
            <Text style={styles.amountLabel}>Grand Total</Text>
            <Text style={styles.amountValue}>₹{item.total_amount}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={[styles.listContent, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Orders</Text>
            {stats.active > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{stats.active} Active</Text>
              </View>
            )}
          </View>

          {orderList.length > 0 ? orderList.map((group) => (
            <View key={group.title}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateHeaderText}>{group.title}</Text>
                <View style={styles.dateHeaderLine} />
              </View>
              {group.data.map((order: any) => renderOrderCard(order))}
            </View>
          )) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Icon name="clipboard-text-outline" size={48} color={Colors.border} />
              </View>
              <Text style={styles.emptyTitle}>All Clear!</Text>
              <Text style={styles.emptySubtitle}>You don't have any orders yet.</Text>
            </View>
          )}
        </ScrollView>
      )}

      <AlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={closeAlert}
        primaryAction={alertConfig.primaryAction}
        secondaryAction={alertConfig.secondaryAction}
        showCancel={alertConfig.showCancel !== undefined ? alertConfig.showCancel : alertConfig.type !== 'success'}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  headerBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    gap: 10,
  },
  dateHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: 0.5,
  },
  orderTime: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  peopleSection: {
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    borderRadius: borderRadius.lg,
    marginBottom: Spacing.md,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  personRole: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  itemsList: {
    marginBottom: Spacing.md,
    paddingHorizontal: 4,
  },
  itemsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  itemRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemQuantityBox: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 10,
  },
  itemQuantityText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  itemRowText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
  },
  itemPriceText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginHorizontal: 8,
  },
  removeBtn: {
    padding: 2,
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
    fontWeight: '600',
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});




