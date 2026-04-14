import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Colors, Spacing } from '../../theme/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../api/supabase';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'store'>('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Pre-login role validation
      const { data: existingRole, error: checkError } = await supabase.rpc('check_email_exists', {
        email_to_check: email.toLowerCase().trim(),
      });

      if (checkError) {
        console.error('Error checking role:', checkError);
      } else if (!existingRole) {
        setError('No account found with this email.');
        setLoading(false);
        return;
      } else {
        if (existingRole === 'rider') {
          setError('This email is registered for a rider account. Please use a different email or log in to the Rider app.');
          setLoading(false);
          return;
        }

        const isBusinessSelection = role === 'store';
        const isBusinessRole = existingRole === 'store' || existingRole === 'admin';
        
        if (isBusinessSelection && !isBusinessRole) {
          setError('This account is registered as a Customer. Please select the correct option.');
          setLoading(false);
          return;
        } else if (!isBusinessSelection && isBusinessRole) {
          setError('This account is registered as a Business. Please select the correct option.');
          setLoading(false);
          return;
        }
      }

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          try {
            await supabase.auth.resend({
              type: 'signup',
              email: email.toLowerCase().trim(),
            });
            setError('Your email is not verified. A new code has been sent.');
            navigation.navigate('VerifyEmailOTP', { email: email.toLowerCase().trim() });
          } catch (resendError: any) {
            setError(resendError.message || error.message);
          }
        } else {
          throw error;
        }
        setLoading(false);
        return;
      }
      // Navigation handled by auth state listener in App.tsx
    } catch (e: any) {
      setError(e.message || 'An error occurred during login');
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
      const emailAddress = userInfo.data?.user?.email;

      if (!idToken) {
        throw new Error('No ID token present');
      }

      // Check if email already exists with a different role
      if (emailAddress) {
        const { data: existingRole, error: checkError } = await supabase.rpc('check_email_exists', {
          email_to_check: emailAddress.toLowerCase().trim(),
        });

        if (checkError) {
          console.error('Error checking role:', checkError);
        } else if (existingRole) {
          if (existingRole === 'rider') {
            setError('This email is registered for a rider account. Please use a different email or log in to the Rider app.');
            await GoogleSignin.signOut();
            setLoading(false);
            return;
          }

          const isBusinessSelection = role === 'store';
          const isBusinessRole = existingRole === 'store' || existingRole === 'admin';
          
          if (isBusinessSelection && !isBusinessRole) {
            const roleLabel = existingRole === 'store' ? 'Business' : existingRole.charAt(0).toUpperCase() + existingRole.slice(1);
            setError(`This email is registered as a ${roleLabel}. Please select the correct option.`);
            await GoogleSignin.signOut();
            setLoading(false);
            return;
          } else if (!isBusinessSelection && isBusinessRole) {
            const roleLabel = existingRole === 'store' ? 'Business' : existingRole.charAt(0).toUpperCase() + existingRole.slice(1);
            setError(`This email is registered as a ${roleLabel}. Please select the correct option.`);
            await GoogleSignin.signOut();
            setLoading(false);
            return;
          }
        }
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) throw error;
      
      // Sync role metadata after successful login/link
      if (data.user) {
        await supabase.auth.updateUser({
          data: { role: role }
        });
      }
      
    } catch (e: any) {
      console.error('Google Sign-In Error:', e);
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled
      } else if (e.code === statusCodes.IN_PROGRESS) {
        setError('Sign in is already in progress');
      } else if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Google Play Services not available');
      } else {
        setError(e.message || 'An error occurred during Google sign-in');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to Zoro Delivery App</Text>
          </View>

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

          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity 
              style={styles.forgotPassword}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              style={styles.button}
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
              <View style={styles.googleButtonContent}>
                <Icon name="google" size={20} color={Colors.text} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.link}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
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
    padding: Spacing.md,
    paddingTop: 80,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  form: {
    width: '100%',
  },
  button: {
    marginTop: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
    marginVertical: Spacing.sm,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.md,
  },
  forgotPasswordText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  roleContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  roleButtonActive: {
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  roleTextActive: {
    color: Colors.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  link: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
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
    fontSize: 14,
    fontWeight: '600',
  },
  googleButton: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 12,
  },
});
