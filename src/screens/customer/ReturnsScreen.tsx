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
import { supabase, deleteFile } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const ReturnsScreen = ({ navigation }: any) => {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const { showAlert, showToast, hideAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const fetchReturns = useCallback(async () => {
    try {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('returns')
        .select(`
          *,
          orders (order_number),
          products (name, image_url)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReturns(data || []);
    } catch (e) {
      console.error('Error fetching returns:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReturns();
    setRefreshing(false);
  };

  const handleCancelReturn = async (item: any) => {
    showAlert({
      title: 'Cancel Return?',
      message: 'Are you sure you want to cancel this return request? This action cannot be undone.',
      type: 'warning',
      primaryAction: {
        text: 'No',
        onPress: () => {}, // Modal closes automatically
        variant: 'secondary'
      },
      secondaryAction: {
        text: 'Yes',
        onPress: async () => {
          hideAlert(); // Close alert immediately
          try {
            setLoading(true);
            
            // 1. Delete image from storage
            if (item.image_url) {
              await deleteFile('products', item.image_url);
            }

            // 2. Delete record from database
            const { error: deleteError } = await supabase
              .from('returns')
              .delete()
              .eq('id', item.id);

            if (deleteError) throw deleteError;

            showToast('Return request cancelled successfully', 'success');
            
            // Re-fetch to update UI
            await fetchReturns();
          } catch (e: any) {
            showAlert({ 
              title: 'Error', 
              message: e.message || 'Failed to cancel return. Please try again.', 
              type: 'error' 
            });
          } finally {
            setLoading(false);
          }
        },
        variant: 'destructive'
      },
      showCancel: false
    });
  };

  const getStatusStyle = (status: string, adminComment?: string) => {
    switch (status) {
      case 'pending':
        return { color: Colors.warning, bg: Colors.warning + '15', label: 'Pending', icon: 'clock-outline', note: 'Awaiting admin approval' };
      case 'approved':
        return { 
          color: Colors.success, 
          bg: Colors.success + '15', 
          label: 'Approved', 
          icon: 'check-circle-outline', 
          note: 'Admin has approved your return request, a rider will contact you soon to pickup the return product and you will soon get your exchange.' 
        };
      case 'rejected':
        return { 
          color: Colors.error, 
          bg: Colors.error + '15', 
          label: 'Rejected', 
          icon: 'close-circle-outline', 
          note: adminComment ? `${adminComment}` : 'Request was rejected' 
        };
      case 'returned':
        return { color: Colors.primary, bg: Colors.primary + '15', label: 'Returned', icon: 'package-variant', note: 'Return completed' };
      case 'rider_assigned':
        return { color: Colors.primary, bg: Colors.primary + '15', label: 'Rider Assigned', icon: 'motorbike', note: 'Rider is on the way. Please provide the Pickup OTP.' };
      case 'picked_up_from_customer':
        return { color: Colors.primary, bg: Colors.primary + '15', label: 'Picked Up', icon: 'package-up', note: 'Product is on the way to the store.' };
      case 'dropped_at_store':
        return { color: Colors.primary, bg: Colors.primary + '15', label: 'At Store', icon: 'store', note: 'Product has reached the store. Awaiting exchange processing.' };
      case 'delivering_exchange':
        return { color: Colors.primary, bg: Colors.primary + '15', label: 'Exchange on way', icon: 'truck-delivery', note: 'Rider is bringing your exchange product.' };
      case 'completed':
        return { color: Colors.success, bg: Colors.success + '15', label: 'Completed', icon: 'check-all', note: 'Return process fully completed.' };
      default:
        return { color: Colors.textSecondary, bg: Colors.surface, label: status, icon: 'help-circle-outline', note: '' };
    }
  };

  const renderReturnItem = ({ item }: { item: any }) => {
    const status = getStatusStyle(item.status, item.admin_comment);
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
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.productRow}>
          <Image 
            source={{ uri: item.products?.image_url || item.image_url }} 
            style={styles.productImage} 
          />
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>{item.products?.name}</Text>
            <View style={styles.typeBadgeRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{item.return_type}</Text>
              </View>
              <Text style={styles.reasonText} numberOfLines={1}>
                {item.reason}
              </Text>
            </View>
          </View>
        </View>

        {!['completed', 'returned', 'rejected'].includes(item.status) && item.image_url && (
          <TouchableOpacity onPress={() => Linking.openURL(item.image_url)} style={{ marginTop: 8, marginBottom: 0 }}>
            <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: 13 }}>
              View uploaded image
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.footerNote}>
            <Icon name={status.icon} size={16} color={status.color} />
            <Text style={[styles.footerNoteText, { color: status.color }]}>
              {status.note}
            </Text>
          </View>
          {item.status === 'pending' && (
            <TouchableOpacity 
              style={styles.cancelBtn}
              onPress={() => handleCancelReturn(item)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Display OTPs based on status */}
        {item.status === 'rider_assigned' && item.otp_customer_pickup && (
          <View style={[styles.otpBox, { backgroundColor: Colors.primary + '10' }]}>
            <Text style={styles.otpLabel}>Pickup OTP</Text>
            <Text style={styles.otpValue}>{item.otp_customer_pickup}</Text>
          </View>
        )}
        
        {item.status === 'delivering_exchange' && item.otp_customer_exchange && (
          <View style={[styles.otpBox, { backgroundColor: Colors.primary + '10' }]}>
            <Text style={styles.otpLabel}>Exchange Delivery OTP</Text>
            <Text style={styles.otpValue}>{item.otp_customer_exchange}</Text>
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
        <Text style={styles.screenTitle}>Applied Returns</Text>
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
              <Text style={styles.emptyTitle}>No returns applied</Text>
              <Text style={styles.emptySubtitle}>
                Any return requests you make will appear here with their status.
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
  reasonText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  typeBadge: {
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  footerNoteText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border + '50',
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.error + '10',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.error,
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
    marginTop: Spacing.sm,
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

export default ReturnsScreen;
