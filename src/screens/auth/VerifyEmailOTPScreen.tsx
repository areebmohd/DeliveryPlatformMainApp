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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const VerifyEmailOTPScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const { email } = route.params;
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerifyOTP = async () => {
    if (!token || token.length < 6) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Try with 'signup' type first
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      });

      if (error) {
        // Fallback to 'email' type
        console.log('Verification with type signup failed, trying email:', error.message);
        const { error: retryError } = await supabase.auth.verifyOtp({
          email,
          token,
          type: 'email',
        });
        
        if (retryError) throw retryError;
      }
      
      // Success modal or direct navigation
      navigation.navigate('Login', { 
        verificationSuccess: true,
        message: 'Email verified successfully! You can now sign in.' 
      });
    } catch (e: any) {
      setError(e.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setError('');
    try {
      // For signup, we use resend
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });
      if (error) throw error;
    } catch (e: any) {
      setError(e.message || 'Failed to resend code');
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
          <TouchableOpacity 
            style={[styles.backButton, { marginTop: Math.max(insets.top, Spacing.md) }]} 
            onPress={() => navigation.goBack()}
          >
            <View style={styles.backIconContainer}>
              <Icon name="chevron-left" size={24} color={Colors.primary} />
            </View>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Confirm Email</Text>
            <Text style={styles.subtitle}>
              We've sent a verification code to {email}. Enter it below to confirm your account.
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Verification Code"
              placeholder="00000000"
              value={token}
              onChangeText={setToken}
              keyboardType="number-pad"
              maxLength={8}
              error={error}
              autoFocus
            />

            <Button
              title="Confirm Account"
              onPress={handleVerifyOTP}
              loading={loading}
              style={styles.button}
            />

            <TouchableOpacity 
              style={styles.resendButton}
              onPress={handleResendOTP}
              disabled={loading}
            >
              <Text style={styles.resendText}>Didn't receive a code? Resend Email</Text>
            </TouchableOpacity>
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
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  backButton: {
    marginBottom: Spacing.lg,
  },
  backIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  button: {
    marginTop: Spacing.lg,
  },
  resendButton: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  resendText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
});
