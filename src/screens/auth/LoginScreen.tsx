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

      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) throw error;
      // Navigation handled by auth state listener in App.tsx
    } catch (e: any) {
      setError(e.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue to our revolution</Text>
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
    justifyContent: 'center',
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
});
