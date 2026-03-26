import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, borderRadius } from '../../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useCart } from '../../context/CartContext';
import { supabase } from '../../api/supabase';

const { width } = Dimensions.get('window');

export const ProductDetailScreen = ({ route, navigation }: any) => {
  const { product, store } = route.params;
  const insets = useSafeAreaInsets();
  const { addItem, updateQuantity, items } = useCart();
  const [isFavourite, setIsFavourite] = React.useState(false);
  const [favLoading, setFavLoading] = React.useState(false);

  React.useEffect(() => {
    checkFavourite();
  }, [product.id]);

  const checkFavourite = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('favourites')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();

      if (error) throw error;
      setIsFavourite(!!data);
    } catch (e) {
      console.error('Error checking favorite:', e);
    }
  };

  const toggleFavourite = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setFavLoading(true);
      if (isFavourite) {
        const { error } = await supabase
          .from('favourites')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id);
        if (error) throw error;
        setIsFavourite(false);
      } else {
        const { error } = await supabase
          .from('favourites')
          .insert({
            user_id: user.id,
            product_id: product.id,
          });
        if (error) throw error;
        setIsFavourite(true);
      }
    } catch (e) {
      console.error('Error toggling favorite:', e);
    } finally {
      setFavLoading(false);
    }
  };

  const cartItem = items.find(item => item.id === product.id);
  const quantity = cartItem ? cartItem.quantity : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Product Details</Text>
        </View>
        <TouchableOpacity 
          onPress={toggleFavourite} 
          style={styles.favButton}
          disabled={favLoading}
        >
          {favLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Icon 
              name={isFavourite ? "heart" : "heart-outline"} 
              size={24} 
              color={isFavourite ? Colors.error : Colors.primary} 
            />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Section */}
        <View style={styles.imageContainer}>
          {product.image_url ? (
            <Image source={{ uri: product.image_url }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Icon name="package-variant" size={80} color={Colors.border} />
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{product.name}</Text>
            {product.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{product.category}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.priceContainer}>
            <Text style={styles.price}>₹{product.price}</Text>
            {product.weight_kg ? (
              <Text style={styles.weight}>
                ({product.weight_kg < 1 ? `${product.weight_kg * 1000}gm` : `${product.weight_kg}kg`})
              </Text>
            ) : null}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Description</Text>
          {(() => {
            try {
              if (!product.description) return <Text style={styles.description}>No description available.</Text>;
              const parsed = JSON.parse(product.description);
              if (Array.isArray(parsed) && parsed.length > 0) {
                return (
                  <View style={styles.specList}>
                    {parsed.map((item: any, idx: number) => (
                      <View key={idx} style={styles.specItem}>
                        <Text style={styles.specLabel}>{item.title || 'Info'}</Text>
                        <Text style={styles.specValue}>{item.text}</Text>
                      </View>
                    ))}
                  </View>
                );
              }
              return <Text style={styles.description}>{product.description}</Text>;
            } catch (e) {
              return <Text style={styles.description}>{product.description}</Text>;
            }
          })()}
        </View>
      </ScrollView>

      {/* Bottom Sticky Button */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
        {quantity > 0 ? (
          <View style={styles.cartControls}>
            <TouchableOpacity 
              style={styles.quantityBtn} 
              onPress={() => updateQuantity(product.id, -1)}
            >
              <Icon name="minus" size={20} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity 
              style={styles.quantityBtn} 
              onPress={() => updateQuantity(product.id, 1)}
            >
              <Icon name="plus" size={20} color={Colors.white} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.addToCartBtn}
            onPress={() => addItem(product, store)}
          >
            <Icon name="cart-plus" size={20} color={Colors.white} style={{ marginRight: 8 }} />
            <Text style={styles.addToCartText}>Add To Cart</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: Colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: Colors.white,
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
    marginLeft: Spacing.md,
  },
  scrollContent: {
    paddingTop: Spacing.sm,
  },
  imageContainer: {
    width: width,
    height: width, // Square image
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  infoContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: Spacing.xs,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: Spacing.xs,
  },
  categoryBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
  },
  weight: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 6,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    fontWeight: '500',
  },
  specList: {
    marginTop: Spacing.sm,
  },
  specItem: {
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 12,
    borderRadius: 8,
  },
  specLabel: {
    fontSize: 11,
    color: '#6c757d',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  specValue: {
    fontSize: 16,
    color: '#121212',
    lineHeight: 22,
    fontWeight: '600',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  addToCartBtn: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  addToCartText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  cartControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  quantityBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '800',
  },
});
