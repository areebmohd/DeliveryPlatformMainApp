/**
 * Parses WKT (Well-Known Text) Point string into lat/lng coordinates.
 * Expected format: "POINT(lng lat)"
 */
export const parseWKT = (wkt: any): { lat: number, lng: number } | null => {
  if (!wkt) return null;
  
  // Handle object (GeoJSON)
  if (typeof wkt === 'object') {
    if (wkt.coordinates && wkt.coordinates.length >= 2) {
      return {
        lng: wkt.coordinates[0],
        lat: wkt.coordinates[1]
      };
    }
    if (wkt.lat !== undefined && wkt.lng !== undefined) {
      return { lat: wkt.lat, lng: wkt.lng };
    }
    return null;
  }

  // Handle string (WKT)
  const match = wkt.match(/POINT\(([-\d.]+) ([-\d.]+)\)/i);
  if (!match) return null;
  return {
    lng: parseFloat(match[1]), // WKT is usually (lng lat)
    lat: parseFloat(match[2])
  };
};

/**
 * Calculates straight-line distance between two points in km using Haversine formula.
 */
export const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Utility to deduplicate products based on user criteria:
 * 1. Personal: Never deduplicated.
 * 2. Barcode: Same barcode number -> Keep nearest.
 * 3. Common: Same name, price, weight, description, options -> Keep nearest.
 * Fallback to cheapest if no user location is provided.
 */
export const deduplicateProducts = (products: any[], userLocation?: { lat: number, lng: number } | null): any[] => {
  if (!products || products.length === 0) return [];

  const personalProducts: any[] = [];
  const barcodeGroups = new Map<string, any>();
  const commonGroups = new Map<string, any>();

  products.forEach(product => {
    // 1. Personal products stay unique
    if (product.product_type === 'personal') {
      personalProducts.push(product);
      return;
    }

    // 2. Identify the group key
    let uniqueKey = '';
    let groupMap: Map<string, any> | null = null;
    const optionsStr = product.options ? JSON.stringify(product.options) : '[]';
    const baseKey = `${product.name}_${product.price}_${product.weight_kg}_${product.description}_${optionsStr}`;

    if (product.product_type === 'barcode' && product.barcode && product.barcode.trim().length > 0) {
      // For barcode products, we still want to match primarily on barcode, 
      // but also ensure the other criteria match to be considered "the same" per user requirement
      uniqueKey = `barcode_${product.barcode.trim()}_${baseKey}`;
      groupMap = barcodeGroups;
    } else {
      // Treat everything else (even if marked as barcode but missing one) as common or use common logic
      uniqueKey = `common_${baseKey}`;
      groupMap = commonGroups;
    }

    if (!groupMap) return; // Should not happen

    const existing = groupMap.get(uniqueKey);
    if (!existing) {
      groupMap.set(uniqueKey, product);
    } else {
      // Comparison logic: Nearest store wins. Fallback to cheapest.
      let useNew = false;

      if (userLocation) {
        const existingLoc = parseWKT(existing.stores?.location_wkt);
        const currentLoc = parseWKT(product.stores?.location_wkt);

        if (currentLoc && existingLoc) {
          const distExisting = getHaversineDistance(userLocation.lat, userLocation.lng, existingLoc.lat, existingLoc.lng);
          const distCurrent = getHaversineDistance(userLocation.lat, userLocation.lng, currentLoc.lat, currentLoc.lng);
          
          if (distCurrent < distExisting) {
            useNew = true;
          } else if (distCurrent === distExisting) {
            // Tie-break with price
            if (product.price < existing.price) useNew = true;
          }
        } else if (currentLoc) {
          // If existing has no location but current does, use current
          useNew = true;
        } else {
          // Tie-break with price
          if (product.price < existing.price) useNew = true;
        }
      } else {
        // Fallback to cheapest
        if (product.price < existing.price) useNew = true;
      }

      if (useNew) {
        groupMap.set(uniqueKey, product);
      }
    }
  });

  return [
    ...personalProducts,
    ...Array.from(barcodeGroups.values()),
    ...Array.from(commonGroups.values())
  ];
};
