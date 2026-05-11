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
 * 2. Barcode: Same barcode number -> Keep nearest open store.
 * 3. Common: Same name, price, weight, description, options -> Keep nearest open store.
 * Priority: Open store > Closed store. Among same status, nearest wins. Fallback to cheapest.
 */
export const deduplicateProducts = (products: any[], userLocation?: { lat: number, lng: number } | null): any[] => {
  if (!products || products.length === 0) return [];
  
  const deduplicatedMap = new Map<string, any>();

  products.forEach(product => {
    // 1. Determine the deduplication key
    let key = product.id; // Default: No deduplication (Personal)
    
    if (product.product_type === 'common' && product.master_product_id) {
      key = `master_${product.master_product_id}`;
    } else if (product.product_type === 'barcode' && product.barcode) {
      key = `barcode_${product.barcode}`;
    } else if (product.product_type === 'personal') {
      key = `personal_${product.id}`;
    }

    const existing = deduplicatedMap.get(key);
    if (!existing) {
      deduplicatedMap.set(key, product);
      return;
    }

    // 2. Conflict resolution: Keep the "best" one
    // Priority: Open Store > Nearest Store > Cheapest
    const storeA = existing.stores;
    const storeB = product.stores;

    const isOpenA = storeA?.is_currently_open;
    const isOpenB = storeB?.is_currently_open;

    if (isOpenB && !isOpenA) {
      deduplicatedMap.set(key, product);
      return;
    }

    if (isOpenA === isOpenB && userLocation) {
      const locA = parseWKT(storeA?.location_wkt || storeA?.location);
      const locB = parseWKT(storeB?.location_wkt || storeB?.location);
      
      const distA = locA ? getHaversineDistance(userLocation.lat, userLocation.lng, locA.lat, locA.lng) : Infinity;
      const distB = locB ? getHaversineDistance(userLocation.lat, userLocation.lng, locB.lat, locB.lng) : Infinity;

      if (distB < distA) {
        deduplicatedMap.set(key, product);
        return;
      }
    }
  });

  return Array.from(deduplicatedMap.values());
};
