import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, borderRadius } from '../../theme/colors';

interface AlertAction {
  text: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline';
}

interface AlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
  primaryAction?: AlertAction;
  secondaryAction?: AlertAction;
  tertiaryAction?: AlertAction;
  showCancel?: boolean;
  cancelText?: string;
  verticalButtons?: boolean;
}

export const AlertModal = ({
  visible,
  title,
  message,
  type = 'info',
  onClose,
  primaryAction,
  secondaryAction,
  tertiaryAction,
  showCancel = true,
  cancelText = 'Cancel',
  verticalButtons = false,
}: AlertModalProps) => {
  const scaleValue = useRef(new Animated.Value(0)).current;
  const actions = [tertiaryAction, secondaryAction, primaryAction].filter(Boolean) as AlertAction[];
  
  // Safety: If no actions are provided, force showCancel to true so the modal can be closed
  const finalShowCancel = showCancel || actions.length === 0;

  useEffect(() => {
    if (visible) {
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 40,
      }).start();
    } else {
      scaleValue.setValue(0);
    }
  }, [visible]);

  const getIcon = () => {
    switch (type) {
      case 'success': return { name: 'check-circle-outline', color: Colors.success };
      case 'error': return { name: 'alert-circle-outline', color: Colors.error };
      case 'warning': return { name: 'alert-outline', color: Colors.warning };
      default: return { name: 'information-outline', color: Colors.secondary };
    }
  };

  const getActionStyle = (variant: string = 'primary', typeColor: string) => {
    switch (variant) {
      case 'destructive': return { backgroundColor: Colors.error };
      case 'outline': return { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: typeColor };
      case 'secondary': return { backgroundColor: Colors.surface };
      default: return { backgroundColor: typeColor };
    }
  };

  const getActionTextStyle = (variant: string = 'primary', typeColor: string) => {
    switch (variant) {
      case 'outline': return { color: typeColor };
      case 'secondary': return { color: Colors.textSecondary };
      default: return { color: Colors.white };
    }
  };

  const icon = getIcon();

  const renderButton = (action: AlertAction, index: number) => (
    <TouchableOpacity 
      key={index}
      style={[
        styles.button, 
        verticalButtons ? styles.verticalButton : { flex: 1 },
        getActionStyle(action.variant, icon.color)
      ]} 
      onPress={() => {
        action.onPress();
        onClose();
      }}
    >
      <Text style={[styles.buttonText, getActionTextStyle(action.variant, icon.color)]}>
        {action.text}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.modalContainer, { transform: [{ scale: scaleValue }] }]}>
          <View style={[styles.iconContainer, { backgroundColor: icon.color + '15' }]}>
            <Icon name={icon.name} size={40} color={icon.color} />
          </View>
          
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={[styles.buttonContainer, verticalButtons && styles.verticalButtonContainer]}>
            {finalShowCancel && actions.length === 0 && (
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton, { flex: 1 }]} 
                onPress={onClose}
              >
                <Text style={styles.secondaryButtonText}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            
            {actions.map(renderButton)}

            {finalShowCancel && actions.length > 0 && !verticalButtons && (
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton, { flex: 1 }]} 
                onPress={onClose}
              >
                <Text style={styles.secondaryButtonText}>{cancelText}</Text>
              </TouchableOpacity>
            )}

            {finalShowCancel && verticalButtons && (
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton, styles.verticalButton]} 
                onPress={onClose}
              >
                <Text style={styles.secondaryButtonText}>{cancelText}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: Spacing.md,
  },
  verticalButtonContainer: {
    flexDirection: 'column',
    gap: Spacing.sm,
  },
  button: {
    height: 52,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalButton: {
    width: '100%',
  },
  buttonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: Colors.surface,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 16,
  },
});
