import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing } from '../../theme/colors';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const StoreScreen = () => {
  const { profile, user } = useAuth();
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('');
  const [upiId, setUpiId] = useState('');

  useEffect(() => {
    fetchStore();
  }, []);

  const fetchStore = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setStore(data);
        setName(data.name);
        setDescription(data.description || '');
        setAddress(data.address || '');
        setCategory(data.category || '');
        setUpiId(data.upi_id || '');
      }
    } catch (e) {
      console.error('Error fetching store:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStore = async () => {
    if (!name || !address) {
      Alert.alert('Error', 'Please provide store name and address');
      return;
    }

    try {
      setSaving(true);
      const storeData = {
        owner_id: user?.id,
        name,
        description,
        address,
        category,
        upi_id: upiId,
        // Default location for MVP in Gurugram
        location: 'SRID=4326;POINT(77.0266 28.4595)', 
      };

      if (store) {
        const { error } = await supabase
          .from('stores')
          .update(storeData)
          .eq('id', store.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('stores')
          .insert(storeData);
        if (error) throw error;
      }

      Alert.alert('Success', 'Store profile updated successfully!');
      fetchStore();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>{store ? 'Manage Store' : 'Setup Your Store'}</Text>
          <Text style={styles.subtitle}>
            {store 
              ? 'Update your business information' 
              : 'Tell us about your business to get started'}
          </Text>
        </View>

        {!store?.is_approved && store && (
          <View style={styles.warningBox}>
            <Icon name="clock-outline" size={20} color="#856404" />
            <Text style={styles.warningText}>
              Your store is pending admin approval. You can still add products.
            </Text>
          </View>
        )}

        <View style={styles.form}>
          <Input
            label="Store Name"
            placeholder="e.g. Aggarwal Sweets"
            value={name}
            onChangeText={setName}
          />
          <Input
            label="Category"
            placeholder="e.g. Grocery, Bakery, etc."
            value={category}
            onChangeText={setCategory}
          />
          <Input
            label="Full Address"
            placeholder="Enter store address in Gurugram"
            value={address}
            onChangeText={setAddress}
            multiline
          />
          <Input
            label="Description"
            placeholder="Tell customers what you sell"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <Input
            label="UPI ID for Payouts"
            placeholder="yourname@okicici"
            value={upiId}
            onChangeText={setUpiId}
          />

          <Button
            title={store ? "Update Profile" : "Create Store"}
            onPress={handleSaveStore}
            loading={saving}
            style={styles.saveButton}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF3CD',
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  form: {
    width: '100%',
  },
  saveButton: {
    marginTop: Spacing.lg,
  },
});
