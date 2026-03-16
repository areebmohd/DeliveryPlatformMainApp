import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../../api/supabase';

export const BusinessAccountScreen = ({ navigation }: any) => {
  const { profile, signOut, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [store, setStore] = useState<any>(null);

  useEffect(() => {
    fetchStore();
  }, []);

  const fetchStore = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', user?.id)
        .single();
      
      if (data) setStore(data);
    } catch (e) {
      console.error('Error fetching store info', e);
    }
  };

  const AccountOption = ({ icon, title, onPress, color = Colors.text }: any) => (
    <TouchableOpacity style={styles.optionItem} onPress={onPress}>
      <View style={styles.optionLeft}>
        <View style={[styles.iconContainer, { backgroundColor: Colors.primaryLight }]}>
          <Icon name={icon} size={22} color={color === Colors.primary || color === Colors.secondary ? Colors.black : color} />
        </View>
        <Text style={[styles.optionTitle, { color: Colors.text }]}>{title}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={Colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Business Account</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Box 1: Profile */}
        <View style={styles.card}>
          <View style={styles.profileInfo}>
            <View style={styles.avatar}>
              <Icon name="store" size={30} color={Colors.primary} />
            </View>
            <View style={styles.profileDetails}>
              <Text style={styles.storeName}>{store?.name || 'Your Store'}</Text>
              <Text style={styles.emailValue}>{user?.email}</Text>
            </View>
          </View>
        </View>

        {/* Box 2: Features */}
        <View style={styles.card}>
          <AccountOption 
            icon="bell-outline" 
            title="Notifications" 
            onPress={() => navigation.navigate('Notifications')} 
            color={Colors.primary}
          />
          <View style={styles.separator} />
          <AccountOption 
            icon="crown-outline" 
            title="Premium" 
            onPress={() => navigation.navigate('Premium')} 
            color="#FFD700"
          />
          <View style={styles.separator} />
          <AccountOption 
            icon="chart-areaspline" 
            title="Dashboard" 
            onPress={() => navigation.navigate('Dashboard')} 
            color={Colors.secondary}
          />
        </View>

        {/* Box 3: Account */}
        <View style={styles.card}>
          <View style={styles.emailContainer}>
            <View style={styles.optionLeft}>
              <View style={[styles.iconContainer, { backgroundColor: Colors.textSecondary + '15' }]}>
                <Icon name="email-outline" size={22} color={Colors.textSecondary} />
              </View>
              <View>
                <Text style={styles.emailLabel}>Logged in as</Text>
                <Text style={styles.emailValue}>{user?.email}</Text>
              </View>
            </View>
          </View>
          <View style={styles.separator} />
          <AccountOption 
            icon="logout" 
            title="Sign Out" 
            onPress={signOut} 
            color={Colors.error}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xs,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  profileDetails: {
    flex: 1,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  emailValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  emailLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  emailContainer: {
    paddingVertical: Spacing.sm,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F3F5',
    marginLeft: 56,
    marginVertical: 4,
  },
});
