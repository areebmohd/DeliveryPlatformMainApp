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
