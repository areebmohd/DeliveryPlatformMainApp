import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  StatusBar, 
  Linking, 
  Dimensions,
  ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');
const SUPPORT_EMAIL = 'zorodeliveryapp@gmail.com';
const SUPPORT_PHONE = '+91 7534846938';

const SupportActionCard = ({ 
  icon, 
  title, 
  subtitle, 
  onPress, 
  color = Colors.primary,
  secondaryColor = Colors.primaryLight
}: { 
  icon: string; 
  title: string; 
  subtitle: string; 
  onPress: () => void;
  color?: string;
  secondaryColor?: string;
}) => (
  <TouchableOpacity 
    style={styles.actionCard} 
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={[styles.iconBox, { backgroundColor: secondaryColor }]}>
      <Icon name={icon} size={32} color={color} />
    </View>
    <View style={styles.cardInfo}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </View>
    <Icon name="chevron-right" size={24} color={Colors.border} />
  </TouchableOpacity>
);

export const SupportScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();

  const handleEmailSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Customer%20Support%20Request`);
  };

  const handleCallSupport = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      {/* Premium Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Customer Support</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.heroText}>How can we help you today?</Text>
          <Text style={styles.heroSubText}>Our support team is ready to assist you with orders, payments, and account details.</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONTACT US</Text>
          <SupportActionCard 
            icon="phone-outline"
            title="Call Support"
            subtitle="Immediate assistance for your active orders"
            onPress={handleCallSupport}
            color={Colors.primary}
            secondaryColor={Colors.primaryLight}
          />
          <SupportActionCard 
            icon="email-outline"
            title="Email Support"
            subtitle="Best for account or refund inquiries"
            onPress={handleEmailSupport}
            color={Colors.success}
            secondaryColor={Colors.successLight}
          />
        </View>

        <View style={styles.contactDetails}>
          <View style={styles.contactItem}>
            <Icon name="phone-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.contactText}>{SUPPORT_PHONE}</Text>
          </View>
          <View style={styles.contactItem}>
            <Icon name="email-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.contactText}>{SUPPORT_EMAIL}</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Icon name="clock-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>Available for all your requests</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="shield-check-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>Your satisfaction is our priority</Text>
          </View>
        </View>

        <Text style={styles.footerNote}>
          We typically respond to emails within 24 hours. For urgent order issues, please use the call option.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  headerContent: {
    paddingHorizontal: Spacing.lg,
    marginTop: 20,
  },
  heroText: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 32,
  },
  heroSubText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  section: {
    gap: Spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: borderRadius.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  infoBox: {
    marginTop: 30,
    backgroundColor: Colors.border + '40',
    padding: 20,
    borderRadius: 20,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  footerNote: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 12,
    color: Colors.textSecondary + '80',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  contactDetails: {
    marginTop: 24,
    gap: 12,
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 20,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
  },
});
