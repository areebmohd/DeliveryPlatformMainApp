import React, { useState, useEffect, useCallback } from 'react';
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
import { Colors, Spacing } from '../../theme/colors';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const AddressesScreen = ({ navigation }: any) => {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { showAlert, showToast } = useAlert();

  const fetchAddresses = useCallback(async () => {
    try {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (e) {
      // Silent in production
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAddresses();
    setRefreshing(false);
  };

  const handleSetDefault = async (id: string) => {
    try {
      setLoading(true);
      // First, set all user addresses to is_default = false
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user?.id);

      // Then, set the selected one as true
      const { error } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;
      await fetchAddresses();
      showToast('Default address updated', 'success');
    } catch (e) {
      showAlert({ title: 'Error', message: 'Failed to set default address', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = (id: string) => {
    showAlert({
      title: 'Delete Address',
      message: 'Are you sure you want to delete this address?',
      type: 'warning',
      showCancel: true,
      primaryAction: {
        text: 'Delete',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('addresses')
              .update({ is_deleted: true })
              .eq('id', id);
            if (error) throw error;
            await fetchAddresses();
            showToast('Address deleted', 'success');
          } catch (e) {
            showAlert({ title: 'Error', message: 'Failed to delete address', type: 'error' });
          }
        },
        variant: 'destructive',
      },
      cancelText: 'Cancel',
    });
  };

  const renderAddressItem = useCallback(({ item }: { item: any }) => (
    <View style={styles.addressCard}>
      <View style={styles.addressContent}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.labelRow}>
            <Icon name={item.label === 'Home' ? 'home-outline' : item.label === 'Work' ? 'briefcase-outline' : 'map-marker-outline'} size={20} color={Colors.primary} />
            <Text style={styles.addressLabel}>{item.label}</Text>
          </View>
          {item.is_default && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultText}>Default</Text>
            </View>
          )}
        </View>
        <Text style={styles.addressText}>
          {item.address_line}, {item.city}, {item.state}
        </Text>
        
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => navigation.navigate('AddAddress', { address: item })}
          >
            <Icon name="pencil-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.actionBtnText}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => handleDeleteAddress(item.id)}
          >
            <Icon name="delete-outline" size={18} color={Colors.error} />
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>

          {!item.is_default && (
            <TouchableOpacity 
              style={styles.defaultActionBtn}
              onPress={() => handleSetDefault(item.id)}
            >
              <Text style={styles.defaultActionText}>Set as Default</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  ), [navigation, handleSetDefault, handleDeleteAddress]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Addresses</Text>
      </View>

      <TouchableOpacity 
        style={styles.addNewCard}
        onPress={() => navigation.navigate('AddAddress', { fromAddresses: true })}
      >
        <View style={styles.addIconCircle}>
          <Icon name="plus" size={24} color={Colors.primary} />
        </View>
        <View>
          <Text style={styles.addTitle}>Add New Address</Text>
          <Text style={styles.addSubtitle}>Save your home, work or other addresses</Text>
        </View>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={addresses}
          renderItem={renderAddressItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="map-marker-off-outline" size={80} color={Colors.border} />
              <Text style={styles.emptyTitle}>No addresses saved</Text>
              <Text style={styles.emptySubtitle}>Add an address to make checkout faster</Text>
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
  header: {
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  addNewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  addIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  addTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  addSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
  },
  addressCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  addressContent: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginLeft: 8,
  },
  defaultBadge: {
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  defaultText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  receiverName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 6,
  },
  phoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
    gap: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  defaultActionBtn: {
    marginLeft: 'auto',
    backgroundColor: '#F0F0FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  defaultActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  deleteBtn: {
    padding: 8,
    justifyContent: 'flex-start',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    marginTop: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.error,
  },
});
