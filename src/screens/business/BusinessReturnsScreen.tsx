import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { supabase } from '../../api/supabase';
import { useBusinessStore } from '../../context/BusinessStoreContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const BusinessReturnsScreen = ({ navigation }: any) => {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { activeStore } = useBusinessStore();
  const insets = useSafeAreaInsets();

  const fetchReturns = useCallback(async () => {
    try {
      if (!activeStore?.id) return;
      
      const { data, error } = await supabase
        .from('returns')
        .select(`
          *,
          products!inner(name, image_url, store_id),
          orders(order_number),
          profiles:user_id(full_name, phone)
        `)
        .eq('products.store_id', activeStore.id)
        .in('status', ['approved', 'returned', 'refund_paid', 'rider_assigned', 'picked_up_from_customer', 'dropped_at_store', 'delivering_exchange', 'completed'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReturns(data || []);
    } catch (e) {
      console.error('Error fetching business returns:', e);
    } finally {
      setLoading(false);
    }
  }, [activeStore?.id]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReturns();
    setRefreshing(false);
  };

  const renderReturnItem = ({ item }: { item: any }) => {
    const date = new Date(item.created_at).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    return (
      <View style={styles.returnCard}>
        <View style={styles.cardHeader}>
          <View style={styles.headerInfo}>
            <Text style={styles.orderIdText}>Order #{item.orders?.order_number}</Text>
            <Text style={styles.dateText}>{date}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: (item.status === 'approved' || item.status === 'refund_paid' || item.status === 'completed') ? Colors.success + '15' : Colors.primary + '15' }]}>
            <Text style={[styles.statusLabel, { color: (item.status === 'approved' || item.status === 'refund_paid' || item.status === 'completed') ? Colors.success : Colors.primary }]}>
              {item.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.productRow}>
          <Image 
            source={{ uri: item.products?.image_url || item.image_url }} 
            style={styles.productImage} 
          />
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>{item.products?.name}</Text>
            <View style={styles.userRow}>             
              <Text style={styles.userName}>{item.profiles?.full_name}</Text>
            </View>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{item.return_type}</Text>
            </View>
          </View>
        </View>

        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Reason</Text>
          <Text style={styles.reasonText}>{item.reason}</Text>
        </View>

        {!['completed', 'returned', 'rejected'].includes(item.status) && item.image_url && (
          <TouchableOpacity onPress={() => Linking.openURL(item.image_url)} style={{ marginTop: 8, marginBottom: 0, marginLeft: 12 }}>
            <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: 13 }}>
              View uploaded image
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.cardFooter}>
          <Icon name="truck-delivery-outline" size={18} color={Colors.primary} />
          <Text style={styles.footerNoteText}>
            Rider will bring back the returned product to you for Refund/Exchange.
          </Text>
        </View>

        {item.status === 'picked_up_from_customer' && item.otp_store_drop && (
          <View style={[styles.otpBox, { backgroundColor: Colors.primary + '10' }]}>
            <Text style={styles.otpLabel}>Store Drop OTP</Text>
            <Text style={styles.otpValue}>{item.otp_store_drop}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.screenHeader}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Approved Returns</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={returns}
          renderItem={renderReturnItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="keyboard-return" size={80} color={Colors.border} />
              <Text style={styles.emptyTitle}>No approved returns</Text>
              <Text style={styles.emptySubtitle}>
                When returns are approved by admin, they will appear here for your reference.
              </Text>
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
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
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
  returnCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
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
    marginBottom: Spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  userName: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  typeBadge: {
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  reasonBox: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border + '50',
  },
  footerNoteText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    flex: 1,
    fontStyle: 'italic',
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
  otpBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  otpLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  otpValue: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
    color: Colors.primary,
  },
});
