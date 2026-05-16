import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../../components/ui/Button';
import { getOfferDescription, getItemTotals } from '../../utils/offerUtils';
import { notificationService } from '../../utils/notificationService';

export const CustomerOrdersScreen = ({ navigation, route }: any) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [breakdownModal, setBreakdownModal] = useState<{ visible: boolean; order: any }>({ 
    visible: false, 
    order: null 
  });

  const fetchOrders = useCallback(async () => {
    try {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          stores (id, name, category),
          order_items (
            product_id,
            product_name, 
            quantity, 
            product_price,
            selected_options,
            products (
              id,
              name,
              weight_kg,
              barcode,
              product_type,
              stores (id, name)
            )
          ),
          applied_offers
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (e) {
      // Silent in production
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

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
          // Removed manual filter as RLS already handles privacy and filtering
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders, user?.id]);

  useFocusEffect(
    React.useCallback(() => {
      fetchOrders();
      const onBackPress = () => {
        navigation.navigate('AccountMain');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => subscription.remove();
    }, [navigation, fetchOrders])
  );

  const groupedOrders = React.useMemo(() => {
    return orders.reduce((groups: any, order: any) => {
      const dateObj = new Date(order.created_at);
      const day = dateObj.getDate().toString().padStart(2, '0');
      const month = dateObj.toLocaleDateString('en-IN', { month: 'short' });
      const year = dateObj.getFullYear();
      const formattedDate = `${day} ${month} ${year}`;
      
      if (!groups[formattedDate]) groups[formattedDate] = [];
      groups[formattedDate].push(order);
      return groups;
    }, {});
  }, [orders]);

  const orderList = React.useMemo(() => {
    return Object.keys(groupedOrders).map(date => ({
      title: date,
      data: groupedOrders[date],
    }));
  }, [groupedOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'waiting_for_pickup':
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

  const handleCancelOrder = useCallback((orderId: string, orderNumber: string) => {
    showAlert({
      title: 'Cancel Order',
      message: `Are you sure you want to cancel order #${orderNumber}?`,
      type: 'warning',
      showCancel: true,
      primaryAction: { 
        text: 'Yes, Cancel', 
        onPress: async () => {
          try {
            // First check the latest status from server
            const { data: currentOrder } = await supabase
              .from('orders')
              .select('status')
              .eq('id', orderId)
              .single();

            if (currentOrder && (currentOrder.status === 'picked_up' || currentOrder.status === 'delivered')) {
              fetchOrders(); // Sync local state
              return showAlert({
                title: 'Cannot Cancel Order',
                message: `This order has already been ${currentOrder.status === 'picked_up' ? 'picked up' : 'delivered'} and cannot be cancelled.`,
                type: 'error'
              });
            }

            const { error } = await supabase
              .from('orders')
              .update({ status: 'cancelled' })
              .eq('id', orderId);
            
            if (error) throw error;

            // Notify store(s)
            const order = orders.find(o => o.id === orderId);
            if (order) {
              const storesToNotify = order.store_id 
                ? [order.store_id] 
                : [...new Set(order.order_items.map((oi: any) => oi.products?.stores?.id || oi.products?.store_id))].filter(Boolean);

              // Get owner IDs for stores to send targeted notifications
              const { data: storeOwners } = await supabase
                .from('stores')
                .select('id, owner_id')
                .in('id', storesToNotify);

              const ownerMap = storeOwners?.reduce((acc: any, s) => ({ ...acc, [s.id]: s.owner_id }), {}) || {};

              storesToNotify.forEach((stId: any) => {
                const ownerId = ownerMap[stId];
                if (!ownerId) return;

                notificationService.sendNotification({
                  userId: ownerId,
                  orderId: orderId,
                  title: 'Order Cancelled',
                  description: `Order #${order.order_number} has been cancelled by the customer.`,
                  targetGroup: 'business',
                });
              });
            }

            fetchOrders();
          } catch (error: any) {
            showAlert({ 
              title: 'Cancellation Failed', 
              message: error.message || 'Failed to cancel order. Please try again.', 
              type: 'error' 
            });
          }
        },
        variant: 'destructive',
      },
      cancelText: 'No',
    });
  }, [orders, fetchOrders, showAlert]);

  const renderOrderItem = useCallback(({ item }: { item: any }) => {
    const statusInfo = getStatusInfo(item.status);
    const date = new Date(item.created_at);
    // Can cancel if status is one of the "waiting" statuses
    const canCancel = item.status === 'waiting_for_pickup';
    const formattedTime = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={styles.orderCard}>
        {/* Top Row: Order ID/Date and Status */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.orderNumber}>#{item.order_number}</Text>
            <Text style={styles.dateTime}>
              {formattedTime}
              {item.delivery_type === 'batch' 
                ? (item.delivery_slot && ` • ${item.delivery_slot} Batch`)
                : (item.transport_type === 'heavy' ? ` • Truck` : ` • Bike`)
              }
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '15' }]}>
            <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {(() => {
          const groups: { [key: string]: { name: string, items: any[], id: string } } = {};
          item.order_items.forEach((oi: any) => {
            const product = Array.isArray(oi.products) ? oi.products[0] : oi.products;
            const store = product?.stores || item.stores;
            const sId = store?.id || 'unknown';
            const sName = store?.name || 'Multiple Stores';
            if (!groups[sId]) groups[sId] = { name: sName, items: [], id: sId };
            groups[sId].items.push(oi);
          });

          return Object.values(groups).map((group, gIdx) => (
            <View key={gIdx} style={styles.storeSection}>
              <View style={styles.storeHeaderRow}>
                <Icon name="storefront-outline" size={16} color={Colors.text} />
                <Text style={styles.storeName}>{group.name}</Text>
              </View>
              <View style={styles.itemsList}>
                {(() => {
                  const storeOffer = item.applied_offers?.[group.id];
                  return group.items.map((oi: any, idx: number) => {
                    const { original, discounted } = getItemTotals(oi, group.items, storeOffer);
                    return (
                      <View key={idx} style={styles.orderItemWrapper}>
                        <View style={styles.orderItemRow}>
                          <Text style={styles.itemQty}>{oi.quantity} x</Text>
                          <View style={{flex: 1}}>
                            <Text style={styles.itemName} numberOfLines={1}>
                              {oi.product_name}
                              {oi.selected_options && Object.keys(oi.selected_options).length > 0 && (
                                <Text style={styles.itemOptionsText}>
                                  {` (${Object.entries(oi.selected_options)
                                    .map(([k, v]) => k === 'gift' ? 'Gift' : `${v}`)
                                    .join(', ')})`}
                                </Text>
                              )}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginLeft: 8 }}>
                            {discounted < original - 0.1 ? (
                              <>
                                <Text style={[styles.itemPrice, { textDecorationLine: 'line-through', color: Colors.textSecondary, fontSize: 13 }]}>
                                  ₹{original}
                                </Text>
                                <Text style={[styles.itemPrice, { color: Colors.success }]}>₹{Math.round(discounted)}</Text>
                              </>
                            ) : (
                              <Text style={styles.itemPrice}>₹{original}</Text>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  });
                })()}
              </View>

              {/* Applied Offers for this store */}
              {(() => {
                const storeId = group.id;
                if (!item.applied_offers || !storeId) return null;

                const storeOffers = [];
                const stdOffer = item.applied_offers[storeId];
                const delOffer = item.applied_offers[`${storeId}_delivery`];

                if (stdOffer) storeOffers.push(stdOffer);
                if (delOffer) storeOffers.push(delOffer);

                if (storeOffers.length === 0) return null;

                return (
                  <View style={styles.offersContainer}>
                    {storeOffers.map((offer, oIdx) => (
                      <View key={oIdx} style={styles.promoBadge}>
                        <View style={styles.promoIconContainer}>
                          <Icon name="ticket-percent" size={14} color={Colors.success} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.promoTitle}>{offer.name || 'Special Offer'}</Text>
                          <Text style={styles.promoAmount}>{getOfferDescription(offer)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>
          ));
        })()}

        {/* App Offer Display */}
        {/* App Offer Display */}
        {(() => {
          const appOffer = item.applied_offers?.app_fast_offer || item.applied_offers?.app_batch_offer || item.applied_offers?.app_offer;
          if (!appOffer) return null;
          
          const isFast = !!item.applied_offers?.app_fast_offer;
          const isLegacy = !!item.applied_offers?.app_offer;
          
          return (
            <View style={styles.appOfferBadge}>
              <View style={[styles.appOfferIconBox, isFast && { backgroundColor: Colors.primary }]}>
                <Icon name={isFast ? "flash" : "ticket-percent"} size={14} color={Colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.appOfferTitle}>
                  {isFast ? 'Free Fast Delivery' : 'Free Batch Delivery'}
                </Text>
                <Text style={styles.appOfferDesc}>
                  {isFast 
                    ? 'Free fast delivery above ₹149' 
                    : (isLegacy ? 'Free batch delivery above ₹29' : 'Free batch delivery above ₹49')}
                </Text>
              </View>
            </View>
          );
        })()}

        <View style={styles.cardFooter}>
          {item.transport_type === 'heavy' && item.has_helper && (
            <View style={styles.helperRow}>
              <Text style={styles.helperLabel}>Helper Service</Text>
              <Text style={styles.helperValue}>₹{item.helper_fee}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Grand Total</Text>
              {item.status === 'delivered' && (
                <TouchableOpacity 
                  onPress={() => {
                    const deliveredAt = new Date(item.updated_at).getTime();
                    const now = new Date().getTime();
                    const diffInHours = (now - deliveredAt) / (1000 * 60 * 60);

                    if (diffInHours > 24) {
                      return showAlert({
                        title: 'Return time finished',
                        message: 'Return can be applied only within 24 hours of delivery.',
                        type: 'info'
                      });
                    }
                    navigation.navigate('ApplyReturn', { order: item });
                  }}
                  style={{ marginTop: 4 }}
                >
                  <Text style={styles.applyReturnText}>Apply Return</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.totalAmount}>₹{item.total_amount}</Text>
              <TouchableOpacity 
                onPress={() => setBreakdownModal({ visible: true, order: item })}
                style={{ marginTop: 4 }}
              >
                <Text style={styles.viewSharesText}>View Shares</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {canCancel && (
            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={() => handleCancelOrder(item.id, item.order_number)}
            >
              <Icon name="close-circle-outline" size={18} color={Colors.error} />
              <Text style={styles.cancelBtnText}>Cancel Order</Text>
            </TouchableOpacity>
          )}

          {['waiting_for_pickup', 'picked_up'].includes(item.status) && (
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
  }, [handleCancelOrder]);

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

      <Modal
        visible={breakdownModal.visible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setBreakdownModal({ ...breakdownModal, visible: false })}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setBreakdownModal({ ...breakdownModal, visible: false })}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Price Breakdown</Text>
              <TouchableOpacity onPress={() => setBreakdownModal({ ...breakdownModal, visible: false })}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {breakdownModal.order && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.breakdownSection}>
                  <Text style={styles.breakdownSectionTitle}>Store Shares</Text>
                  {(() => {
                    const storeShares: { [key: string]: number } = {};
                    breakdownModal.order.order_items.forEach((oi: any) => {
                      const sName = oi.products?.stores?.name || breakdownModal.order.stores?.name || 'Store';
                      const storeId = oi.products?.stores?.id || breakdownModal.order.store_id || 'unknown';
                      
                      const storeOffer = breakdownModal.order.applied_offers?.[storeId];
                      const allStoreItems = breakdownModal.order.order_items.filter((i: any) => 
                        (i.products?.stores?.id || breakdownModal.order.store_id) === storeId
                      );
                      
                      const { discounted } = getItemTotals(oi, allStoreItems, storeOffer);

                      if (!storeShares[sName]) storeShares[sName] = 0;
                      storeShares[sName] += discounted;
                    });

                    return Object.entries(storeShares).map(([name, amount], idx) => (
                      <View key={idx} style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>{name}</Text>
                        <Text style={styles.breakdownValue}>₹{Math.round(amount)}</Text>
                      </View>
                    ));
                  })()}
                </View>

                <View style={styles.breakdownSection}>
                  <Text style={styles.breakdownSectionTitle}>Fees & Services</Text>
                  {breakdownModal.order.delivery_fee !== undefined && (
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Delivery Fee</Text>
                      <Text style={styles.breakdownValue}>
                        {(breakdownModal.order.applied_offers?.app_fast_offer || breakdownModal.order.applied_offers?.app_batch_offer || breakdownModal.order.applied_offers?.app_offer) ? '₹0' : `₹${breakdownModal.order.delivery_fee}`}
                      </Text>
                    </View>
                  )}
                  {breakdownModal.order.platform_fee !== undefined && (
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Platform Fee</Text>
                      <Text style={styles.breakdownValue}>₹{breakdownModal.order.platform_fee}</Text>
                    </View>
                  )}
                  {breakdownModal.order.transport_type === 'heavy' && breakdownModal.order.helper_fee !== undefined && (
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Helper Fee</Text>
                      <Text style={styles.breakdownValue}>₹{breakdownModal.order.helper_fee}</Text>
                    </View>
                  )}
                </View>

                <View style={[styles.breakdownRow, styles.grandTotalRow]}>
                  <Text style={styles.grandTotalLabel}>Grand Total</Text>
                  <Text style={styles.grandTotalValue}>₹{breakdownModal.order.total_amount}</Text>
                </View>
              </ScrollView>
            )}

            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setBreakdownModal({ ...breakdownModal, visible: false })}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={[
            styles.listContent, 
            { paddingBottom: insets.bottom + 40 }
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
        >
          {orderList.length > 0 ? (
            orderList.map((group, index) => (
              <View key={group.title} style={index > 0 ? { marginTop: Spacing.xl } : null}>
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderText}>{group.title}</Text>
                  <View style={styles.dateHeaderLine} />
                </View>
                {group.data.map((order: any) => (
                  <React.Fragment key={order.id}>
                    {renderOrderItem({ item: order })}
                  </React.Fragment>
                ))}
              </View>
            ))
          ) : (
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
          )}
        </ScrollView>
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
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
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
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
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
  storeSection: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  storeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
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
    marginBottom: 0,
    gap: 8,
  },
  orderItemWrapper: {
    marginBottom: 0,
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemQty: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    width: 25,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  itemOptionsText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    gap: 16,
    marginTop: Spacing.md,
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
    fontSize: 22,
    fontWeight: '900',
    color: Colors.primary,
  },
  paymentStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  paymentStatusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  applyReturnText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
  },
  viewSharesText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
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
    borderStyle: 'dotted',
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
  offersContainer: {
    marginTop: Spacing.sm,
    gap: 8,
  },
  promoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    gap: 10,
  },
  promoIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.success,
  },
  promoAmount: {
    fontSize: 11,
    color: Colors.success,
    fontWeight: '600',
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: Spacing.xl,
    paddingTop: Spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
  },
  modalBody: {
    marginBottom: Spacing.lg,
  },
  breakdownSection: {
    marginBottom: Spacing.xl,
  },
  breakdownSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  breakdownLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600',
  },
  breakdownValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '800',
  },
  grandTotalRow: {
    borderTopWidth: 2,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
  },
  grandTotalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.primary,
  },
  closeButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  closeButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  appOfferBadge: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryLight,
    padding: 10,
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
    gap: 10,
    alignItems: 'center',
  },
  appOfferIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appOfferTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  appOfferDesc: {
    fontSize: 11,
    color: Colors.primary,
    opacity: 0.8,
  },
});
