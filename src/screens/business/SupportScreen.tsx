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
const WHATSAPP_GROUP_LINK = 'https://chat.whatsapp.com/DKOZQlWaIOTAUYU1miYRuj';

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

const TipItem = ({ number, text }: { number: number; text: string }) => (
  <View style={styles.tipItem}>
    <View style={styles.tipNumberBox}>
      <Text style={styles.tipNumber}>{number}</Text>
    </View>
    <View style={styles.tipContent}>
      <Text style={styles.tipText}>{text}</Text>
    </View>
  </View>
);

export const SupportScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();

  const handleEmailSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Business%20Support%20Request`);
  };

  const handleCallSupport = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`);
  };

  const handleJoinWhatsApp = () => {
    Linking.openURL(WHATSAPP_GROUP_LINK);
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
          <Text style={styles.headerTitle}>Business Support</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.heroText}>How can we help your business?</Text>
          <Text style={styles.heroSubText}>Our dedicated business team is available to help you with orders, payouts, and store management.</Text>
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
            title="Call Now"
            subtitle="Immediate assistance for store operations"
            onPress={handleCallSupport}
            color={Colors.primary}
            secondaryColor={Colors.primaryLight}
          />
          <SupportActionCard 
            icon="email-outline"
            title="Email Support"
            subtitle="Best for account, banking or payout issues"
            onPress={handleEmailSupport}
            color="#4F46E5"
            secondaryColor="#E0E7FF"
          />
          <SupportActionCard 
            icon="whatsapp"
            title="WhatsApp Group"
            subtitle="Join for latest updates and partner news"
            onPress={handleJoinWhatsApp}
            color="#25D366"
            secondaryColor="#E7FFDB"
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

        <View style={styles.tipsSection}>
          <View style={styles.tipsHeader}>
            <Icon name="lightbulb-on-outline" size={24} color={Colors.primary} />
            <Text style={styles.tipsSectionTitle}>Success Tips</Text>
          </View>
          
          <TipItem 
            number={1} 
            text="Pack the products as soon as possible when order arrives so rider wont have to wait longer for pickup." 
          />
          <TipItem 
            number={2} 
            text="Keep a separate stock of products for online orders and enter that stock amount in product form so that you never run out of products when order arrives." 
          />
          <TipItem 
            number={3} 
            text="If you remove some products from the stock of products for online orders for offline use then update stock amount in product form." 
          />
          <TipItem 
            number={4} 
            text="If still your product is not available when order arrives then it is better to buy that product from neighbour shop or give the money for buying the product to rider and ask him to buy it from other shop and deliver to customer so that your customer do not get disappointed with your service." 
          />

        </View>

        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Icon name="clock-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>Priority support for business partners</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="shield-check-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>Your business success is our goal</Text>
          </View>
        </View>

        <Text style={styles.footerNote}>
          Partner support is available during business hours. For technical emergencies, please use the hotline.
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
  tipsSection: {
    marginTop: 32,
    backgroundColor: Colors.white,
    padding: 20,
    borderRadius: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  tipsSectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  tipNumberBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  tipNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  tipContent: {
    flex: 1,
  },
  tipText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    fontWeight: '500',
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
