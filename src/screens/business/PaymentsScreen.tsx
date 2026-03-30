import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';

export const PaymentsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payouts, setPayouts] = useState<any[]>([]);

  const fetchStoreAndPayouts = async () => {
    try {
      const { data: storeData } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user?.id)
        .maybeSingle();

      if (!storeData) {
        setLoading(false);
        return;
      }

      // Fetch ALL payouts for this store (including pending)
      const { data, error } = await supabase
        .from('payouts')
        .select('*, orders(order_number)')
        .eq('recipient_id', storeData.id)
        .eq('recipient_type', 'store')
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPayouts(data || []);
    } catch (e: any) {
      console.error('Error fetching payouts:', e);
      showAlert({
        title: 'Error',
        message: 'Could not load your earnings.',
        type: 'error',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStoreAndPayouts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStoreAndPayouts();
  };

  const groupByDate = (data: any[]) => {
    const today = new Date().toISOString().split('T')[0];
    const groups: Record<string, any> = {};

    data.forEach(p => {
      const date = p.payment_date;
      if (!groups[date]) {
        groups[date] = {
          total: 0,
          status: p.status,
          utr: null,
          isToday: date === today,
          items: [],
        };
      }
      groups[date].total += parseFloat(p.amount);
      groups[date].items.push(p);

      // If any part of the day is not 'sent', showing its respective status
      if (p.status !== 'sent' && groups[date].status === 'sent') {
        groups[date].status = p.status;
      }
    });

    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  };

  const sortedGroups = groupByDate(payouts);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <View
        style={{ height: insets.top, backgroundColor: Colors.background }}
      />
      <View style={[styles.header, { paddingTop: Spacing.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payments</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {sortedGroups.length > 0 ? (
            sortedGroups.map(([date, data]: any) => (
              <View key={date} style={styles.dateGroup}>
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderText}>
                    {data.isToday
                      ? 'TODAY'
                      : new Date(date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                  </Text>
                  <View style={styles.dateHeaderLine} />
                </View>

                <View style={[styles.card, data.isToday && styles.todayCard]}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.orderNumber}>Total Earnings</Text>
                      <Text
                        style={[
                          styles.statusText,
                          {
                            color:
                              data.status === 'sent'
                                ? Colors.success
                                : Colors.textSecondary,
                          },
                        ]}
                      >
                        {data.status === 'sent'
                          ? 'Paid'
                          : data.isToday
                          ? 'Accumulating...'
                          : 'Awaiting Settlement'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.amountText,
                        {
                          color:
                            data.status === 'sent'
                              ? Colors.success
                              : Colors.text,
                        },
                      ]}
                    >
                      ₹{data.total.toFixed(2)}
                    </Text>
                  </View>

                  {data.status === 'sent' && data.utr && (
                    <View style={styles.utrContainer}>
                      <Icon
                        name="check-circle"
                        size={14}
                        color={Colors.success}
                      />
                      <Text style={styles.utrText}>UTR: {data.utr}</Text>
                    </View>
                  )}

                  {data.isToday && (
                    <View style={styles.todayHint}>
                      <Icon
                        name="information-outline"
                        size={12}
                        color={Colors.textSecondary}
                      />
                      <Text style={styles.todayHintText}>
                        Settlements are processed at the end of each day.
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="cash-off" size={80} color={Colors.border} />
              <Text style={styles.placeholderTitle}>No Earnings Yet</Text>
              <Text style={styles.placeholderSubtitle}>
                Your daily earnings will start appearing here once you complete
                your first order.
              </Text>
            </View>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  backBtn: {
    backgroundColor: Colors.white,
    padding: 8,
    borderRadius: 25,
    marginRight: Spacing.md,
    elevation: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: Spacing.md },
  card: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  todayCard: { borderLeftWidth: 4, borderLeftColor: Colors.primary },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateGroup: { marginBottom: Spacing.md },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: 10,
  },
  dateHeaderText: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateHeaderLine: { flex: 1, height: 1, backgroundColor: Colors.border + '50' },
  orderNumber: { fontSize: 16, fontWeight: '800', color: Colors.text },
  statusText: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  amountText: { fontSize: 24, fontWeight: '900' },
  utrContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.success + '10',
    borderRadius: borderRadius.md,
    gap: 6,
  },
  utrText: { fontSize: 13, fontWeight: '800', color: Colors.success },
  todayHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  todayHintText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  emptyContainer: {
    marginTop: 100,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 20,
  },
  placeholderSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
});
