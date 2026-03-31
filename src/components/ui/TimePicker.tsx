import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ITEM_HEIGHT = 44;
const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

interface TimePickerProps {
  visible: boolean;
  value: string; // "HH:MM AM/PM"
  onClose: () => void;
  onSelect: (time: string) => void;
  title?: string;
}

export const TimePicker = ({ visible, value, onClose, onSelect, title }: TimePickerProps) => {
  const [tempTime, setTempTime] = useState(value || '09:00 AM');
  
  useEffect(() => {
    if (visible && value) {
      setTempTime(value);
    }
  }, [visible, value]);

  const [timePart, periodPart] = tempTime.split(' ');
  const [h, m] = timePart.split(':');

  const updateTempTimeValue = (part: 'hour' | 'min' | 'period', val: string) => {
    let [tp, pp] = tempTime.split(' ');
    let [th, tm] = tp.split(':');

    if (part === 'hour') th = val;
    if (part === 'min') tm = val;
    if (part === 'period') pp = val;

    setTempTime(`${th}:${tm} ${pp}`);
  };

  const handleConfirm = () => {
    onSelect(tempTime);
    onClose();
  };

  const ScrollSelector = ({ type, data, current }: { type: 'hour' | 'min', data: string[], current: string }) => {
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
      const index = data.indexOf(current);
      if (index !== -1) {
        setTimeout(() => {
          scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
        }, 100);
      }
    }, [visible]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_HEIGHT);
      if (index >= 0 && index < data.length) {
        updateTempTimeValue(type, data[index]);
      }
    };

    return (
      <ScrollView
        ref={scrollRef}
        style={styles.scrollColumn}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScroll}
        contentContainerStyle={styles.scrollContentContainer}
      >
        {data.map((val) => (
          <View key={val} style={styles.timeItem}>
            <Text style={[styles.timeText, current === val && styles.activeTimeText]}>{val}</Text>
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title || 'Select Time'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.pickerContainer}>
            <View style={styles.indicatorOverlay} pointerEvents="none" />
            
            <ScrollSelector type="hour" data={HOURS} current={h} />
            <Text style={styles.separator}>:</Text>
            <ScrollSelector type="min" data={MINUTES} current={m} />
            
            <View style={styles.periodColumn}>
              {['AM', 'PM'].map((p) => (
                <TouchableOpacity 
                  key={p} 
                  onPress={() => updateTempTimeValue('period', p)} 
                  style={styles.periodBtn}
                >
                  <Text style={[styles.periodText, periodPart === p && styles.activePeriodText]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>Confirm Time</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  pickerContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E1E4E8',
    height: ITEM_HEIGHT * 3, // 132px
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: Spacing.xl,
  },
  indicatorOverlay: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: Colors.primary + '08',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.primary + '20',
    zIndex: 1,
  },
  scrollColumn: {
    flex: 1,
    height: '100%',
  },
  scrollContentContainer: {
    paddingVertical: ITEM_HEIGHT,
  },
  timeItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 20,
    color: '#999',
    fontWeight: '600',
  },
  activeTimeText: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 24,
  },
  separator: {
    fontSize: 24,
    fontWeight: '800',
    color: '#DDD',
    paddingHorizontal: 2,
    zIndex: 2,
  },
  periodColumn: {
    paddingHorizontal: 20,
    borderLeftWidth: 1,
    borderLeftColor: '#E1E4E8',
    height: '100%',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    zIndex: 2,
  },
  periodBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  periodText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#999',
  },
  activePeriodText: {
    color: Colors.primary,
    fontSize: 18,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '800',
  },
});
