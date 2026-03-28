import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface TimeSlot {
  start: string;
  end: string;
}

interface TimeSlotPickerProps {
  value: string; // JSON string [ {start, end}, ... ]
  onChange: (value: string) => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];
const ITEM_HEIGHT = 44;

export const TimeSlotPicker = ({ value, onChange }: TimeSlotPickerProps) => {
  const [slots, setSlots] = useState<TimeSlot[]>([]);

  useEffect(() => {
    try {
      if (value) {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          setSlots(parsed);
          return;
        }
      }
    } catch (e) {
      if (value && typeof value === 'string') {
        setSlots([{ start: '09:00 AM', end: '10:00 PM' }]);
      }
    }
  }, [value]);

  const updateSlots = (newSlots: TimeSlot[]) => {
    setSlots(newSlots);
    onChange(JSON.stringify(newSlots));
  };

  const addSlot = () => {
    updateSlots([...slots, { start: '09:00 AM', end: '10:00 PM' }]);
  };

  const removeSlot = (index: number) => {
    const newSlots = slots.filter((_, i) => i !== index);
    updateSlots(newSlots);
  };

  const updateTimeValue = (index: number, type: 'start' | 'end', part: 'hour' | 'min' | 'period', val: string) => {
    const newSlots = [...slots];
    const currentTime = newSlots[index][type];
    let [timePart, periodPart] = currentTime.split(' ');
    let [h, m] = timePart.split(':');

    if (part === 'hour') h = val;
    if (part === 'min') m = val;
    if (part === 'period') periodPart = val;

    newSlots[index][type] = `${h}:${m} ${periodPart}`;
    updateSlots(newSlots);
  };

  const TimeSelector = ({ time, onValueChange }: { time: string, onValueChange: (part: 'hour' | 'min' | 'period', val: string) => void }) => {
    const [timePart, periodPart] = time.split(' ');
    const [h, m] = timePart.split(':');
    
    const hourScrollRef = useRef<ScrollView>(null);
    const minScrollRef = useRef<ScrollView>(null);

    useEffect(() => {
      const hIndex = HOURS.indexOf(h);
      const mIndex = MINUTES.indexOf(m);
      
      if (hIndex !== -1) {
        hourScrollRef.current?.scrollTo({ y: hIndex * ITEM_HEIGHT, animated: false });
      }
      if (mIndex !== -1) {
        minScrollRef.current?.scrollTo({ y: mIndex * ITEM_HEIGHT, animated: false });
      }
    }, []);

    const handleScroll = (type: 'hour' | 'min', event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_HEIGHT);
      const list = type === 'hour' ? HOURS : MINUTES;
      if (index >= 0 && index < list.length) {
        onValueChange(type, list[index]);
      }
    };

    return (
      <View style={styles.timeSelector}>
        {/* Selection Indicator Overlay */}
        <View style={styles.indicatorOverlay} pointerEvents="none" />
        
        <ScrollView 
          ref={hourScrollRef}
          style={styles.scrollColumn} 
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={(e) => handleScroll('hour', e)}
          contentContainerStyle={styles.scrollContentContainer}
        >
          {HOURS.map(val => (
            <View key={val} style={styles.timeItem}>
              <Text style={[styles.timeText, h === val && styles.activeTimeText]}>{val}</Text>
            </View>
          ))}
        </ScrollView>
        <Text style={styles.separator}>:</Text>
        <ScrollView 
          ref={minScrollRef}
          style={styles.scrollColumn} 
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={(e) => handleScroll('min', e)}
          contentContainerStyle={styles.scrollContentContainer}
        >
          {MINUTES.map(val => (
            <View key={val} style={styles.timeItem}>
              <Text style={[styles.timeText, m === val && styles.activeTimeText]}>{val}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.periodColumn}>
          <TouchableOpacity onPress={() => onValueChange('period', 'AM')} style={styles.periodBtn}>
            <Text style={[styles.periodText, periodPart === 'AM' && styles.activePeriodText]}>AM</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onValueChange('period', 'PM')} style={styles.periodBtn}>
            <Text style={[styles.periodText, periodPart === 'PM' && styles.activePeriodText]}>PM</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Operating Hours *</Text>
        <TouchableOpacity style={styles.addButton} onPress={addSlot}>
          <Icon name="plus" size={20} color={Colors.primary} />
          <Text style={styles.addButtonText}>Add Slot</Text>
        </TouchableOpacity>
      </View>

      {slots.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No opening hours set. Add a slot to show when your store is open for orders.</Text>
        </View>
      ) : (
        slots.map((slot, index) => (
          <View key={index} style={styles.slotCard}>
            <View style={styles.slotHeader}>
              <Text style={styles.slotTitle}>Slot {index + 1}</Text>
              <TouchableOpacity onPress={() => removeSlot(index)}>
                <Icon name="close-circle" size={22} color={Colors.error} />
              </TouchableOpacity>
            </View>
            <View style={styles.selectorsRow}>
              <View style={styles.selectorGroup}>
                <Text style={styles.selectorLabel}>Starts at</Text>
                <TimeSelector 
                  time={slot.start} 
                  onValueChange={(part, val) => updateTimeValue(index, 'start', part, val)} 
                />
              </View>
              <Icon name="arrow-right" size={24} color={Colors.border} style={styles.arrow} />
              <View style={styles.selectorGroup}>
                <Text style={styles.selectorLabel}>Ends at</Text>
                <TimeSelector 
                  time={slot.end} 
                  onValueChange={(part, val) => updateTimeValue(index, 'end', part, val)} 
                />
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: 4,
  },
  slotCard: {
    backgroundColor: Colors.white,
    borderRadius: borderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E1E4E8',
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  slotTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  selectorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorGroup: {
    flex: 1,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  timeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E4E8',
    height: ITEM_HEIGHT * 3, // 132px
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
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
    paddingVertical: ITEM_HEIGHT, // Leaves space for top and bottom visibility
  },
  timeItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodColumn: {
    paddingHorizontal: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#E1E4E8',
    height: '100%',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    zIndex: 2,
  },
  periodBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 18,
    color: '#999',
    fontWeight: '600',
  },
  activeTimeText: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 20,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#999',
  },
  activePeriodText: {
    color: Colors.primary,
    fontSize: 15,
  },
  separator: {
    fontSize: 20,
    fontWeight: '800',
    color: '#DDD',
    paddingHorizontal: 2,
    zIndex: 2,
  },
  arrow: {
    marginHorizontal: Spacing.sm,
    marginTop: 20,
  },
  emptyContainer: {
    padding: Spacing.md,
    backgroundColor: '#F8F9FA',
    borderRadius: borderRadius.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#E1E4E8',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
