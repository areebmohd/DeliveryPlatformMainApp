import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { Colors, Spacing, borderRadius } from '../../theme/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input = ({
  label,
  error,
  containerStyle,
  onFocus,
  onBlur,
  ...props
}: InputProps) => {
  const [isFocused, setIsFocused] = React.useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[
        styles.inputContainer, 
        isFocused && styles.focusedBorder,
        error ? styles.errorBorder : null
      ]}>
        <TextInput
          style={styles.input}
          placeholderTextColor={Colors.textSecondary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
    marginLeft: 2,
    letterSpacing: 0.3,
  },
  inputContainer: {
    height: 56,
    backgroundColor: Colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  focusedBorder: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  input: {
    fontSize: 16,
    color: Colors.text,
    height: '100%',
    fontWeight: '500',
  },
  errorBorder: {
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
});
