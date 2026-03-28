/**
 * Formats a price into a shortened string with K and M suffixes.
 * Example: 1500 -> 1.5K, 1200000 -> 1.2M
 */
export const formatPriceShort = (price: number | string): string => {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return '0';

  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
};

/**
 * Formats a price with commas as thousand separators.
 * Example: 1500 -> 1,500
 */
export const formatPriceFull = (price: number | string): string => {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return '0';
  
  return num.toLocaleString('en-IN'); // Using Indian numbering or standard? User asked for commas.
};
