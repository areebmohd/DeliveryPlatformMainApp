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
  StatusBar,
  Linking,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { useAlert } from '../../context/AlertContext';
import { useBusinessStore } from '../../context/BusinessStoreContext';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getItemTotals, getOfferDescription } from '../../utils/offerUtils';
import { notificationService } from '../../utils/notificationService';

export const OrdersScreen = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const { activeStore: store, loading: storeLoading } = useBusinessStore();
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const insets = useSafeAreaInsets();
  const [breakdownModal, setBreakdownModal] = useState<{ visible: boolean; order: any }>({ 
    visible: false, 
    order: null 
  });

  const { showAlert } = useAlert();

  useEffect(() => {
    fetchOrders();

    if (!store?.id) return;

    const channel = supabase
      .channel(`store-orders-sync-${store.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchOrders())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [store?.id, activeTab]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const id = store?.id;
      if (!id) {
        setOrders([]);
        return;
      }

      // Query orders that have items from this store
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:profiles!orders_customer_id_fkey (full_name, phone),
          rider:profiles!orders_rider_id_fkey (full_name, phone),
          order_items!inner (*, products!inner(store_id, stores(name))),
          applied_offers
        `)
        .eq('order_items.products.store_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter based on active tab and only show the specified statuses
      const allowedActiveStatuses = ['waiting_for_pickup', 'picked_up'];
      const allowedPastStatuses = ['delivered', 'cancelled'];
      
      const visibleOrders = (data || []).filter((o: any) => {
        const isActive = allowedActiveStatuses.includes(o.status);
        const isPast = allowedPastStatuses.includes(o.status);
        return activeTab === 'active' ? isActive : isPast;
      });
      setOrders(visibleOrders);
    } catch (e) {
      console.error('Error fetching orders:', e);
    } finally {
      setLoading(false);
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

      // Find order to get customer_id and order_number
      const order = orders.find(o => o.id === orderId);
      if (order && order.customer_id) {
        notificationService.sendNotification({
          userId: order.customer_id,
          orderId: order.id,
          title: 'Order Status Update',
          description: `Your order #${order.order_number} is now ${newStatus.replace('_', ' ')}.`,
          targetGroup: 'customer',
        });
      }

      showAlert({ 
        title: 'Status Updated', 
        message: `Order is now ${newStatus.replace('_', ' ')}`,
        type: 'success',
        cancelText: 'OK'
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

              if (order.customer_id) {
                notificationService.sendNotification({
                  userId: order.customer_id,
                  orderId: order.id,
                  title: 'Order Cancelled',
                  description: `Your order #${order.order_number} was cancelled by the store because all items were removed.`,
                  targetGroup: 'customer',
                });
              }

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
              showAlert({ title: 'Success', message: 'Item removed and total updated.', type: 'success', cancelText: 'OK' });
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
      case 'waiting_for_pickup': return Colors.warning;
      case 'picked_up': return '#FF9800';
      case 'delivered': return Colors.success;
      case 'cancelled': return Colors.error;
      default: return Colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'waiting_for_pickup': return 'Waiting for Pickup';
      case 'picked_up': return 'Picked Up';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return status.replace('_', ' ');
    }
  };

  const stats = {
    count: orders.length,
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
    // Filter items to ONLY show those from THIS store
    const storeItems = item.order_items?.filter((i: any) => i.products?.store_id === store?.id) || [];
    const activeItems = storeItems.filter((i: any) => !i.is_removed);
    
    if (activeItems.length === 0) return null; // Should not happen with inner join but safe
    const isModifiable = item.status === 'waiting_for_pickup';
    const statusColor = getStatusColor(item.status);

    return (
      <View key={item.id} style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>#{item.order_number}</Text>
            <Text style={styles.orderTime}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {item.transport_type && ` • ${item.transport_type === 'heavy' ? 'Truck' : 'Bike'}`}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
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
              <Text style={styles.personName}>
                {item.customer?.full_name || 'Unknown Customer'}
              </Text>
              {item.customer?.phone ? (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.customer.phone}`)}>
                  <Text style={[styles.personRole, { color: Colors.primary }]}>
                    Customer • {item.customer.phone}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.personRole}>Customer • No phone</Text>
              )}
            </View>
          </View>

          {item.rider && (
            <View style={[styles.personRow, { marginTop: Spacing.sm }]}>
              <View style={styles.iconCircle}>
                <Icon name="bike" size={16} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.personName}>{item.rider.full_name}</Text>
                {item.rider.phone ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.rider.phone}`)}>
                    <Text style={[styles.personRole, { color: Colors.primary }]}>Delivery Partner • {item.rider.phone}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.personRole}>Delivery Partner • No phone</Text>
                )}
              </View>
            </View>
          )}
        </View>

        <View style={styles.itemsList}>
          <Text style={styles.itemsTitle}>ORDER ITEMS</Text>
          {activeItems.map((product: any, idx: number) => {
            const storeId = store?.id;
            const storeOffer = storeId ? item.applied_offers?.[storeId] : null;
            
            const { original, discounted } = getItemTotals(product, activeItems, storeOffer);

            return (
              <View key={idx} style={styles.itemRowContainer}>
                <View style={styles.itemQuantityBox}>
                  <Text style={styles.itemQuantityText}>{product.quantity}x</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemRowText}>
                    {product.product_name}
                    {product.selected_options && Object.keys(product.selected_options).length > 0 && (
                      <Text style={styles.itemOptionsText}>
                        {` (${Object.entries(product.selected_options)
                          .map(([k, v]) => k === 'gift' ? 'Gift' : `${v}`)
                          .join(', ')})`}
                      </Text>
                    )}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginHorizontal: 8 }}>
                  {discounted < original - 0.1 ? (
                    <>
                      <Text style={[styles.itemPriceText, { textDecorationLine: 'line-through', color: Colors.textSecondary, fontSize: 13 }]}>
                        ₹{original}
                      </Text>
                      <Text style={[styles.itemPriceText, { color: Colors.success, fontWeight: '800' }]}>
                        ₹{Math.round(discounted)}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.itemPriceText}>₹{original}</Text>
                  )}
                </View>
                {isModifiable && (
                  <TouchableOpacity onPress={() => handleRemoveItem(item, product)} style={styles.removeBtn}>
                    <Icon name="close-circle-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* Promotions Section */}
        {(() => {
          const storeId = store?.id;
          if (!item.applied_offers) return null;

          const storeOffers = [];
          if (storeId) {
            const stdOffer = item.applied_offers[storeId];
            const delOffer = item.applied_offers[`${storeId}_delivery`];
            if (stdOffer) storeOffers.push(stdOffer);
            if (delOffer) storeOffers.push(delOffer);
          }

          const hasAppOffer = !!item.applied_offers?.app_offer;
          
          if (storeOffers.length === 0 && !hasAppOffer) return null;

          return (
            <View style={styles.promoContainer}>
              <Text style={styles.promoLabel}>PROMOTIONS APPLIED</Text>
              
              {/* Store Offers */}
              {storeOffers.map((offer, oIdx) => (
                <View key={`store-${oIdx}`} style={styles.promoBadge}>
                  <View style={styles.promoIconCircle}>
                    <Icon name="ticket-percent" size={14} color={Colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.promoTitle}>
                      {offer.name || (offer.type === 'free_delivery' ? 'Free Delivery' : 'Discount Offer')}
                    </Text>
                    <Text style={styles.promoDescription}>
                      {getOfferDescription(offer)}
                    </Text>
                  </View>
                </View>
              ))}

              {/* App Offer */}
              {hasAppOffer && (
                <View style={[styles.promoBadge, { backgroundColor: Colors.primaryLight, borderColor: Colors.primary + '20', borderWidth: 1, marginBottom: 0 }]}>
                  <View style={[styles.promoIconCircle, { backgroundColor: Colors.primary }]}>
                    <Icon name="ticket-percent" size={14} color={Colors.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.promoTitle, { color: Colors.primary }]}>App Offer</Text>
                    <Text style={[styles.promoDescription, { color: Colors.primary, opacity: 0.8 }]}>Free delivery above ₹99</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })()}

        <View style={styles.orderFooter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={styles.amountLabel}>Grand Total</Text>
            <TouchableOpacity onPress={() => setBreakdownModal({ visible: true, order: item })}>
              <Text style={styles.viewSharesText}>View Shares</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            {(() => {
              const storeId = store?.id;
              const storeOffer = storeId ? item.applied_offers?.[storeId] : null;
              const deliveryOffer = item.applied_offers?.[`${storeId}_delivery`];
              const hasDiscount = storeOffer || deliveryOffer;
              
              if (!hasDiscount) {
                return <Text style={styles.amountValue}>₹{item.total_amount}</Text>;
              }

              // Calculate original total before this store's discounts
              let originalTotal = item.total_amount;
              if (storeOffer?.type === 'discount') {
                const storeSubtotal = activeItems.reduce((acc: number, curr: any) => acc + curr.product_price * curr.quantity, 0);
                const discountAmount = storeSubtotal * (storeOffer.amount / 100);
                originalTotal += discountAmount;
              } else if (storeOffer?.type === 'free_cash') {
                originalTotal += storeOffer.amount;
              }
              
              if (deliveryOffer) {
                originalTotal += 25; // Standard delivery fee to add back for strike-through
              }

              return (
                <>
                  <Text style={styles.amountValue}>₹{item.total_amount}</Text>
                  <Text style={[styles.amountValue, { textDecorationLine: 'line-through', color: Colors.textSecondary, fontSize: 16 }]}>
                    ₹{Math.round(originalTotal)}
                  </Text>
                </>
              );
            })()}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <View style={{ height: insets.top, backgroundColor: Colors.background }} />
      <View style={[styles.header, { paddingTop: Spacing.sm }]}>
        <Text style={styles.title}>Orders</Text>
        {stats.count > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{stats.count} {activeTab === 'active' ? 'Active' : 'Past'}</Text>
          </View>
        )}
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
              <Text style={styles.modalTitle}>Order Breakdown</Text>
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
                    const deliverySponsored: { [key: string]: number } = {};
                    
                    breakdownModal.order.order_items.forEach((oi: any) => {
                      const sName = oi.products?.stores?.name || breakdownModal.order.stores?.name || 'Store';
                      const sId = oi.products?.store_id || breakdownModal.order.store_id;
                      
                      const storeOffer = breakdownModal.order.applied_offers?.[sId];
                      const allStoreItems = breakdownModal.order.order_items.filter((i: any) => (i.products?.store_id || breakdownModal.order.store_id) === sId);
                      
                      const { discounted } = getItemTotals(oi, allStoreItems, storeOffer);
                      
                      if (!storeShares[sName]) storeShares[sName] = 0;
                      storeShares[sName] += discounted;
                      
                      // Calculate store sponsored delivery explicitly once per store
                      if (deliverySponsored[sName] === undefined) {
                        const deliveryFeePaidByStore = breakdownModal.order.store_delivery_fees?.[sId] || (breakdownModal.order.applied_offers?.[`${sId}_delivery`] ? 25 : 0);
                        deliverySponsored[sName] = deliveryFeePaidByStore;
                        storeShares[sName] -= deliveryFeePaidByStore;
                      }
                    });
                    
                    // A null store_id on the order object is the reliable indicator of a multi-store order
                    const isMultiStore = breakdownModal.order.store_id === null;

                    return (
                      <>
                        {Object.entries(storeShares).map(([name, amount], idx) => (
                          <View key={idx} style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>{name}</Text>
                            <Text style={styles.breakdownValue}>₹{Math.round(amount)}</Text>
                          </View>
                        ))}
                        {Object.entries(deliverySponsored).filter(([_, amt]) => amt > 0).map(([name, amount], idx) => (
                          <View key={`del-${idx}`} style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>{name} Sponsored Delivery</Text>
                            <Text style={[styles.breakdownValue, { color: Colors.error }]}>-₹{Math.round(amount)}</Text>
                          </View>
                        ))}
                        {isMultiStore && (
                          <Text style={styles.multiStoreNotice}>
                            Multiple stores included in this order.
                          </Text>
                        )}
                      </>
                    );
                  })()}
                </View>

                <View style={styles.breakdownSection}>
                  <Text style={styles.breakdownSectionTitle}>Fees</Text>
                  {breakdownModal.order.delivery_fee !== undefined && (
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Delivery Fee</Text>
                      <Text style={styles.breakdownValue}>
                        {breakdownModal.order.applied_offers?.app_offer ? '₹0' : `₹${breakdownModal.order.delivery_fee}`}
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

                <View style={[styles.breakdownRow, styles.grandTotalRowBreakdown]}>
                  <Text style={styles.grandTotalLabelBreakdown}>Grand Total</Text>
                  <Text style={styles.grandTotalValueBreakdown}>₹{breakdownModal.order.total_amount}</Text>
                </View>
              </ScrollView>
            )}

            <TouchableOpacity 
              style={styles.closeBtn}
              onPress={() => setBreakdownModal({ ...breakdownModal, visible: false })}
            >
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>Past Orders</Text>
        </TouchableOpacity>
      </View>
      {((loading || storeLoading) && !refreshing) ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={[styles.listContent, { paddingTop: Spacing.md, paddingBottom: insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          showsVerticalScrollIndicator={false}
        >

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

      {/* Global AlertModal handles alerts now */}
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
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: borderRadius.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  activeTab: {
    backgroundColor: Colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.primary,
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
    marginBottom: Spacing.sm,
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: 0.5,
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
    fontWeight: '700',
  },
  itemOptionsText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  itemPriceText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
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
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
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
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  viewSharesText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '800',
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
  grandTotalRowBreakdown: {
    borderTopWidth: 2,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
  },
  grandTotalLabelBreakdown: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
  },
  grandTotalValueBreakdown: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.primary,
  },
  closeBtn: {
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
  closeBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  promoContainer: {
    marginBottom: Spacing.md,
    paddingHorizontal: 4,
  },
  promoLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.success,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
   promoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    gap: 12,
    marginBottom: 8,
  },
  promoIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#166534',
  },
  promoDescription: {
    fontSize: 11,
    color: '#15803d',
    fontWeight: '600',
    marginTop: 1,
  },
  multiStoreNotice: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
    backgroundColor: '#F8F9FA',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
});




