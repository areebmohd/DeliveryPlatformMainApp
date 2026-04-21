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
import { AlertModal } from '../../components/ui/AlertModal';
import { supabase } from '../../api/supabase';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const RegisterScreen = ({ navigation }: any) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'store'>('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    primaryAction?: any;
    showCancel?: boolean;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showAlert = (title: string, message: string, type: any = 'info', primaryAction?: any, showCancel: boolean = true) => {
    setAlertConfig({ visible: true, title, message, type, primaryAction, showCancel });
  };

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
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
      // Check if email already exists in any role
      const { data: existingRole, error: checkError } = await supabase.rpc('check_email_exists', {
        email_to_check: email.toLowerCase().trim(),
      });

      if (checkError) {
        console.error('Error checking email existence:', checkError);
      } else if (existingRole) {
        const roleLabel = existingRole === 'store' ? 'Business' : existingRole === 'rider' ? 'Rider' : existingRole.charAt(0).toUpperCase() + existingRole.slice(1);
        showAlert(
          'Email Already Registered',
          `This email is already registered as a ${roleLabel}. One email can only be used for one account type. Please sign in or use a different email.`,
          'warning',
          { text: 'OK', onPress: () => navigation.navigate('Login') },
          false
        );
        setLoading(false);
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          emailRedirectTo: 'com.zorodelivery.app://login',
          data: {
            full_name: fullName,
            role: role,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already registered') || signUpError.message.toLowerCase().includes('already been taken')) {
          try {
            const { error: resendError } = await supabase.auth.resend({
              type: 'signup',
              email: email.toLowerCase().trim(),
            });
            
            if (resendError) {
              showAlert(
                'Account Exists',
                'An account with this email already exists. Please sign in instead.',
                'warning',
                { text: 'Go to Login', onPress: () => navigation.navigate('Login') },
                false
              );
            } else {
              showAlert(
                'Welcome Back',
                'Your account exists but is not verified. A new verification code has been sent.',
                'info',
                { text: 'OK', onPress: () => navigation.navigate('VerifyEmailOTP', { email: email.toLowerCase().trim() }) },
                false
              );
            }
          } catch (resendError: any) {
            showAlert(
              'Account Exists',
              'An account with this email already exists. Please sign in instead.',
              'warning',
              { text: 'Go to Login', onPress: () => navigation.navigate('Login') },
              false
            );
          }
          return;
        }
        throw signUpError;
      }
      
      navigation.navigate('VerifyEmailOTP', { email: email.toLowerCase().trim() });
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
      const emailAddress = userInfo.data?.user?.email;
      
      if (userInfo.data?.idToken) {
        // Check if email already exists with a different role
        if (emailAddress) {
          const { data: existingRole, error: checkError } = await supabase.rpc('check_email_exists', {
            email_to_check: emailAddress.toLowerCase().trim(),
          });

          if (checkError) {
            console.error('Error checking role:', checkError);
          } else if (existingRole) {
            if (existingRole === 'rider') {
              showAlert(
                'Email Already Registered',
                'This email is already registered for a rider account. Please use a different email or log in to the Rider app.',
                'warning',
                { text: 'OK', onPress: () => navigation.navigate('Login') },
                false
              );
              await GoogleSignin.signOut();
              setLoading(false);
              return;
            }

            const isBusinessSelection = role === 'store';
            const isBusinessRole = existingRole === 'store' || existingRole === 'admin';
            
            if ((isBusinessSelection && !isBusinessRole) || (!isBusinessSelection && isBusinessRole)) {
              const roleLabel = existingRole === 'store' ? 'Business' : existingRole.charAt(0).toUpperCase() + existingRole.slice(1);
              showAlert(
                'Email Already Registered',
                `This email is already registered as a ${roleLabel}. One email can only be used for one account type. Please sign in or use a different email.`,
                'warning',
                { text: 'OK', onPress: () => navigation.navigate('Login') },
                false
              );
              await GoogleSignin.signOut();
              setLoading(false);
              return;
            }
          }
        }

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: userInfo.data.idToken,
          options: {
            data: {
              role: role,
              full_name: userInfo.data?.user?.name || 'New User'
            }
          }
        });

        if (error) throw error;
        
        // If login is successful, we should ensure the role is set
        if (data.user) {
          // Update Auth Metadata
          await supabase.auth.updateUser({
            data: { 
              role: role,
              full_name: userInfo.data?.user?.name || 'New User'
            }
          });

          // Explicitly update public.profiles to fix any race condition with the trigger
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ 
              role: role,
              full_name: userInfo.data?.user?.name || 'New User'
            })
            .eq('id', data.user.id);
          
          if (profileError) {
            console.error('Error syncing profile role:', profileError);
          }
        }
      } else {
        throw new Error('No ID token present!');
      }
    } catch (e: any) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled the login flow
      } else if (e.code === statusCodes.IN_PROGRESS) {
        setError('Operation in progress');
      } else if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Play services not available or outdated');
      } else {
        setError(e.message || 'An error occurred during Google sign in');
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
            <Text style={styles.title}>Join Revolution</Text>
            <Text style={styles.subtitle}>Create an account to get started</Text>
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
              label="Full Name"
              placeholder="Enter your full name"
              value={fullName}
              onChangeText={setFullName}
            />
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
              placeholder="Create a strong password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
              style={styles.button}
            />

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity 
              style={styles.googleButton} 
              onPress={handleGoogleLogin}
              disabled={loading}
            >
              <View style={styles.googleIconContainer}>
                <Icon name="google" size={20} color={Colors.white} />
              </View>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.link}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
        primaryAction={alertConfig.primaryAction}
        showCancel={alertConfig.showCancel}
      />
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
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
    marginTop: 100,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
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
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  googleIconContainer: {
    backgroundColor: '#db4437',
    borderRadius: 8,
    padding: 4,
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
});
