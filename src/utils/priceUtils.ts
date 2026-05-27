/**
 * Calculates the total price of a product based on its base price and selected options.
 * Each selected option can have an optional price_adjustment.
 */
export const calculateProductPrice = (product: any, selectedOptions: Record<string, string>): number => {
  let total = parseFloat(product.price) || 0;

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
        const pAdj = parseFloat(optionInfo.price_adjustment);
        if (pAdj) {
          total += pAdj;
        }
      }
    }
  });

  return total;
};

/**
 * Calculates the total weight of a product based on its base weight and selected options.
 * Each selected option can have an optional weight_adjustment.
 */
export const calculateProductWeight = (product: any, selectedOptions: Record<string, string>): number => {
  let total = parseFloat(product.weight_kg) || 0;

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
        const wAdj = parseFloat(optionInfo.weight_adjustment);
        if (wAdj) {
          total += wAdj;
        }
      }
    }
  });

  return total;
};

/**
 * Gets the adjustment display string for an option value (both price and weight).
 * Example: price 20, weight 0.5 -> " (+₹20, +0.5kg)"
 */
export const getPriceAdjustmentLabel = (optionValue: any): string => {
  return '';
};

