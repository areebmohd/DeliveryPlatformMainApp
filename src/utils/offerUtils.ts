export const getTheme = (type: string) => {
  switch (type) {
    case 'free_delivery':
      return { color: '#D97706', bg: '#FEF3C7', icon: 'truck-delivery' };
    case 'free_product':
      return { color: '#DB2777', bg: '#FCE7F3', icon: 'gift' };
    case 'discount':
      return { color: '#2563EB', bg: '#DBEAFE', icon: 'percent' };
    case 'free_cash':
      return { color: '#10B981', bg: '#D1FAE5', icon: 'cash' };
    case 'cheap_product':
      return { color: '#7C3AED', bg: '#EDE9FE', icon: 'tag-outline' };
    case 'combo':
      return { color: '#EA580C', bg: '#FFEDD5', icon: 'layers-outline' };
    case 'trending':
      return { color: '#EA580C', bg: '#FFEDD5', icon: 'fire' };
    case 'best_value':
      return { color: '#9333EA', bg: '#F3E8FF', icon: 'star' };
    default:
      return { color: '#475569', bg: '#F1F5F9', icon: 'tag' };
  }
};

export const getOfferDescription = (offer: any, resolvedName?: string) => {
  if (!offer) return '';

  const { type, amount, reward_data } = offer;
  const nameToUse = resolvedName || reward_data?.product_name;

  switch (type) {
    case 'discount':
      return `${amount}% Instant Discount on Total Items Price`;
    case 'free_delivery':
      return '₹0 Delivery fee';
    case 'free_product':
      return `Get Free ${nameToUse || 'Gift Item'}`;
    case 'cheap_product':
      return `${amount}% Instant Discount on ${nameToUse || 'Some Items'}`;
    case 'combo':
      return `${nameToUse || 'Items'} at Only ₹${amount}`;
    case 'free_cash':
      return `₹${amount} Free Cash amount`;
    default:
      return 'Special store offer';
  }
};

export const getOfferConditionList = (offer: any) => {
  if (!offer?.conditions) return [];
  const list: string[] = [];
  const { conditions } = offer;

  if (conditions.min_price) {
    list.push(`Min. ₹${conditions.min_price}`);
  }

  if (conditions.start_time && conditions.end_time) {
    const formatTime = (time: string) => {
        return time.replace(/:\d{2}/, '').replace(' ', '').toUpperCase();
    };
    list.push(`${formatTime(conditions.start_time)}-${formatTime(conditions.end_time)}`);
  }

  if (conditions.max_distance) {
    list.push(`Under ${conditions.max_distance}km`);
  }

  if (conditions.applicable_orders) {
    if (conditions.applicable_orders === 'first') {
        list.push('First order');
    } else if (typeof conditions.applicable_orders === 'number') {
        list.push(`First ${conditions.applicable_orders} orders`);
    }
  }

  if (conditions.product_ids && conditions.product_ids.length > 0) {
    list.push(`${conditions.product_ids.length} products`);
  }

  if (list.length === 0) {
    return ['No Condition'];
  }

  return list;
};

export const validateOffer = (offer: any, subtotal: number, distance: number = 0, orderCount: number = 0, cartItems: any[] = []) => {
  if (!offer?.conditions) return { valid: true, errors: [] };
  const { conditions } = offer;
  const errors: string[] = [];

  if (conditions.min_price && subtotal < conditions.min_price) {
    errors.push(`Minimum ₹${conditions.min_price} purchase required`);
  }

  if (conditions.max_distance && distance > 0 && distance > conditions.max_distance) {
    errors.push(`Store is too far (max ${conditions.max_distance}km)`);
  }
  
  if (conditions.applicable_orders === 'first' && orderCount > 0) {
    errors.push('Offer only valid for your first order');
  } else if (typeof conditions.applicable_orders === 'number' && orderCount >= conditions.applicable_orders) {
    errors.push(`Offer only valid for first ${conditions.applicable_orders} orders`);
  }

  // Time check
  if (conditions.start_time && conditions.end_time) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const parseTime = (time: string) => {
      const parts = time.split(':');
      if (parts.length < 2) return 0;
      let h = parseInt(parts[0]);
      const m = parseInt(parts[1].split(' ')[0]);
      if (time.includes('PM') && h < 12) h += 12;
      if (time.includes('AM') && h === 12) h = 0;
      return h * 60 + m;
    };

    const start = parseTime(conditions.start_time);
    const end = parseTime(conditions.end_time);

    if (currentTime < start || currentTime > end) {
      errors.push(`Available only between ${conditions.start_time} - ${conditions.end_time}`);
    }
  }

  // ALL products check
  if (conditions.product_ids && conditions.product_ids.length > 0) {
    const allPresent = conditions.product_ids.every((pid: string) => 
      cartItems.some(item => item.id === pid)
    );
    if (!allPresent) {
      errors.push(`All ${conditions.product_ids.length} required products must be in your cart`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
