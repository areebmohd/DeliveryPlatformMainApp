import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  SectionList,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../theme/colors';
import { supabase } from '../../api/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const NotificationsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${user.id},and(user_id.is.null,target_group.eq.customer)`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by date
      const grouped: { [key: string]: any[] } = {};
      data?.forEach(notif => {
        const date = new Date(notif.created_at);
        const dateStr = date.toDateString();
        
        let label = dateStr;
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        if (dateStr === today) label = 'Today';
        else if (dateStr === yesterday) label = 'Yesterday';

        if (!grouped[label]) grouped[label] = [];
        grouped[label].push(notif);
      });

      const sectionData = Object.keys(grouped).map(key => ({
        title: key,
        data: grouped[key],
      }));

      setSections(sectionData);

      // Mark as read by saving the latest timestamp
      if (data && data.length > 0) {
        const latestTime = data[0].created_at;
        await AsyncStorage.setItem('last_seen_notification_time', latestTime);
      }
    } catch (e) {
      console.error('Error fetching notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [user]);

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.notificationCard}>
      <View style={styles.iconContainer}>
        <Icon name="bell-ring-outline" size={24} color={Colors.primary} />
      </View>
      <View style={styles.textContainer}>
        <View style={styles.cardHeader}>
          <Text style={styles.notifTitle}>{item.title}</Text>
          <Text style={styles.notifTime}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <Text style={styles.notifDesc}>{item.description}</Text>
      </View>
    </View>
  );

  const renderSectionHeader = ({ section: { title } }: any) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="bell-off-outline" size={80} color={Colors.border} />
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptySubtitle}>You're all caught up!</Text>
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
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl * 2,
  },
  sectionHeader: {
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: 16,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  iconContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    flex: 1,
  },
  notifTime: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  notifDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
});
