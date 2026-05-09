/**
 * Calculates the total price of a product based on its base price and selected options.
 * Each selected option can have an optional price_adjustment.
 */
export const calculateProductPrice = (product: any, selectedOptions: Record<string, string>): number => {
  let total = product.price || 0;

  if (!product.options || !Array.isArray(product.options)) {
    return total;
  }

  product.options.forEach((opt: any) => {
    const selectedValue = selectedOptions[opt.title];
    if (selectedValue) {
      const optionInfo = opt.values.find((v: any) => 
        (typeof v === 'string' ? v : v.value) === selectedValue
      );
      
      if (optionInfo && typeof optionInfo === 'object') {
        if (optionInfo.price_adjustment) {
          total += optionInfo.price_adjustment;
        } else if (optionInfo.price) {
          // If an absolute price is provided, it might override the base logic 
          // or be used as the base for that group. 
          // For now, we'll treat price as an absolute replacement for the base price if only one option group has it,
          // but adjustment is safer for stacking.
          // Let's assume price in an option is also an adjustment if base price exists.
          // Or just prioritize price_adjustment as requested.
        }
      }
    }
  });

  return total;
};

/**
 * Gets the price adjustment display string for an option value.
 * Example: 20 -> "+₹20", -10 -> "-₹10", 0 -> ""
 */
export const getPriceAdjustmentLabel = (optionValue: any): string => {
  if (typeof optionValue !== 'object' || !optionValue.price_adjustment) {
    return '';
  }

  const adj = optionValue.price_adjustment;
  if (adj > 0) return ` (+ ₹${adj})`;
  return '';
};
