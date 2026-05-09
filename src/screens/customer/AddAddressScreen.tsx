import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../theme/colors';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../../components/ui/Button';
import { MapPickerView } from '../../components/address/MapPickerView';

const InputField = ({ label, value, onChangeText, placeholder, keyboardType = 'default', required = true, editable = true }: any) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}{required && <Text style={styles.required}> *</Text>}</Text>
    <TextInput
      style={[styles.input, !editable && { backgroundColor: '#F1F3F5', color: Colors.textSecondary }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textSecondary}
      keyboardType={keyboardType}
      editable={editable}
    />
  </View>
);

export const AddAddressScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();
  const { showAlert, showToast } = useAlert();
  const [editingAddress] = useState(route.params?.address);
  const isEditing = !!editingAddress;

  // Parse initial location if editing
  const parseLocation = (loc: any) => {
    if (!loc) return null;
    try {
      // Handle WKB HEX format (Supabase returns geography as HEX)
      // Example: 0101000020E6100000... (50 chars for Point with SRID)
      if (typeof loc === 'string' && /^[0-9A-F]{50}$/i.test(loc)) {
        try {
          const xHex = loc.substring(loc.length - 32, loc.length - 16);
          const yHex = loc.substring(loc.length - 16);
          
          const hexToDoubleLE = (hex: string) => {
            const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
            const buffer = new ArrayBuffer(8);
            const bView = new Uint8Array(buffer);
            bView.set(bytes);
            const view = new DataView(buffer);
            return view.getFloat64(0, true);
          };

          return { longitude: hexToDoubleLE(xHex), latitude: hexToDoubleLE(yHex) };
        } catch (e) {
          console.error('WKB parse error:', e);
        }
      }

      // Handle String formats: "POINT(lng lat)", "POINT(lng, lat)", "SRID=4326;POINT(lng lat)", etc.
      if (typeof loc === 'string' && loc.toUpperCase().includes('POINT')) {
        // Strip out SRID part if present, and handle both spaces or commas as separators
        const match = loc.match(/POINT\s*\(([-\d.]+)\s*[, \s]\s*([-\d.]+)\)/i);
        if (match) {
          const v1 = parseFloat(match[1]);
          const v2 = parseFloat(match[2]);
          
          // Heuristic for India (same as before but more robust)
          if (v1 > 50 && v1 < 100) {
            return { longitude: v1, latitude: v2 };
          } else if (v2 > 50 && v2 < 100) {
            return { longitude: v2, latitude: v1 };
          }
          return { longitude: v1, latitude: v2 };
        }
      } else if (typeof loc === 'object') {
        // Handle GeoJSON: { type: 'Point', coordinates: [lng, lat] }
        if (loc.type === 'Point' && Array.isArray(loc.coordinates)) {
          return {
            longitude: loc.coordinates[0],
            latitude: loc.coordinates[1],
          };
        }
        // Handle any object with lat/lng key variations
        const lat = loc.latitude ?? loc.lat ?? loc.latitude_deg ?? loc.y ?? null;
        const lng = loc.longitude ?? loc.lng ?? loc.longitude_deg ?? loc.x ?? null;
        
        if (lat !== null && lng !== null) {
          return { latitude: parseFloat(lat), longitude: parseFloat(lng) };
        }
      }
    } catch (e) {
      console.error('Super-tolerant parse failed:', e);
    }
    return null;
  };

  const initialLocation = parseLocation(editingAddress?.location);

  const [formData, setFormData] = useState({
    id: editingAddress?.id || null,
    label: editingAddress?.label || 'Home',
    address_line: editingAddress?.address_line || '',
    city: editingAddress?.city || '',
    state: editingAddress?.state || '',
    location: initialLocation,
  });

  // Listen for location from MapSelectionScreen
  React.useEffect(() => {
    if (route.params?.selectedLocation) {
      const { latitude, longitude, details, preservedFormData } = route.params.selectedLocation;
      
      setFormData(prev => ({
        ...(preservedFormData || prev),
        location: { latitude, longitude },
        city: details?.city || (preservedFormData || prev).city || '',
        state: details?.state || (preservedFormData || prev).state || '',
      }));
      
      // Fields are now read-only and filled from map details
      navigation.setParams({ selectedLocation: undefined });
    }
  }, [route.params?.selectedLocation]);

  const handleSave = async () => {
    // Basic validation
    if (!formData.address_line || !formData.city || !formData.state || !formData.location) {
      showAlert({ title: 'Error', message: 'Please fill all required fields and select map location', type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const { location: locObj, id: addressId, ...restFormData } = formData;
      const dataToSave = {
        ...restFormData,
        pincode: '',
        location: `SRID=4326;POINT(${locObj.longitude} ${locObj.latitude})`,
      };

      if (addressId) {
        // Explicitly update existing record
        const { error } = await supabase
          .from('addresses')
          .update(dataToSave)
          .eq('id', addressId);
        if (error) throw error;
      } else {
        // Check if this is the first address for the user
        const { count, error: countError } = await supabase
          .from('addresses')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user?.id)
          .eq('is_deleted', false);
        
        if (countError) throw countError;

        const { error } = await supabase
          .from('addresses')
          .insert([{
            user_id: user?.id,
            ...dataToSave,
            is_default: count === 0
          }]);
        if (error) throw error;
      }
      
      showToast(`Address ${addressId ? 'updated' : 'saved'} successfully`, 'success');
      
      if (route.params?.fromCart) {
        navigation.navigate('CartMain');
      } else if (route.params?.fromAddresses) {
        navigation.navigate('AccountMain');
      } else if (route.params?.fromHome) {
        navigation.navigate('HomeMain');
      } else {
        navigation.goBack();
      }
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message || 'Failed to save address', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              if (route.params?.fromCart) {
                navigation.navigate('CartMain');
              } else if (route.params?.fromAddresses) {
                navigation.navigate('Addresses');
              } else if (route.params?.fromHome) {
                navigation.navigate('HomeMain');
              } else {
                navigation.goBack();
              }
            }}
          >
            <Icon name="arrow-left" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Address' : 'Add New Address'}</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.form}>

          <View style={styles.labelSection}>
            <Text style={styles.sectionTitle}>Address Label</Text>
            <View style={styles.labelPicker}>
              {['Home', 'Work', 'Other'].map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[
                    styles.labelOption,
                    formData.label === l && styles.labelOptionActive
                  ]}
                  onPress={() => setFormData({ ...formData, label: l })}
                >
                  <Icon 
                    name={l === 'Home' ? 'home' : l === 'Work' ? 'briefcase' : 'map-marker'} 
                    size={20} 
                    color={formData.label === l ? Colors.white : Colors.textSecondary} 
                  />
                  <Text style={[
                    styles.labelText,
                    formData.label === l && styles.labelTextActive
                  ]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={styles.sectionTitle}>Address Details</Text>
          <InputField 
            label="Address Line 1" 
            placeholder="Flat No, House Name, Street" 
            value={formData.address_line}
            onChangeText={(t: string) => setFormData({ ...formData, address_line: t })}
          />
          <InputField 
            label="City" 
            placeholder="City Name" 
            value={formData.city}
            onChangeText={(t: string) => setFormData({ ...formData, city: t })}
            editable={false}
          />
          <InputField 
            label="State" 
            placeholder="State Name" 
            value={formData.state}
            onChangeText={(t: string) => setFormData({ ...formData, state: t })}
            editable={false}
          />

          <View style={{ marginVertical: 12 }}>
            <Text style={styles.inputLabel}>
              Pin Location on Map <Text style={styles.required}>*</Text>
            </Text>
            <MapPickerView 
              location={formData.location}
              onPress={() => navigation.navigate('MapSelection', {
                initialLocation: formData.location,
                returnScreen: 'AddAddress',
                preservedFormData: formData,
                fromCart: route.params?.fromCart,
                fromAddresses: route.params?.fromAddresses,
                fromHome: route.params?.fromHome,
              })}
            />
          </View>

          <Button
            title={loading ? "Saving..." : (isEditing ? "Update Address" : "Save Address")}
            onPress={handleSave}
            disabled={loading}
            style={{ marginTop: 24 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.background,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: Colors.white,
    marginRight: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  form: {
    padding: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 20,
    marginBottom: 16,
  },
  labelSection: {
    marginTop: 0,
  },
  labelPicker: {
    flexDirection: 'row',
    gap: 12,
  },
  labelOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  labelOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  labelTextActive: {
    color: Colors.white,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  required: {
    color: Colors.error,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
  },
});
