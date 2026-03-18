import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';

interface SafeTopBackgroundProps {
  backgroundColor?: string;
}

/**
 * A component that fills the top safe area (notch area) with a solid background color.
 * Use this at the very top of your screen component to prevent content bleeding.
 */
export const SafeTopBackground = ({ backgroundColor }: SafeTopBackgroundProps) => {
  const insets = useSafeAreaInsets();
  
  if (insets.top === 0) return null;

  return (
    <View
      style={[
        styles.safeArea,
        {
          height: insets.top,
          backgroundColor: backgroundColor || Colors.background,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  safeArea: {
    width: '100%',
  },
});
