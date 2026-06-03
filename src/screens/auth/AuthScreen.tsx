import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { supabase } from '../../api/supabase';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

type UserRole = 'customer' | 'store';

export const AuthScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<UserRole>('customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordInputRef = useRef<TextInput>(null);

  const validateEmail = (emailStr: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr.toLowerCase().trim());

  // ─── Email / Password: unified Continue handler ───────────────────────────
  const handleContinue = async () => {
    setError('');
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    // Synchronize states to update the UI text fields with trimmed values
    setEmail(trimmedEmail);
    setPassword(trimmedPassword);

    if (!trimmedEmail || !trimmedPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (email.toLowerCase().trim() === 'zorodeliveryapp@gmail.com') {
      setError('This email is for admin only. Please use the Admin Web Portal.');
      return;
    }

    setLoading(true);
    try {
      const { data: existingRole, error: checkError } = await supabase.rpc('check_email_exists', {
        email_to_check: email.toLowerCase().trim(),
      });
      if (checkError) console.error('Role check error:', checkError);

      if (existingRole) {
        // ── EXISTING USER → Sign In ──
        if (existingRole === 'rider') {
          setError('This email is for a rider account. Please use the Rider app.');
          return;
        }
        const isBusinessSelection = role === 'store';
        const isBusinessRole = existingRole === 'store' || existingRole === 'admin';
        if (isBusinessSelection && !isBusinessRole) {
          setError('This account is a Customer account. Please select Customer.');
          return;
        }
        if (!isBusinessSelection && isBusinessRole) {
          setError('This account is a Business account. Please select Business.');
          return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password: trimmedPassword,
        });
        if (signInError) {
          const msg = signInError.message.toLowerCase();
          if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
            setError('Wrong password. Please try again or tap Forgot Password.');
          } else {
            setError(signInError.message || 'Login failed. Please try again.');
          }
        }
      } else {
        // ── NEW USER → Sign Up ──
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.toLowerCase().trim(),
          password: trimmedPassword,
          options: { data: { role, full_name: 'New User' } },
        });
        if (signUpError) {
          setError(signUpError.message || 'Registration failed. Please try again.');
        }
        // Navigation handled by auth state listener in App.tsx
      }
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // ─── Google Sign-In ──────────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;
      const userEmail = userInfo.data?.user?.email;

      if (!idToken) throw new Error('No ID token present');
      if (!userEmail) throw new Error('No email found in Google account');

      if (userEmail.toLowerCase().trim() === 'zorodeliveryapp@gmail.com') {
        setError('This email is for admin only. Please use the Admin Web Portal.');
        await GoogleSignin.signOut();
        return;
      }

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
        const cleanedRole = String(rawRole).trim().toLowerCase();
        if (cleanedRole && cleanedRole !== 'null' && cleanedRole !== 'undefined' && cleanedRole !== 'exists_no_profile') {
          isNewUser = false;
          if (cleanedRole === 'rider') {
            setError('This email is for a rider account. Please use the Rider app.');
            await GoogleSignin.signOut();
            return;
          }
          if (cleanedRole !== role.toLowerCase()) {
            const roleDisplay = cleanedRole === 'store' ? 'Business' : 'Customer';
            setError(`This email is registered as ${roleDisplay}. Please switch your selection.`);
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

      if (data.user) {
        if (isNewUser) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            email: userEmail.toLowerCase().trim(),
            role,
            full_name: userInfo.data?.user?.name || 'New User',
            updated_at: new Date().toISOString(),
          });
          await supabase.auth.updateUser({
            data: { role, full_name: userInfo.data?.user?.name || 'New User' },
          });
        } else {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
          if (!profile?.role) {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              email: userEmail.toLowerCase().trim(),
              role,
              full_name: userInfo.data?.user?.name || 'New User',
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

  const handleOpenLink = (url: string) =>
    Linking.openURL(url).catch((err) => console.error("Couldn't load page", err));

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerContainer}>
            <Text style={styles.welcomeText}>Get Started,</Text>
            <Text style={styles.subHeaderText}>Select your account type</Text>
          </View>

          {/* Inline Role Segmented Control */}
          <View style={styles.roleContainer}>
            <TouchableOpacity
              style={[styles.roleButton, role === 'customer' && styles.roleButtonActive]}
              onPress={() => setRole('customer')}
            >
              <Text style={[styles.roleText, role === 'customer' && styles.roleTextActive]}>
                Customer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleButton, role === 'store' && styles.roleButtonActive]}
              onPress={() => setRole('store')}
            >
              <Text style={[styles.roleText, role === 'store' && styles.roleTextActive]}>
                Business
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email / Password Form */}
          <View style={styles.formContainer}>
            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              ref={passwordInputRef}
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              secureTextEntry
              autoCapitalize="none"
            />

            {error ? (
              <View style={styles.errorContainer}>
                <Icon name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <Button
              title="Continue"
              onPress={handleContinue}
              loading={loading}
            />
          </View>

          {/* OR Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Button */}
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
                <Icon name="google" size={22} color="#EA4335" />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer - fixed at bottom, outside KeyboardAvoidingView */}
      <View style={[styles.footerContainer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <Text style={styles.footerText}>
          By continuing, you agree to our{' '}
          <Text style={styles.footerLink} onPress={() => handleOpenLink('https://zorodelivery.vercel.app/terms.html')}>
            Terms of Service
          </Text>
          {' '}and{' '}
          <Text style={styles.footerLink} onPress={() => handleOpenLink('https://zorodelivery.vercel.app/privacy.html')}>
            Privacy Policy
          </Text>
          . For any enquiries{' '}
          <Text style={styles.footerLink} onPress={() => handleOpenLink('https://zorodelivery.vercel.app/#contact')}>
            Contact Us
          </Text>
          .
        </Text>
      </View>
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
  },
  welcomeText: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -1,
  },
  subHeaderText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '400',
    marginTop: 4,
  },
  // Inline segmented role picker
  roleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleButtonActive: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    elevation: 1,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  roleTextActive: {
    color: Colors.primary,
  },
  // Form
  formContainer: {
    marginBottom: Spacing.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.md,
    marginTop: 6,
  },
  forgotPasswordText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
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
    letterSpacing: 1,
  },
  // Google Button
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
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
    opacity: 0.6,
    backgroundColor: Colors.surface,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  // Footer
  footerContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
