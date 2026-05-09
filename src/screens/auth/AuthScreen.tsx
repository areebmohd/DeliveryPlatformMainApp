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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../api/supabase';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height } = Dimensions.get('window');

type UserRole = 'customer' | 'store';

export const AuthScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<UserRole>('customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (route.params?.verificationSuccess) {
      Alert.alert('Success', route.params.message || 'Email verified successfully!');
    }
  }, [route.params]);

  const handleAuthSubmit = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: existingRole, error: checkError } = await supabase.rpc('check_email_exists', {
        email_to_check: email.toLowerCase().trim(),
      });

      if (checkError) throw checkError;

      if (existingRole) {
        let rawRole = existingRole;
        if (Array.isArray(existingRole) && existingRole.length > 0) {
          rawRole = existingRole[0].check_email_exists || existingRole[0];
        } else if (typeof existingRole === 'object' && existingRole !== null) {
          rawRole = (existingRole as any).check_email_exists || existingRole;
        }
        
        const cleanedExistingRole = String(rawRole).trim().toLowerCase();
        
        if (cleanedExistingRole !== 'null' && cleanedExistingRole !== 'undefined' && cleanedExistingRole !== '' && cleanedExistingRole !== 'exists_no_profile') {
          if (cleanedExistingRole !== role.toLowerCase()) {
            const roleDisplay = cleanedExistingRole === 'store' ? 'Business' : 'Customer';
            setError(`This email is registered as a ${roleDisplay}. Please select the correct role above.`);
            setLoading(false);
            return;
          }
        }

        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password,
        });

        if (loginError) {
          if (loginError.message.toLowerCase().includes('email not confirmed')) {
             await supabase.auth.resend({
               type: 'signup',
               email: email.toLowerCase().trim(),
             });
             navigation.navigate('VerifyEmailOTP', { email: email.toLowerCase().trim() });
          } else {
            throw loginError;
          }
        }
      } else {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.toLowerCase().trim(),
          password,
          options: {
            data: {
              role: role,
              full_name: email.split('@')[0],
            },
          },
        });

        if (signUpError) {
          if (signUpError.message.toLowerCase().includes('already registered')) {
            // Fallback: If signup says they exist, try logging them in
            const { error: retryLoginError } = await supabase.auth.signInWithPassword({
              email: email.toLowerCase().trim(),
              password,
            });
            if (retryLoginError) throw retryLoginError;
          } else {
            throw signUpError;
          }
        }

        if (signUpData.user) {
          Alert.alert(
            'Verification Required',
            'A verification code has been sent to your email.',
            [{ text: 'OK', onPress: () => navigation.navigate('VerifyEmailOTP', { email: email.toLowerCase().trim() }) }]
          );
        }
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

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

      // Debug alert for Google flow
      // Alert.alert('DEBUG Google', `Role for ${userEmail}: ${JSON.stringify(existingRole)}`);

      if (existingRole) {
        let rawRole = existingRole;
        if (Array.isArray(existingRole) && existingRole.length > 0) {
          rawRole = existingRole[0].check_email_exists || existingRole[0];
        } else if (typeof existingRole === 'object' && existingRole !== null) {
          rawRole = (existingRole as any).check_email_exists || existingRole;
        }
        
        const cleanedExistingRole = String(rawRole).trim().toLowerCase();
        
        if (cleanedExistingRole !== 'null' && cleanedExistingRole !== 'undefined' && cleanedExistingRole !== '' && cleanedExistingRole !== 'exists_no_profile') {
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

      // ONLY update the role if the user doesn't have one or is new
      if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
        
        if (!profile?.role) {
          await supabase.auth.updateUser({
            data: { role, full_name: userInfo.data?.user?.name || 'New User' }
          });
          
          await supabase.from('profiles').upsert({ 
            id: data.user.id,
            email: userEmail.toLowerCase().trim(),
            role, 
            full_name: userInfo.data?.user?.name || 'New User' 
          });
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
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.xl }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerContainer}>
            <Text style={styles.welcomeText}>Welcome</Text>
            <Text style={styles.subHeaderText}>Join the revolution</Text>
          </View>

          <View style={styles.roleContainer}>
            <TouchableOpacity 
              style={[styles.roleButton, role === 'customer' && styles.roleButtonActive]}
              onPress={() => setRole('customer')}
            >
              <Icon 
                name="account" 
                size={20} 
                color={role === 'customer' ? Colors.primary : Colors.textSecondary} 
                style={styles.roleIcon}
              />
              <Text style={[styles.roleText, role === 'customer' && styles.roleTextActive]}>Customer</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.roleButton, role === 'store' && styles.roleButtonActive]}
              onPress={() => setRole('store')}
            >
              <Icon 
                name="store" 
                size={20} 
                color={role === 'store' ? Colors.primary : Colors.textSecondary} 
                style={styles.roleIcon}
              />
              <Text style={[styles.roleText, role === 'store' && styles.roleTextActive]}>Business</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            <Input
              placeholder="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              containerStyle={styles.inputStyle}
            />
            <Input
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              containerStyle={styles.inputStyle}
            />

            <TouchableOpacity 
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotButton}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Button
              title={loading ? "" : "Continue"}
              onPress={handleAuthSubmit}
              loading={loading}
              style={styles.submitButton}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity 
              style={styles.googleButton} 
              onPress={handleGoogleLogin}
              disabled={loading}
            >
              <Icon name="google" size={24} color="#EA4335" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our{' '}
            <Text style={styles.footerLink} onPress={() => handleOpenLink('https://zorodeliveryapp.vercel.app/terms.html')}>
              Terms & Conditions
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
    marginBottom: Spacing.xxl,
    marginTop: Spacing.md,
  },
  welcomeText: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.black,
    letterSpacing: -1,
  },
  subHeaderText: {
    fontSize: 18,
    color: Colors.textSecondary,
    fontWeight: '400',
    marginTop: -2,
  },
  roleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: Spacing.lg,
    overflow: 'visible', // Ensure shadows aren't clipped
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  roleIcon: {
    marginRight: 8,
  },
  roleButtonActive: {
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, // Increased for visibility
    shadowRadius: 8, // Increased for visibility
    elevation: 5, // Increased for Android
    zIndex: 10, // Ensure shadow isn't covered
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  roleTextActive: {
    color: Colors.primary,
  },
  formContainer: {
    gap: Spacing.md,
  },
  inputStyle: {
    marginBottom: 0,
  },
  submitButton: {
    height: 60,
    borderRadius: borderRadius.md,
    marginTop: Spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
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
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  forgotButton: {
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  forgotText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  footerContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
