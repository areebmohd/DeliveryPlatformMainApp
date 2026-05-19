import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { supabase } from '../../api/supabase';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height } = Dimensions.get('window');

type UserRole = 'customer' | 'store';

export const AuthScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<UserRole>('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (route.params?.verificationSuccess) {
      Alert.alert('Success', route.params.message || 'Email verified successfully!');
    }
  }, [route.params]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;
      const userEmail = userInfo.data?.user?.email;

      if (!idToken) throw new Error('No ID token present');
      if (!userEmail) throw new Error('No email found in Google account');

      // Check for existing role before signing in with Supabase
      const { data: existingRole, error: checkError } = await supabase.rpc('check_email_exists', {
        email_to_check: userEmail.toLowerCase().trim(),
      });

      if (checkError) throw checkError;

      let isNewUser = true;

      if (existingRole) {
        let rawRole = existingRole;
        if (Array.isArray(existingRole) && existingRole.length > 0) {
          rawRole = existingRole[0].check_email_exists || existingRole[0];
        } else if (typeof existingRole === 'object' && existingRole !== null) {
          rawRole = (existingRole as any).check_email_exists || existingRole;
        }
        
        const cleanedExistingRole = String(rawRole).trim().toLowerCase();
        
        if (cleanedExistingRole !== 'null' && cleanedExistingRole !== 'undefined' && cleanedExistingRole !== '' && cleanedExistingRole !== 'exists_no_profile') {
          isNewUser = false;
          if (cleanedExistingRole !== role.toLowerCase()) {
            const roleDisplay = cleanedExistingRole === 'store' ? 'Business' : 'Customer';
            setError(`This email is registered as a ${roleDisplay}. Please switch your selection to ${roleDisplay}.`);
            setLoading(false);
            await GoogleSignin.signOut(); 
            return;
          }
        }
      }

      const { data, error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (authError) throw authError;

      // Ensure profile contains correct role on signup
      if (data.user) {
        if (isNewUser) {
          // 1. Explicitly force-upsert the public profile to set the selected 'store' role first
          await supabase.from('profiles').upsert({ 
            id: data.user.id,
            email: userEmail.toLowerCase().trim(),
            role, 
            full_name: userInfo.data?.user?.name || 'New User',
            updated_at: new Date().toISOString()
          });

          // 2. Force update the selected role in user metadata (this triggers onAuthStateChange to refresh AuthContext)
          await supabase.auth.updateUser({
            data: { role, full_name: userInfo.data?.user?.name || 'New User' }
          });
        } else {
          // Double check if profile exists (e.g. pre-registered user)
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
          if (!profile?.role) {
            await supabase.from('profiles').upsert({ 
              id: data.user.id,
              email: userEmail.toLowerCase().trim(),
              role, 
              full_name: userInfo.data?.user?.name || 'New User' 
            });
          }
        }
      }
      
    } catch (e: any) {
      if (e.code !== statusCodes.SIGN_IN_CANCELLED) {
        setError(e.message || 'Google sign-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLink = (url: string) => {
    Linking.openURL(url).catch((err) => console.error("Couldn't load page", err));
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.xxl + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Left-Aligned Heading */}
          <View style={styles.headerContainer}>
            <Text style={styles.welcomeText}>Get Started,</Text>
            <Text style={styles.subHeaderText}>Choose your account type</Text>
          </View>

          {/* Vertical Role Cards */}
          <View style={styles.roleContainer}>
            <Pressable 
              style={({ pressed }) => [
                styles.roleCard, 
                role === 'customer' && styles.roleCardActive,
                pressed && role !== 'customer' && styles.roleCardPressed
              ]}
              onPress={() => setRole('customer')}
            >
              <View style={[styles.roleIconContainer, role === 'customer' && styles.roleIconContainerActive]}>
                <Icon 
                  name="account" 
                  size={26} 
                  color={role === 'customer' ? Colors.white : Colors.textSecondary} 
                />
              </View>
              <View style={styles.roleTextContainer}>
                <Text style={[styles.roleCardTitle, role === 'customer' && styles.roleCardTitleActive]}>Customer</Text>
                <Text style={[styles.roleCardSubtitle, role === 'customer' && styles.roleCardSubtitleActive]}>Order food and goods locally</Text>
              </View>
              <View style={[styles.radioButton, role === 'customer' && styles.radioButtonActive]}>
                <View style={[styles.radioButtonInner, role === 'customer' && styles.radioButtonInnerActive]} />
              </View>
            </Pressable>
            
            <Pressable 
              style={({ pressed }) => [
                styles.roleCard, 
                role === 'store' && styles.roleCardActive,
                pressed && role !== 'store' && styles.roleCardPressed
              ]}
              onPress={() => setRole('store')}
            >
              <View style={[styles.roleIconContainer, role === 'store' && styles.roleIconContainerActive]}>
                <Icon 
                  name="store" 
                  size={26} 
                  color={role === 'store' ? Colors.white : Colors.textSecondary} 
                />
              </View>
              <View style={styles.roleTextContainer}>
                <Text style={[styles.roleCardTitle, role === 'store' && styles.roleCardTitleActive]}>Business</Text>
                <Text style={[styles.roleCardSubtitle, role === 'store' && styles.roleCardSubtitleActive]}>Manage your store and deliveries</Text>
              </View>
              <View style={[styles.radioButton, role === 'store' && styles.radioButtonActive]}>
                <View style={[styles.radioButtonInner, role === 'store' && styles.radioButtonInnerActive]} />
              </View>
            </Pressable>
          </View>

          {/* AND Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>AND</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Main Action Area */}
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={[styles.googleButton, loading && styles.googleButtonDisabled]} 
              onPress={handleGoogleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={Colors.primary} size="small" />
              ) : (
                <>
                  <Icon name="google" size={24} color="#EA4335" />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {error ? (
              <View style={styles.errorContainer}>
                <Icon name="alert-circle" size={20} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
        
        {/* Modern Minimal Footer */}
        <View style={[styles.footerContainer, { paddingBottom: Math.max(insets.bottom, Spacing.xl)}]}>
          <Text style={styles.footerText} numberOfLines={1} adjustsFontSizeToFit>
            By continuing, you agree to our{' '}
            <Text style={styles.footerLink} onPress={() => handleOpenLink('https://zorodeliveryapp.vercel.app/terms.html')}>
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text style={styles.footerLink} onPress={() => handleOpenLink('https://zorodeliveryapp.vercel.app/privacy.html')}>
              Privacy Policy
            </Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  headerContainer: {
    marginBottom: Spacing.xl,
    alignItems: 'flex-start',
    marginTop: Spacing.xxl,
  },
  welcomeText: {
    fontSize: 40,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -1.5,
    textAlign: 'left',
  },
  subHeaderText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '400',
    marginTop: 6,
    textAlign: 'left',
  },
  roleContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  roleCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  roleCardPressed: {
    backgroundColor: Colors.border,
  },
  roleIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  roleIconContainerActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  roleTextContainer: {
    flex: 1,
  },
  roleCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  roleCardTitleActive: {
    color: Colors.white,
  },
  roleCardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '400',
  },
  roleCardSubtitleActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  radioButtonActive: {
    borderColor: Colors.white,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  radioButtonInnerActive: {
    backgroundColor: Colors.white,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 1.5,
  },
  actionContainer: {
    gap: Spacing.md,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    gap: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  googleButtonDisabled: {
    opacity: 0.7,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: Spacing.xs,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  footerContainer: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: Colors.primary,
    fontWeight: '700',
  },
});

