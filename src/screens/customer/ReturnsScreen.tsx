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

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: Colors.warning, bg: Colors.warning + '15', label: 'Pending' };
      case 'approved':
        return { color: Colors.success, bg: Colors.success + '15', label: 'Approved' };
      case 'rejected':
        return { color: Colors.error, bg: Colors.error + '15', label: 'Rejected' };
      case 'returned':
        return { color: Colors.primary, bg: Colors.primary + '15', label: 'Returned' };
      default:
        return { color: Colors.textSecondary, bg: Colors.surface, label: status };
    }
  };

  const renderReturnItem = ({ item }: { item: any }) => {
    const status = getStatusStyle(item.status);
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

        {item.status === 'pending' && (
          <View style={styles.cardFooter}>
            <View style={styles.footerNote}>
              <Icon name="clock-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.footerNoteText}>Awaiting admin approval</Text>
            </View>
            <TouchableOpacity 
              style={styles.cancelBtn}
              onPress={() => handleCancelReturn(item)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
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
});
