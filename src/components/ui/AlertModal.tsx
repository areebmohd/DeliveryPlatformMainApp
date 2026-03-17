import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, borderRadius } from '../../theme/colors';

interface AlertAction {
  text: string;
  description?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline';
}

interface AlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
  actions?: AlertAction[];
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

  // Combine actions into a single array  // Combine actions into a single array for rendering
  const finalActions: AlertAction[] = [];
  if (primaryAction) finalActions.push(primaryAction);
  if (secondaryAction) finalActions.push(secondaryAction);
  if (tertiaryAction) finalActions.push(tertiaryAction);

  // Horizontal reversal for design (Primary on right)
  if (!verticalButtons) {
    finalActions.reverse();
  }
  
  // Safety: If no actions are provided, force showCancel to true
  const finalShowCancel = showCancel || finalActions.length === 0;

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
        action.description && styles.buttonWithDescription,
        getActionStyle(action.variant, icon.color)
      ]} 
      onPress={() => {
        action.onPress();
        onClose();
      }}
    >
      <View style={styles.buttonContent}>
        <Text style={[styles.buttonText, getActionTextStyle(action.variant, icon.color)]}>
          {action.text}
        </Text>
        {action.description && (
          <Text style={[styles.buttonDescription, getActionTextStyle(action.variant, icon.color), { opacity: 0.8 }]}>
            {action.description}
          </Text>
        )}
      </View>
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
        <View style={styles.modalContainer}>
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            <Text style={{ position: 'absolute', top: 0, opacity: 0 }}>DEBUG: {finalActions.length} actions</Text>
            <View style={[styles.iconContainer, { backgroundColor: icon.color + '15' }]}>
              <Icon name={icon.name} size={40} color={icon.color} />
            </View>
            
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            <View style={[styles.buttonContainer, verticalButtons && styles.verticalButtonContainer]}>
              {finalActions.map(renderButton)}

              {finalShowCancel && (
                <TouchableOpacity 
                  style={[
                    styles.button, 
                    styles.secondaryButton, 
                    verticalButtons ? styles.verticalButton : { flex: 1 }
                  ]} 
                  onPress={onClose}
                >
                  <Text style={styles.secondaryButtonText}>{cancelText}</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
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
    maxHeight: Dimensions.get('window').height * 0.8,
    backgroundColor: Colors.white,
    borderRadius: borderRadius.xl,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    overflow: 'hidden',
  },
  scrollView: {
    width: '100%',
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xl * 2,
    alignItems: 'center',
    width: '100%',
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
  buttonWithDescription: {
    height: 70,
  },
  buttonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  verticalButton: {
    width: '100%',
  },
  buttonText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
  buttonDescription: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
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
