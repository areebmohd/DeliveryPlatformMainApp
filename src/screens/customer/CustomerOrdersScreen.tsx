import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../../components/ui/Button';

export const CustomerOrdersScreen = ({ navigation }: any) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

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

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        navigation.navigate('AccountMain');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => subscription.remove();
    }, [navigation])
  );

  const fetchOrders = async () => {
    try {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          stores (name, category),
          order_items (
            product_name, 
            quantity, 
            product_price,
            products (
              stores (name)
            )
          )
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
      case 'accepted':
      case 'preparing':
      case 'ready':
        return { label: 'Waiting for Pickup', color: Colors.warning, icon: 'clock-outline' };
      case 'picked_up':
        return { label: 'Picked Up', color: Colors.primary, icon: 'truck-delivery-outline' };
      case 'delivered':
        return { label: 'Delivered', color: Colors.success, icon: 'check-circle-outline' };
      case 'cancelled':
        return { label: 'Cancelled', color: Colors.error, icon: 'close-circle-outline' };
      default:
        return { label: status, color: Colors.textSecondary, icon: 'help-circle' };
    }
  };

  const handleCancelOrder = (orderId: string, orderNumber: string) => {
    showAlert({
      title: 'Cancel Order',
      message: `Are you sure you want to cancel order #${orderNumber}?`,
      type: 'warning',
      showCancel: true,
      primaryAction: { 
        text: 'Yes, Cancel', 
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('orders')
              .update({ status: 'cancelled' })
              .eq('id', orderId);
            
            if (error) throw error;
            fetchOrders();
          } catch (error) {
            console.error('Error cancelling order:', error);
            showAlert({ title: 'Error', message: 'Failed to cancel order. Please try again.', type: 'error' });
          }
        },
        variant: 'destructive',
      },
      cancelText: 'No',
    });
  };

  const renderOrderItem = ({ item }: { item: any }) => {
    const statusInfo = getStatusInfo(item.status);
    const date = new Date(item.created_at);
    const formattedDate = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const formattedTime = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    
    // Can cancel if status is one of the "waiting" statuses
    const canCancel = ['pending_verification', 'accepted', 'preparing', 'ready'].includes(item.status);

    return (
      <View style={styles.orderCard}>
        {/* Top Row: Order ID/Date and Status */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.orderNumber}>#{item.order_number}</Text>
            <Text style={styles.dateTime}>{formattedDate}, {formattedTime}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '15' }]}>
            <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {/* Transport Type Row */}
        <View style={styles.transportRow}>
          <Icon 
            name={item.transport_type === 'heavy' ? 'truck-delivery' : 'motorbike'} 
            size={18} 
            color={Colors.textSecondary} 
          />
          <Text style={styles.transportLabel}>
            {item.transport_type === 'heavy' ? 'Large Vehicle Delivery' : 'Standard Bike Delivery'}
          </Text>
        </View>

        {/* Items Grouped by Store */}
        {(() => {
          const groups: { [key: string]: any[] } = {};
          item.order_items.forEach((oi: any) => {
            const sName = oi.products?.stores?.name || item.stores?.name || 'Multiple Stores';
            if (!groups[sName]) groups[sName] = [];
            groups[sName].push(oi);
          });

          return Object.keys(groups).map((sName, gIdx) => (
            <View key={gIdx} style={{ marginTop: Spacing.sm }}>
              <Text style={styles.storeName}>{sName}</Text>
              <View style={styles.itemsList}>
                {groups[sName].map((oi: any, idx: number) => (
                  <View key={idx} style={styles.orderItemWrapper}>
                    <View style={styles.orderItemRow}>
                      <View style={styles.itemLeft}>
                        <Text style={styles.itemQty}>{oi.quantity} x</Text>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {oi.product_name}
                          {oi.selected_options && Object.keys(oi.selected_options).length > 0 && (
                            <Text style={styles.itemOptionsText}>
                              {` (${Object.values(oi.selected_options).join(', ')})`}
                            </Text>
                          )}
                        </Text>
                      </View>
                      <Text style={styles.itemPrice}>₹{oi.product_price * oi.quantity}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ));
        })()}

        <View style={styles.cardFooter}>
          {item.has_helper && (
            <View style={styles.helperRow}>
              <Text style={styles.helperLabel}>Helper Service</Text>
              <Text style={styles.helperValue}>₹{item.helper_fee}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalAmount}>₹{item.total_amount}</Text>
          </View>

          {item.payment_method === 'pay_online' && (
            <View style={styles.paymentDetailsContainer}>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Payment Method:</Text>
                <Text style={styles.paymentValue}>Online (UPI)</Text>
              </View>
              {item.utr_number && (
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>UTR Number:</Text>
                  <Text style={styles.paymentValue}>{item.utr_number}</Text>
                </View>
              )}
              {item.payer_name && (
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Payer Name:</Text>
                  <Text style={styles.paymentValue}>{item.payer_name}</Text>
                </View>
              )}
            </View>
          )}
          
          {canCancel && (
            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={() => handleCancelOrder(item.id, item.order_number)}
            >
              <Icon name="close-circle-outline" size={18} color={Colors.error} />
              <Text style={styles.cancelBtnText}>Cancel Order</Text>
            </TouchableOpacity>
          )}

          {['ready', 'picked_up'].includes(item.status) && (
            <View style={styles.otpSection}>
              <Icon name="shield-lock" size={18} color={Colors.primary} />
              <View style={styles.otpInfo}>
                <Text style={styles.otpLabel}>Delivery OTP</Text>
                <Text style={styles.otpValue}>{item.delivery_otp}</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.screenHeader}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.navigate('AccountMain')}
        >
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Orders</Text>
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
          contentContainerStyle={[
            styles.listContent, 
            { paddingBottom: insets.bottom + 40 }
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="shopping-outline" size={80} color={Colors.border} />
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySubtitle}>When you place an order, it will appear here.</Text>
              <Button 
                title="Start Shopping" 
                onPress={() => navigation.navigate('Home')}
                style={{ marginTop: 24, width: '100%' }}
              />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: Colors.white,
    marginRight: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  listContent: {
    padding: Spacing.md,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
    marginRight: 10,
  },
  orderNumber: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '800',
    marginBottom: 2,
  },
  dateTime: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  storeName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  itemsList: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  orderItemWrapper: {
    marginBottom: 10,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemQty: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginRight: 8,
    width: 25,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  itemOptionsText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  optionsBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  optionBadge: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  optionBadgeLabel: {
    fontSize: 9,
    color: Colors.textSecondary,
    fontWeight: '700',
    marginRight: 2,
  },
  optionBadgeValue: {
    fontSize: 9,
    color: Colors.text,
    fontWeight: '800',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    gap: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.primary,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error + '30',
    backgroundColor: Colors.error + '05',
    gap: 8,
  },
  cancelBtnText: {
    color: Colors.error,
    fontSize: 15,
    fontWeight: '700',
  },
  otpSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '08',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
    borderStyle: 'dashed',
  },
  otpInfo: {
    marginLeft: 12,
  },
  otpLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  otpValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 4,
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
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: 6,
  },
  transportLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  helperLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  helperValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  paymentDetailsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  paymentLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  paymentValue: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '700',
  },
});
