import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../theme/colors';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../../components/ui/Button';

const InputField = ({ label, value, onChangeText, placeholder, keyboardType = 'default', required = true }: any) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}{required && <Text style={styles.required}> *</Text>}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textSecondary}
      keyboardType={keyboardType}
    />
  </View>
);

export const AddAddressScreen = ({ navigation, route }: any) => {
  const { address } = route.params || {};
  const isEditing = !!address;
  
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [formData, setFormData] = useState({
    label: address?.label || 'Home',
    address_line: address?.address_line || '',
    pincode: address?.pincode || '',
    city: address?.city || '',
    sector_area: address?.sector_area || '',
    state: address?.state || '',
    receiver_name: address?.receiver_name || '',
    receiver_phone: address?.receiver_phone || '',
  });

  const handleSave = async () => {
    // Basic validation
    if (!formData.address_line || !formData.pincode || !formData.city || !formData.state || !formData.receiver_name || !formData.receiver_phone) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        const { error } = await supabase
          .from('addresses')
          .update(formData)
          .eq('id', address.id);
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
            ...formData,
            is_default: count === 0
          }]);
        if (error) throw error;
      }
      
      Alert.alert('Success', `Address ${isEditing ? 'updated' : 'saved'} successfully`);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save address');
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
            onPress={() => navigation.goBack()}
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
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <InputField 
                label="Pin Code" 
                placeholder="6-digit PIN" 
                value={formData.pincode}
                onChangeText={(t: string) => setFormData({ ...formData, pincode: t })}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <InputField 
                label="City" 
                placeholder="City Name" 
                value={formData.city}
                onChangeText={(t: string) => setFormData({ ...formData, city: t })}
              />
            </View>
          </View>
          <InputField 
            label="Sector / Area" 
            placeholder="e.g. Sector 15, Civil Lines" 
            required={false}
            value={formData.sector_area}
            onChangeText={(t: string) => setFormData({ ...formData, sector_area: t })}
          />
          <InputField 
            label="State" 
            placeholder="State Name" 
            value={formData.state}
            onChangeText={(t: string) => setFormData({ ...formData, state: t })}
          />

          <Text style={styles.sectionTitle}>Receiver Details</Text>
          <InputField 
            label="Receiver's Name" 
            placeholder="Who will collect the delivery?" 
            value={formData.receiver_name}
            onChangeText={(t: string) => setFormData({ ...formData, receiver_name: t })}
          />
          <InputField 
            label="Receiver's Phone" 
            placeholder="10-digit mobile number" 
            value={formData.receiver_phone}
            onChangeText={(t: string) => setFormData({ ...formData, receiver_phone: t })}
            keyboardType="phone-pad"
          />

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
