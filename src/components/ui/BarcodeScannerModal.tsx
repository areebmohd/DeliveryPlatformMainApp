import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner, CameraPermissionStatus } from 'react-native-vision-camera';
import BarcodeMask from 'react-native-barcode-mask';
import { Colors, Spacing } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface BarcodeScannerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export const BarcodeScannerModal = ({ isVisible, onClose, onScan }: BarcodeScannerModalProps) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const device = useCameraDevice('back');

  useEffect(() => {
    if (isVisible) {
      checkPermission();
      setIsActive(true);
    } else {
      setIsActive(false);
    }
  }, [isVisible]);

  const checkPermission = async () => {
    const status = await Camera.getCameraPermissionStatus();
    if (status !== 'granted') {
      const newStatus = await Camera.requestCameraPermission();
      setHasPermission(newStatus === 'granted');
    } else {
      setHasPermission(true);
    }
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8', 'upc-a', 'upc-e', 'code-128', 'code-39', 'qr'],
    onCodeScanned: (codes) => {
      if (codes.length > 0 && codes[0].value) {
        onScan(codes[0].value);
        onClose();
      }
    }
  });

  if (!device) {
    return (
      <Modal visible={isVisible} animationType="slide">
        <View style={styles.errorContainer}>
          <Icon name="camera-off" size={48} color={Colors.error} />
          <Text style={styles.errorText}>No camera device found</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={isVisible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {hasPermission ? (
          <View style={styles.cameraWrapper}>
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={isActive}
              codeScanner={codeScanner}
            />
            <BarcodeMask 
              edgeColor={Colors.primary}
              showAnimatedLine={true}
              width={300}
              height={200}
            />
          </View>
        ) : (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>Camera permission is required to scan barcodes.</Text>
            <TouchableOpacity onPress={checkPermission} style={styles.permissionBtn}>
              <Text style={styles.permissionBtnText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Overlay Controls */}
        <View style={styles.overlay}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <Icon name="close" size={28} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.titleText}>Scan Barcode</Text>
            <View style={{ width: 40 }} />
          </View>
          
          <View style={styles.bottomHint}>
            <Text style={styles.hintText}>Align barcode within the frame</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  cameraWrapper: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: Spacing.lg,
    backgroundColor: 'transparent',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 40,
  },
  titleText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomHint: {
    alignItems: 'center',
    marginBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignSelf: 'center',
  },
  hintText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.xl,
  },
  errorText: {
    marginTop: Spacing.md,
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
  },
  closeBtn: {
    marginTop: Spacing.xl,
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  closeBtnText: {
    color: Colors.white,
    fontWeight: '700',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  permissionText: {
    color: Colors.white,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  permissionBtn: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: Colors.white,
    fontWeight: '700',
  },
});
