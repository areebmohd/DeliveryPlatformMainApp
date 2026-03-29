import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const AdvertiseScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <View style={{ height: insets.top, backgroundColor: Colors.background }} />
      <View style={[styles.header, { paddingTop: Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Advertise</Text>
      </View>
      <View style={styles.content}>
        <Icon name="bullhorn" size={80} color={Colors.primary} />
        <Text style={styles.comingSoonTitle}>Grow Your Business</Text>
        <Text style={styles.comingSoonSubtitle}>
          Promote your store and products to more customers in your area. Run ads, create offers, and boost your sales!
        </Text>
        <Text style={styles.badge}>COMING SOON</Text>
      </View>
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
    paddingBottom: Spacing.md,
  },
  backBtn: {
    backgroundColor: Colors.white,
    padding: 8,
    borderRadius: 25,
    marginRight: Spacing.md,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  comingSoonSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  badge: {
    backgroundColor: Colors.primary + '20',
    color: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '800',
  },
});
