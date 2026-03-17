import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const CustomerOrdersScreen = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchOrders();

    // Subscribe to real-time order updates for this customer
    const channel = supabase
      .channel(`customer-orders-${user?.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `customer_id=eq.${user?.id}`,
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

  const fetchOrders = async () => {
    try {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          stores (name, category),
          order_items (product_name, quantity)
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (e) {
      console.error('Error fetching customer orders:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending_verification': 
        return { label: 'Wait for Verification', color: Colors.warning, icon: 'clock-outline' };
      case 'accepted': 
        return { label: 'Order Accepted', color: Colors.secondary, icon: 'check-circle-outline' };
      case 'preparing': 
        return { label: 'Preparing Food', color: '#2196F3', icon: 'silverware-lean' };
      case 'ready': 
        return { label: 'Ready for Pickup', color: '#9C27B0', icon: 'package-variant' };
      case 'delivered': 
        return { label: 'Delivered', color: Colors.success, icon: 'checkbox-marked-circle' };
      case 'cancelled': 
        return { label: 'Cancelled', color: Colors.error, icon: 'close-circle-outline' };
      default: 
        return { label: status, color: Colors.textSecondary, icon: 'help-circle' };
    }
  };

  const renderOrderItem = ({ item }: { item: any }) => {
    const statusInfo = getStatusInfo(item.status);
    
    return (
      <View style={styles.orderCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.storeName}>{item.stores?.name}</Text>
            <Text style={styles.orderNumber}>#{item.order_number}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '15' }]}>
            <Icon name={statusInfo.icon} size={14} color={statusInfo.color} />
            <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        <View style={styles.itemsSummary}>
          {item.order_items.map((oi: any, idx: number) => (
            <Text key={idx} style={styles.itemText} numberOfLines={1}>
              {oi.quantity}x {oi.product_name}
            </Text>
          ))}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.orderDate}>
            {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={styles.totalAmount}>₹{item.total_amount}</Text>
        </View>

        {item.status === 'ready' && (
          <View style={styles.otpSection}>
            <Icon name="shield-lock-outline" size={16} color={Colors.primary} />
            <Text style={styles.otpText}>Delivery OTP: <Text style={styles.otpValue}>{item.delivery_otp}</Text></Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>My Orders</Text>
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
              <Icon name="shopping-outline" size={80} color={Colors.border} />
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySubtitle}>When you place an order, it will appear here.</Text>
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
  screenHeader: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  listContent: {
    padding: Spacing.md,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  orderNumber: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  itemsSummary: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  itemText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderDate: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  otpSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: Colors.primary + '10',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    borderStyle: 'dashed',
  },
  otpText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 6,
    fontWeight: '600',
  },
  otpValue: {
    color: Colors.primary,
    fontWeight: '800',
    letterSpacing: 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
