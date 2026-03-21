function parseWkbPoint(wkbHex) {
  if (!wkbHex || typeof wkbHex !== 'string') return null;
  
  try {
    if (wkbHex.length < 50) return null; 
    
    // Extract X and Y (last 32 hex chars)
    const xHex = wkbHex.substring(wkbHex.length - 32, wkbHex.length - 16);
    const yHex = wkbHex.substring(wkbHex.length - 16);
    
    function hexToDoubleLE(hex) {
      const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
      const buffer = new ArrayBuffer(8);
      const bView = new Uint8Array(buffer);
      bView.set(bytes);
      const view = new DataView(buffer);
      return view.getFloat64(0, true); // true = little-endian
    }

    const lon = hexToDoubleLE(xHex);
    const lat = hexToDoubleLE(yHex);
    
    return { longitude: lon, latitude: lat };
  } catch (e) {
    console.error('WKB parse error:', e);
    return null;
  }
}

const testHex = "0101000020E6100000B6847CD0B34153401283C0CAA1753C40";
const result = parseWkbPoint(testHex);
console.log('Parsed:', JSON.stringify(result));
// Expected: ~77.02.., ~28.69.. (depending on the hex provided)
