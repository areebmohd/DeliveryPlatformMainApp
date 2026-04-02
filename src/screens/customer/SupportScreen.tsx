import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const SUPPORT_EMAIL = 'support@deliveryplatform.com';
const SUPPORT_PHONE = '+919876543210';

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
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <View style={{ height: insets.top, backgroundColor: Colors.background }} />
      <View style={[styles.header, { paddingTop: Spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support Center</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Icon name="chat-question-outline" size={80} color={Colors.primary} />
        </View>
        <Text style={styles.title}>How can we help?</Text>
        <Text style={styles.subtitle}>
          Our support team is ready to assist you with orders, payments, and account details.
        </Text>
        
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, styles.callBtn]} onPress={handleCallSupport}>
            <Icon name="phone" size={24} color={Colors.white} />
            <Text style={styles.btnText}>Call Us</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.emailBtn]} onPress={handleEmailSupport}>
            <Icon name="email" size={24} color={Colors.white} />
            <Text style={styles.btnText}>Email Us</Text>
          </TouchableOpacity>
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
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    elevation: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
    marginBottom: 40,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 16,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  callBtn: {
    backgroundColor: Colors.primary,
  },
  emailBtn: {
    backgroundColor: Colors.success,
  },
  btnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 16,
    marginLeft: 8,
  },
  contactDetails: {
    marginTop: 40,
    gap: 12,
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 20,
    borderRadius: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
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
