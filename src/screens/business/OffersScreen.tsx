import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Dimensions,
  TextInput,
  Switch,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../api/supabase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { TimePicker } from '../../components/ui/TimePicker';
import { useAlert } from '../../context/AlertContext';
import { getOfferDescription, getOfferConditionList, getTheme } from '../../utils/offerUtils';
import { Colors, Spacing, borderRadius, Typography } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

type OfferType = 'free_cash' | 'discount' | 'free_delivery' | 'free_product' | 'cheap_product' | 'combo' | 'fixed_price';

interface OfferCondition {
  min_price: number | null;
  product_ids: string[];
  start_time: string | null;
  end_time: string | null;
  max_distance: number | null;
  applicable_orders: 'all' | 'first' | 'nth';
}

interface Offer {
  id: string;
  name?: string;
  store_id: string;
  type: OfferType;
  status: 'active' | 'inactive';
  amount: number;
  conditions: OfferCondition;
  reward_data?: {
    product_ids?: string[];
  };
  created_at: string;
}

export const OffersScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { showAlert, showToast } = useAlert();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<any>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedType, setSelectedType] = useState<OfferType | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxDistance, setMaxDistance] = useState('');
  const [orderCount, setOrderCount] = useState('');
  const [startTime, setStartTime] = useState('09:00 AM');
  const [endTime, setEndTime] = useState('10:00 PM');
  const [startTimeActive, setStartTimeActive] = useState(false);
  const [endTimeActive, setEndTimeActive] = useState(false);
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedRewardProducts, setSelectedRewardProducts] = useState<string[]>([]);
  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  const [productModalMode, setProductModalMode] = useState<'condition' | 'reward'>('condition');
  const [showProductModal, setShowProductModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [conditionModal, setConditionModal] = useState<{ visible: boolean; offer: Offer | null }>({
    visible: false,
    offer: null
  });


  useEffect(() => {
    fetchStoreAndOffers();
  }, [user?.id]);

  const fetchStoreAndOffers = async () => {
    try {
      setLoading(true);
      // Fetch Store
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (storeError) throw storeError;
      setStore(storeData);

      if (storeData) {
        // Fetch Offers
        const { data: offersData, error: offersError } = await supabase
          .from('offers')
          .select('*')
          .eq('store_id', storeData.id)
          .order('created_at', { ascending: false });
        
        if (offersError) {
            console.log('Offers table might not exist yet');
            setOffers([]);
        } else {
            setOffers(offersData || []);
        }

        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, name, price')
          .eq('store_id', storeData.id)
          .eq('is_deleted', false)
          .order('name');
        
        if (productsError) {
          console.error('Error fetching products:', productsError);
        }
        setStoreProducts(productsData || []);
      }
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOffer = () => {
    setEditingOffer(null);
    setShowTypeModal(true);
  };

  const handleEditOffer = (offer: Offer) => {
    setEditingOffer(offer);
    setName(offer.name || '');
    setAmount(offer.amount.toString());
    setMinPrice(offer.conditions.min_price?.toString() || '');
    setMaxDistance(offer.conditions.max_distance?.toString() || '');
    setOrderCount(offer.conditions.applicable_orders === 'all' ? '' : offer.conditions.applicable_orders.toString());
    
    if (offer.conditions.start_time) {
      setStartTime(offer.conditions.start_time);
      setStartTimeActive(true);
    } else {
      setStartTimeActive(false);
    }
    
    if (offer.conditions.end_time) {
      setEndTime(offer.conditions.end_time);
      setEndTimeActive(true);
    } else {
      setEndTimeActive(false);
    }

    setSelectedProducts(offer.conditions.product_ids || []);
    setSelectedRewardProducts(offer.reward_data?.product_ids || []);
    setSelectedType(offer.type);
    setShowFormModal(true);
  };

  const selectType = (type: OfferType) => {
    // Check if store already has an offer of this type
    const existingOffer = offers.find(o => o.type === type);
    if (existingOffer) {
      showAlert({
        title: 'Limit Reached',
        message: `You already have a ${type.replace('_', ' ')} offer. Please delete the existing one before creating a new one of same type.`,
        type: 'warning'
      });
      return;
    }

    if (type !== 'free_cash' && type !== 'discount' && type !== 'free_delivery' && type !== 'free_product' && type !== 'cheap_product' && type !== 'combo' && type !== 'fixed_price') {
      showAlert({
        title: 'Coming Soon',
        message: `${(type as string).replace('_', ' ')} offers will be available in the next update!`,
        type: 'info'
      });
      return;
    }
    setSelectedType(type);
    setShowTypeModal(false);
    setShowFormModal(true);
  };

  const resetForm = () => {
    setName('');
    setAmount('');
    setMinPrice('');
    setMaxDistance('');
    setOrderCount('');
    setStartTime('09:00 AM');
    setEndTime('10:00 PM');
    setStartTimeActive(false);
    setEndTimeActive(false);
    setSelectedProducts([]);
    setSelectedRewardProducts([]);
    setSelectedType(null);
    setEditingOffer(null);
    setShowFormModal(false);
    setShowProductModal(false);
  };

  const saveOffer = async () => {
    if ((selectedType === 'free_product' || selectedType === 'cheap_product' || selectedType === 'combo' || selectedType === 'fixed_price') && selectedRewardProducts.length === 0) {
      showToast('Please select at least one product', 'error');
      return;
    }

    if (!name.trim()) {
      showToast('Offer Name is required', 'error');
      return;
    }

    if (selectedType !== 'free_delivery' && selectedType !== 'free_product' && (!amount || isNaN(Number(amount)))) {
      showToast('Please enter a valid amount/percentage', 'error');
      return;
    }

    try {
      setFormLoading(true);
      const offerData = {
        store_id: store.id,
        name: name.trim(),
        type: selectedType,
        amount: (selectedType === 'free_delivery' || selectedType === 'free_product') ? 0 : Number(amount),
        conditions: {
          min_price: minPrice ? Number(minPrice) : null,
          product_ids: selectedProducts.length > 0 ? selectedProducts : null,
          max_distance: maxDistance ? Number(maxDistance) : null,
          applicable_orders: orderCount ? Number(orderCount) : 'all',
          start_time: startTimeActive ? startTime : null,
          end_time: endTimeActive ? endTime : null,
        },
        reward_data: (selectedType === 'free_product' || selectedType === 'cheap_product' || selectedType === 'combo' || selectedType === 'fixed_price') ? { 
          product_ids: selectedRewardProducts,
          product_name: selectedRewardProducts.length === 1 
            ? (storeProducts.find(p => String(p.id) === String(selectedRewardProducts[0]))?.name || 'Item')
            : (selectedRewardProducts.length > 1 ? `${selectedRewardProducts.length} Items` : 'Items'),
          product_price: storeProducts.find(p => String(p.id) === String(selectedRewardProducts[0]))?.price || 0
        } : {},
        status: editingOffer ? editingOffer.status : 'active'
      };

      if (editingOffer) {
        const { data, error } = await supabase
          .from('offers')
          .update(offerData)
          .eq('id', editingOffer.id)
          .select()
          .single();

        if (error) throw error;
        setOffers(offers.map(o => o.id === data.id ? data : o));
        showToast('Offer updated successfully!', 'success');
      } else {
        const { data, error } = await supabase
          .from('offers')
          .insert(offerData)
          .select()
          .single();

        if (error) throw error;
        setOffers([data, ...offers]);
        showToast('Offer created successfully!', 'success');
      }
      
      resetForm();
    } catch (e: any) {
      console.error('Error saving offer:', e);
      showAlert({
        title: 'Error',
        message: e.message || 'Could not save offer. Please check if the table exists.',
        type: 'error'
      });
    } finally {
      setFormLoading(false);
    }
  };

  const toggleOfferStatus = async (id: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const { error } = await supabase
        .from('offers')
        .update({ status: nextStatus })
        .eq('id', id);

      if (error) throw error;

      setOffers(offers.map(o => o.id === id ? { ...o, status: nextStatus as any } : o));
      showToast(`Offer ${nextStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
    } catch (e) {
      console.error('Error toggling status:', e);
    }
  };

  const deleteOffer = (id: string) => {
    showAlert({
      title: 'Delete Offer',
      message: 'Are you sure you want to delete this offer?',
      type: 'warning',
      showCancel: true,
      primaryAction: {
        text: 'Delete',
        onPress: async () => {
          try {
            const { error } = await supabase.from('offers').delete().eq('id', id);
            if (error) throw error;
            setOffers(offers.filter(o => o.id !== id));
            showToast('Offer deleted', 'success');
          } catch (e) {
            console.error('Error deleting offer:', e);
          }
        },
        variant: 'destructive'
      }
    });
  };

  const renderConditionLine = (offer: any) => {
    const list = getOfferConditionList(offer);
    const maxVisible = 3;
    const hasMore = list.length > maxVisible;
    const visibleList = hasMore ? list.slice(0, maxVisible - 1) : list;

    return (
      <View style={styles.conditionsLine}>
        <View style={{ flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center' }}>
          {visibleList.map((c, i) => (
            <View key={i} style={styles.offerTabCondPill}>
              <Text style={styles.offerTabCondText} numberOfLines={1}>{c}</Text>
            </View>
          ))}
          {hasMore && (
            <TouchableOpacity 
              style={styles.offerTabCondPill} 
              onPress={() => setConditionModal({ visible: true, offer })}
            >
              <Text style={styles.offerTabCondText}>+ More</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };


  const renderOfferCard = (offer: Offer) => {
    const theme = getTheme(offer.type);
    
    return (
      <View key={offer.id} style={styles.offerCard}>
        <View style={styles.cardMainInfo}>
          <View style={styles.categoryRow}>
            <View style={[styles.offerTabBadge, { backgroundColor: theme.bg }]}>
              <Icon 
                name={theme.icon} 
                size={14} 
                color={theme.color} 
              />
              <Text style={[styles.offerTabBadgeText, { color: theme.color }]}>
                {offer.type === 'cheap_product' ? 'PRICE DROP' : offer.type.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.offerNameText}>{offer.name || 'Unnamed Offer'}</Text>
          
          <Text style={styles.offerAmount}>
            {(() => {
              const getNames = (ids?: string[]) => {
                if (!ids || ids.length === 0) return '';
                const names = ids.map(id => storeProducts.find(p => String(p.id) === String(id))?.name).filter(Boolean);
                if (names.length === 0) return '';
                return names.join(', ');
              };
              const resolvedName = getNames(offer.reward_data?.product_ids);
              return getOfferDescription(offer, resolvedName);
            })()}
          </Text>
        </View>

        {renderConditionLine(offer)}

        <View style={styles.cardSeparator} />

        <View style={styles.offerActionBar}>
          <View style={styles.availabilityGroup}>
            <Text style={[styles.statusToggleLabel, offer.status === 'active' ? { color: Colors.success } : { color: Colors.textSecondary }]}>
              {offer.status === 'active' ? 'Available' : 'Paused'}
            </Text>
            <Switch 
              value={offer.status === 'active'} 
              onValueChange={() => toggleOfferStatus(offer.id, offer.status)}
              trackColor={{ false: '#D1D5DB', true: Colors.success + '40' }}
              thumbColor={offer.status === 'active' ? Colors.success : '#9CA3AF'}
              ios_backgroundColor="#D1D5DB"
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>

          <View style={styles.mainActionBtns}>
            <TouchableOpacity onPress={() => handleEditOffer(offer)} style={[styles.actionIconBtn, styles.editActionBtn]}>
              <Icon name="pencil-outline" size={18} color={Colors.primary} />
              <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteOffer(offer.id)} style={[styles.actionIconBtn, styles.deleteActionBtn]}>
              <Icon name="trash-can-outline" size={18} color={Colors.error} />
              <Text style={[styles.actionBtnText, { color: Colors.error }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <View style={{ height: insets.top, backgroundColor: Colors.background }} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerTitleContainer}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Offers</Text>
            <TouchableOpacity style={styles.addBtn} onPress={handleAddOffer}>
              <Icon name="plus" size={20} color={Colors.white} />
              <Text style={styles.addBtnText}>Create Offer</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.disclaimerText}>
            Customers can apply only one standard offer along with a Free Delivery offer from your store in every order.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
        ) : offers.length > 0 ? (
          offers.map(renderOfferCard)
        ) : (
          <View style={styles.emptyState}>
            <Icon name="tag-off-outline" size={80} color={Colors.border} />
            <Text style={styles.emptyTitle}>No Active Offers</Text>
            <Text style={styles.emptySubtitle}>
              Boost your sales by creating exciting offers for your customers.
            </Text>
            <Button title="Get Started" onPress={handleAddOffer} style={styles.getStartedBtn} />
          </View>
        )}
      </ScrollView>

      {/* Offer Type Selection Modal */}
      <Modal visible={showTypeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.typeModalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.modalTitle}>Select Offer Type</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.typeGrid}>
              {[
                { id: 'free_cash', icon: 'cash', label: 'Free Cash', color: '#10B981' },
                { id: 'discount', icon: 'percent', label: 'Instant Discount', color: '#3B82F6' },
                { id: 'free_delivery', icon: 'truck-delivery', label: 'Free Delivery', color: '#F59E0B' },
                { id: 'free_product', icon: 'gift', label: 'Free Products', color: '#EC4899' },
                { id: 'cheap_product', icon: 'tag-outline', label: 'Price Drop', color: '#8B5CF6' },
                { id: 'fixed_price', icon: 'tag-multiple-outline', label: 'Fixed Price', color: '#0891B2' },
                { id: 'combo', icon: 'layers-outline', label: 'Combo Offer', color: '#F97316' },
              ].map(type => (
                <TouchableOpacity 
                  key={type.id} 
                  style={[styles.typeItem, (type.id !== 'free_cash' && type.id !== 'discount' && type.id !== 'free_delivery' && type.id !== 'free_product' && type.id !== 'cheap_product' && type.id !== 'combo' && type.id !== 'fixed_price') && { opacity: 0.6 }]} 
                  onPress={() => selectType(type.id as OfferType)}
                >
                  <View style={[styles.typeIconBg, { backgroundColor: type.color + '20' }]}>
                    <Icon name={type.icon} size={28} color={type.color} />
                  </View>
                  <Text style={styles.typeLabel}>{type.label}</Text>
                  {(type.id !== 'free_cash' && type.id !== 'discount' && type.id !== 'free_delivery' && type.id !== 'free_product' && type.id !== 'cheap_product' && type.id !== 'combo' && type.id !== 'fixed_price') && <Text style={styles.soonText}>Soon</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Free Cash Form Modal */}
      <Modal visible={showFormModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.formModalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.modalHeader, { marginBottom: 8 }]}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.modalTitle}>
                    {selectedType === 'discount' ? 'Instant Discount' : 
                     selectedType === 'free_delivery' ? 'Free Delivery Offer' : 
                     selectedType === 'free_product' ? 'Free Product Offer' : 
                     selectedType === 'cheap_product' ? 'Price Drop Offer' : 
                     selectedType === 'fixed_price' ? 'Fixed Price Offer' : 'Free Cash Offer'}
                  </Text>
                </View>

                <TouchableOpacity onPress={resetForm}>
                  <Icon name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalSubtitle, { marginBottom: 20 }]}>
                {selectedType === 'free_delivery' 
                  ? `Delivery fee will be deducted from your earnings and given to the rider.` 
                  : 'Configure rewards & conditions'}
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Offer Name <Text style={{ color: Colors.error }}>*</Text></Text>
                <Input 
                  placeholder="e.g. Holi Special, Buy 1 Get 1" 
                  value={name} 
                  onChangeText={setName} 
                />
              </View>

              {selectedType !== 'free_delivery' && selectedType !== 'free_product' && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    {selectedType === 'discount' || selectedType === 'cheap_product' ? 'Discount Percentage (%)' : 
                     selectedType === 'fixed_price' ? 'Fixed Price (₹)' : 
                     selectedType === 'combo' ? 'Combo Price (₹)' : 'Free Cash Amount (₹)'}
                  </Text>
                  <Input 
                    placeholder={selectedType === 'discount' || selectedType === 'cheap_product' ? "e.g. 10" : 
                                 selectedType === 'fixed_price' ? "e.g. 120" :
                                 selectedType === 'combo' ? "e.g. 299" : "e.g. 50"} 
                    value={amount} 
                    onChangeText={setAmount} 
                    keyboardType="numeric"
                  />
                </View>
              )}

              {(selectedType === 'free_product' || selectedType === 'cheap_product' || selectedType === 'combo' || selectedType === 'fixed_price') && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    {selectedType === 'free_product' ? 'Select Free Products' : 
                     selectedType === 'fixed_price' ? 'Select Products for Fixed Price' : 
                     selectedType === 'combo' ? 'Select Combo Items' : 'Select Discounted Products'}
                  </Text>
                  <TouchableOpacity 
                    style={styles.productSelectBtn}
                    onPress={() => {
                      setProductModalMode('reward');
                      setShowProductModal(true);
                    }}
                  >
                    <View style={styles.productSelectLeft}>
                        <Icon 
                        name={selectedType === 'free_product' ? "gift-outline" : 
                              selectedType === 'fixed_price' ? "tag-multiple-outline" :
                              selectedType === 'combo' ? "layers-outline" : "tag-outline"} 
                        size={20} 
                        color={selectedType === 'free_product' ? "#DB2777" : 
                               selectedType === 'fixed_price' ? "#0891B2" :
                               selectedType === 'combo' ? "#EA580C" : "#7C3AED"} 
                      />
                      <Text style={[styles.productSelectText, { color: selectedType === 'free_product' ? "#DB2777" : 
                                                                    selectedType === 'fixed_price' ? "#0891B2" : 
                                                                    selectedType === 'combo' ? "#EA580C" : "#7C3AED" }]}>
                        {selectedRewardProducts.length > 0 
                          ? `${selectedRewardProducts.length} Products Selected` 
                          : selectedType === 'free_product' ? 'Tap to select free products' : 
                            selectedType === 'fixed_price' ? 'Tap to select products' : 
                            selectedType === 'combo' ? 'Tap to select combo items' : 'Tap to select discounted products'}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={Colors.border} />
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.sectionTitle}>Conditions (Optional)</Text>
              
              <View style={styles.conditionCard}>
                <View style={styles.condHeader}>
                  <Icon name="clock-outline" size={20} color={Colors.primary} />
                  <Text style={styles.condLabel}>Time Condition</Text>
                </View>
                <View style={styles.inputRow}>
                  <TouchableOpacity 
                    style={{ flex: 1, marginRight: 8 }}
                    onPress={() => setActivePicker('start')}
                  >
                    <Text style={styles.inputSubLabel}>Start Time</Text>
                    <View style={[styles.timePickerTrigger, startTimeActive && styles.activeTimeTrigger]}>
                      <Text style={[styles.timePickerText, startTimeActive && styles.activeTimePickerText]}>
                        {startTimeActive ? startTime : 'Set Start'}
                      </Text>
                      <TouchableOpacity onPress={() => setStartTimeActive(!startTimeActive)}>
                        <Icon 
                          name={startTimeActive ? "close-circle" : "plus-circle-outline"} 
                          size={20} 
                          color={startTimeActive ? Colors.error : Colors.primary} 
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={{ flex: 1 }}
                    onPress={() => setActivePicker('end')}
                  >
                    <Text style={styles.inputSubLabel}>End Time</Text>
                    <View style={[styles.timePickerTrigger, endTimeActive && styles.activeTimeTrigger]}>
                      <Text style={[styles.timePickerText, endTimeActive && styles.activeTimePickerText]}>
                        {endTimeActive ? endTime : 'Set End'}
                      </Text>
                      <TouchableOpacity onPress={() => setEndTimeActive(!endTimeActive)}>
                        <Icon 
                          name={endTimeActive ? "close-circle" : "plus-circle-outline"} 
                          size={20} 
                          color={endTimeActive ? Colors.error : Colors.primary} 
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </View>
                <Text style={styles.subLabel}>Enable toggles and select time to restrict availability.</Text>
              </View>

              <View style={styles.conditionCard}>
                <View style={styles.condHeader}>
                  <Icon name="account-group-outline" size={20} color={Colors.primary} />
                  <Text style={styles.condLabel}>Applicable Orders</Text>
                </View>
                <Input 
                  placeholder="Applies to first N orders" 
                  value={orderCount} 
                  onChangeText={setOrderCount} 
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.conditionCard}>
                <View style={styles.condHeader}>
                  <Icon name="currency-inr" size={20} color={Colors.primary} />
                  <Text style={styles.condLabel}>Minimum Order Price</Text>
                </View>
                <Input 
                  placeholder="Applies if order > ₹" 
                  value={minPrice} 
                  onChangeText={setMinPrice} 
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.conditionCard}>
                <View style={styles.condHeader}>
                  <Icon name="map-marker-distance" size={20} color={Colors.primary} />
                  <Text style={styles.condLabel}>Distance Radius (km)</Text>
                </View>
                <Input 
                  placeholder="Applies within radius" 
                  value={maxDistance} 
                  onChangeText={setMaxDistance} 
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.conditionCard}>
                <View style={styles.condHeader}>
                  <Icon name="package-variant" size={20} color={Colors.primary} />
                  <Text style={styles.condLabel}>Specific Products</Text>
                </View>
                <TouchableOpacity 
                  style={styles.productSelectBtn}
                  onPress={() => {
                    setProductModalMode('condition');
                    setShowProductModal(true);
                  }}
                >
                  <View style={styles.productSelectLeft}>
                    <Icon name="format-list-bulleted" size={20} color={Colors.textSecondary} />
                    <Text style={styles.productSelectText}>
                      {selectedProducts.length > 0 
                        ? `${selectedProducts.length} Products Selected` 
                        : 'Apply to all products'}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={Colors.border} />
                </TouchableOpacity>
                <Text style={styles.subLabel}>Tap to select specific products for this offer.</Text>
              </View>

              <Button 
                title="Create Offer" 
                onPress={saveOffer} 
                loading={formLoading} 
                style={styles.saveBtn} 
              />
              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Product Selection Modal - Nested for Android Reliability */}
            <Modal visible={showProductModal} transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <View style={styles.productModalContent}>
                  <View style={[styles.modalHeader, { marginBottom: 8 }]}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.modalTitle}>
                        {productModalMode === 'reward' ? 'Select Free Products' : 'Select Target Products'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowProductModal(false)}>
                      <Icon name="close" size={24} color={Colors.text} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.modalSubtitle, { marginBottom: 20 }]}>
                    {productModalMode === 'reward' ? selectedRewardProducts.length : selectedProducts.length} selected
                  </Text>

                  <ScrollView showsVerticalScrollIndicator={false} style={styles.productList}>
                    {storeProducts.length > 0 ? (
                      storeProducts.map((product) => {
                        const isSelected = productModalMode === 'reward' 
                          ? selectedRewardProducts.includes(String(product.id))
                          : selectedProducts.includes(String(product.id));

                        return (
                          <TouchableOpacity 
                            key={product.id} 
                            style={styles.productItem}
                            onPress={() => {
                              const pId = String(product.id);
                              if (productModalMode === 'reward') {
                                if (isSelected) setSelectedRewardProducts(selectedRewardProducts.filter(id => id !== pId));
                                else setSelectedRewardProducts([...selectedRewardProducts, pId]);
                              } else {
                                if (isSelected) setSelectedProducts(selectedProducts.filter(id => id !== pId));
                                else setSelectedProducts([...selectedProducts, pId]);
                              }
                            }}
                          >
                            <Text style={[styles.productName, isSelected && styles.productNameActive]}>
                              {product.name}
                            </Text>
                            <Icon 
                              name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"} 
                              size={24} 
                              color={isSelected ? Colors.primary : Colors.border} 
                            />
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                        <Icon name="package-variant" size={48} color={Colors.border} />
                        <Text style={{ color: Colors.textSecondary, marginTop: 12, fontWeight: '600' }}>No products found</Text>
                      </View>
                    )}
                  </ScrollView>

                  <View style={styles.productModalActions}>
                    <TouchableOpacity 
                      style={styles.clearBtn} 
                      onPress={() => {
                        if (productModalMode === 'reward') setSelectedRewardProducts([]);
                        else setSelectedProducts([]);
                      }}
                    >
                      <Text style={styles.clearBtnText}>Clear All</Text>
                    </TouchableOpacity>
                    <Button 
                      title="Done" 
                      onPress={() => setShowProductModal(false)} 
                      style={styles.doneBtn}
                    />
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        </View>
      </Modal>

      <TimePicker 
        visible={!!activePicker}
        title={activePicker === 'start' ? 'Select Start Time' : 'Select End Time'}
        value={activePicker === 'start' ? startTime : endTime}
        onClose={() => setActivePicker(null)}
        onSelect={(time) => {
          if (activePicker === 'start') {
            setStartTime(time);
            setStartTimeActive(true);
          } else {
            setEndTime(time);
            setEndTimeActive(true);
          }
        }}
      />

      <Modal 
        visible={conditionModal.visible} 
        transparent 
        animationType="slide"
        onRequestClose={() => setConditionModal({ visible: false, offer: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={[styles.offerTabBadge, { 
                  backgroundColor: getTheme(conditionModal.offer?.type || '').bg,
                  alignSelf: 'flex-start',
                  marginBottom: 8
                }]}>
                  <Text style={[styles.offerTabBadgeText, { color: getTheme(conditionModal.offer?.type || '').color }]}>
                    {conditionModal.offer?.type === 'cheap_product' ? 'PRICE DROP' : (conditionModal.offer?.type || '').replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.modalTitle}>{conditionModal.offer?.name || 'Offer Details'}</Text>
              </View>
              <TouchableOpacity onPress={() => setConditionModal({ visible: false, offer: null })}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {conditionModal.offer && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalDesc}>
                  {(() => {
                    const getNames = (ids?: string[]) => {
                      if (!ids || ids.length === 0) return '';
                      const names = ids.map(id => storeProducts.find(p => String(p.id) === String(id))?.name).filter(Boolean);
                      if (names.length === 0) return '';
                      return names.join(', ');
                    };
                    const resolvedName = getNames(conditionModal.offer.reward_data?.product_ids);
                    return getOfferDescription(conditionModal.offer, resolvedName);
                  })()}
                </Text>
                
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Complete Offer Details</Text>
                  
                  <View style={styles.fullCondItem}>
                     <View style={styles.condBullet} />
                     <Text style={styles.fullCondText}>
                       <Text style={{ fontWeight: '800' }}>Eligibility: </Text>
                       {conditionModal.offer.conditions.applicable_orders === 'all' 
                         ? 'Open for all existing and new customers.' 
                         : `Valid only for first ${conditionModal.offer.conditions.applicable_orders} orders from this store.`}
                     </Text>
                  </View>

                  {conditionModal.offer.conditions.min_price && (
                    <View style={styles.fullCondItem}>
                       <View style={styles.condBullet} />
                       <Text style={styles.fullCondText}>
                         <Text style={{ fontWeight: '800' }}>Minimum Purchase: </Text>
                         Customers need to buy products worth ₹{conditionModal.offer.conditions.min_price} or more to apply this offer.
                       </Text>
                    </View>
                  )}

                  {conditionModal.offer.conditions.start_time && (
                    <View style={styles.fullCondItem}>
                       <View style={styles.condBullet} />
                       <Text style={styles.fullCondText}>
                         <Text style={{ fontWeight: '800' }}>Offer Timing: </Text>
                         This offer is only available between {conditionModal.offer.conditions.start_time} and {conditionModal.offer.conditions.end_time}.
                       </Text>
                    </View>
                  )}

                  {conditionModal.offer.conditions.max_distance && (
                    <View style={styles.fullCondItem}>
                       <View style={styles.condBullet} />
                       <Text style={styles.fullCondText}>
                         <Text style={{ fontWeight: '800' }}>Distance Limit: </Text>
                         Delivery address must be within {conditionModal.offer.conditions.max_distance}km from {store?.name || 'your store'}.
                       </Text>
                    </View>
                  )}

                  {conditionModal.offer.conditions.product_ids && conditionModal.offer.conditions.product_ids.length > 0 && (
                    <View style={styles.fullCondItem}>
                       <View style={styles.condBullet} />
                       <View style={{ flex: 1 }}>
                         <Text style={styles.fullCondText}>
                           <Text style={{ fontWeight: '800' }}>Required Products: </Text>
                           To apply this offer, customers must have at least one of these items in their cart:
                         </Text>
                         <View style={styles.productNamesList}>
                            {conditionModal.offer.conditions.product_ids.map((pid: string) => {
                               const product = storeProducts.find(p => String(p.id) === String(pid));
                               return (
                                 <Text key={pid} style={styles.productNameItem}>• {product?.name || 'Specific Product'}</Text>
                               );
                            })}
                         </View>
                       </View>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 12 }}>
              <Button 
                title="Edit Offer" 
                onPress={() => {
                  const off = conditionModal.offer;
                  setConditionModal({ visible: false, offer: null });
                  if (off) handleEditOffer(off);
                }} 
                style={{ flex: 1, marginVertical: 0 }}
              />
              <Button 
                title="Close" 
                variant="outline"
                onPress={() => setConditionModal({ visible: false, offer: null })} 
                style={{ flex: 1, marginVertical: 0 }}
              />
            </View>
          </View>
        </View>
      </Modal>


    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  headerTitleContainer: {
    marginBottom: Spacing.lg,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  disclaimerText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  addBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  addBtnText: {
    color: Colors.white,
    fontWeight: '800',
    marginLeft: 6,
    fontSize: 15,
  },
  offerCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 3,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  cardMainInfo: {
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  offerNameText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
  },
  categoryRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  offerTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  offerTypeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  offerAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  conditionsLine: {
    marginBottom: 16,
    height: 28,
  },
  offerTabCondPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  offerTabCondText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '800',
  },
  offerTabBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  offerTabBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  viewBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  cardSeparator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: -Spacing.lg,
    marginBottom: 16,
  },
  offerActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availabilityGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusToggleLabel: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mainActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  editActionBtn: {
    backgroundColor: Colors.primary + '15',
  },
  deleteActionBtn: {
    backgroundColor: Colors.error + '15',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  getStartedBtn: {
    marginTop: 24,
    width: 200,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  typeModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    maxHeight: height * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: 14,
    fontStyle: 'italic',
    color: Colors.textSecondary,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  typeItem: {
    width: (width - 64) / 2 - 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  typeIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  soonText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textSecondary,
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  formModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    maxHeight: height * 0.9,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 16,
  },
  conditionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  condHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  condLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 8,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  inputSubLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  subLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  orderTypeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  orderTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  orderTypeBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  orderTypeTextBtn: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  orderTypeTextBtnActive: {
    color: Colors.primary,
  },
  productScroll: {
    flexDirection: 'row',
  },
  productPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  productPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  productPillText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  productPillTextActive: {
    color: Colors.white,
  },
  saveBtn: {
    marginTop: 12,
    height: 56,
  },
  timePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    height: 48,
  },
  activeTimeTrigger: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '05',
  },
  timePickerText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  activeTimePickerText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  productSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 8,
  },
  productSelectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  productSelectText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  productModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    height: height * 0.8,
  },
  productList: {
    flex: 1,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  productName: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  productNameActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  productModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 8,
  },
  clearBtn: {
    paddingHorizontal: 16,
    height: 56,
    justifyContent: 'center',
  },
  clearBtnText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  doneBtn: {
    flex: 1,
    height: 56,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '90%',
  },
  modalDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  modalSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fullCondItem: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  condBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 8,
  },
  fullCondText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    flex: 1,
  },
  productNamesList: {
    marginTop: 8,
    gap: 4,
  },
  productNameItem: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    paddingLeft: 8,
  },
  warningInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningInfoText: {
    fontSize: 13,
    color: '#B45309',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
});
