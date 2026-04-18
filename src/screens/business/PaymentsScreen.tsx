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

import { useBusinessStore } from '../../context/BusinessStoreContext';

export const PaymentsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { activeStore, loading: storeLoading } = useBusinessStore();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [lastPayout, setLastPayout] = useState<any>(null);

  const fetchPayouts = async () => {
    try {
      if (!activeStore?.id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('payouts')
        .select('*, orders(order_number)')
        .eq('recipient_id', activeStore.id)
        .eq('recipient_type', 'store')
        .order('payment_date', { ascending: false });

      if (error) throw error;
      const payoutList = data || [];
      setPayouts(payoutList);

      // Calculations
      const total = payoutList
        .filter(p => p.status === 'sent')
        .reduce((acc, p) => acc + parseFloat(p.amount), 0);
      setTotalEarned(total);

      const last = payoutList.find(p => p.status === 'sent');
      setLastPayout(last);
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
    fetchPayouts();
  }, [activeStore?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPayouts();
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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Icon name="chevron-left" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payments</Text>
        <View style={{ width: 44 }} />
      </View>

      {((loading || storeLoading) && !refreshing) ? (
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
          <View style={styles.summaryContainer}>
            <View style={styles.mainSummaryCard}>
              <Text style={styles.summaryLabel}>Total Earned</Text>
              <Text style={styles.totalEarnedText}>
                ₹{totalEarned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
              {lastPayout && (
                <View style={styles.lastPayoutContainer}>
                  <Icon name="clock-check-outline" size={12} color={Colors.white + '90'} />
                  <Text style={styles.lastPayoutText}>
                    Last payout: ₹{parseFloat(lastPayout.amount).toFixed(2)} on {new Date(lastPayout.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Settlements</Text>
          </View>

          {sortedGroups.length > 0 ? (
            sortedGroups.map(([date, data]: any) => (
              <View key={date} style={styles.dateGroup}>
                <View style={[styles.card, data.isToday && styles.todayCard]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.dateInfo}>
                      <Text style={styles.dateText}>
                        {data.isToday ? 'Today' : new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                      <View style={[
                        styles.statusBadge, 
                        { backgroundColor: data.status === 'sent' ? Colors.success + '15' : Colors.primary + '15' }
                      ]}>
                        <View style={[
                          styles.statusDot, 
                          { backgroundColor: data.status === 'sent' ? Colors.success : Colors.primary }
                        ]} />
                        <Text style={[
                          styles.statusText, 
                          { color: data.status === 'sent' ? Colors.success : Colors.primary }
                        ]}>
                          {data.status === 'sent' ? 'Settled' : 'Processing'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardAmountText}>₹{data.total.toFixed(2)}</Text>
                  </View>

                  {data.status === 'sent' && data.items[0]?.utr && (
                    <View style={styles.utrSection}>
                      <Text style={styles.utrLabel}>UTR Number</Text>
                      <Text style={styles.utrValue}>{data.items[0].utr}</Text>
                    </View>
                  )}

                  {data.isToday && (
                    <View style={styles.todayInfoBox}>
                      <Icon name="information-outline" size={14} color={Colors.primary} />
                      <Text style={styles.todayInfoText}>Earnings are typically settled within 24 hours.</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Icon name="wallet-outline" size={40} color={Colors.border} />
              </View>
              <Text style={styles.placeholderTitle}>No Earnings Yet</Text>
              <Text style={styles.placeholderSubtitle}>
                Your daily earnings will start appearing here once you complete
                your first order.
              </Text>
            </View>
          )}
          <View style={{ height: 40 }} />
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  backBtn: {
    padding: 8,
    marginRight: Spacing.md,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: Colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: Spacing.md },
  
  summaryContainer: {
    marginVertical: Spacing.md,
  },
  mainSummaryCard: { 
    backgroundColor: Colors.primary, 
    borderRadius: 24, 
    padding: 24, 
    elevation: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  summaryLabel: { color: Colors.white + '90', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  totalEarnedText: { color: Colors.white, fontSize: 36, fontWeight: '900', marginTop: 4 },
  lastPayoutContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 6 },
  lastPayoutText: { color: Colors.white + '90', fontSize: 12, fontWeight: '500' },

  sectionHeader: { marginTop: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: Colors.text, marginLeft: 4 },

  dateGroup: { marginBottom: Spacing.md },
  card: { 
    backgroundColor: Colors.white, 
    borderRadius: 16, 
    padding: 20, 
    elevation: 3, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 4 
  },
  todayCard: { borderLeftWidth: 4, borderLeftColor: Colors.primary },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dateInfo: { gap: 6 },
  dateText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  cardAmountText: { fontSize: 20, fontWeight: '900', color: Colors.text },
  
  utrSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  utrLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
  utrValue: { fontSize: 12, fontWeight: '700', color: Colors.text, marginTop: 2 },
  
  todayInfoBox: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8, padding: 10, backgroundColor: Colors.primary + '08', borderRadius: 12 },
  todayInfoText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', flex: 1 },

  emptyContainer: {
    marginTop: 60,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
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
