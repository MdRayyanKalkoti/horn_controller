const geocodeCache = new Map();

export const cachedGeocode = async (query) => {
  if (geocodeCache.has(query)) return geocodeCache.get(query);
  const result = await temporaryGeocode(query);
  geocodeCache.set(query, result);
  return result;
};

export const temporaryGeocode = async (query) => {
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${process.env.REACT_APP_MAPBOX_ACCESS_TOKEN}`
  );
  if (!response.ok) throw new Error('Geocoding failed');
  return await response.json();
};

export const permanentGeocode = async (query) => {
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places-permanent/${encodeURIComponent(query)}.json?access_token=${process.env.REACT_APP_MAPBOX_ACCESS_TOKEN}`
  );
  if (!response.ok) throw new Error('Geocoding failed');
  return await response.json();
};

// Helper function to extract coordinates from result
export const getCoordinates = (geocodeResult) => {
  if (!geocodeResult.features || geocodeResult.features.length === 0) return null;
  return geocodeResult.features[0].center; // [longitude, latitude]
};


export async function getMapboxPOIs(lat, lng, category) {
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${category}.json?proximity=${lng},${lat}&access_token=${process.env.REACT_APP_MAPBOX_ACCESS_TOKEN}`
  );
  const data = await response.json();
  return data.features; // Returns [{ center: [lng,lat], text: "Name" }, ...]
}

// Calculate distance between two points
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return (R * c * 1000); // Distance in meters
};

const deg2rad = (deg) => deg * (Math.PI/180);

// Check if near no-honk zones
export const isInNoHonkZone = (currentPos, zones) => {
  // Default radius: 200 meters if env variable not set
  const radius = process.env.REACT_APP_NO_HONK_RADIUS || 200;
  
  return zones.some(zone => 
    calculateDistance(
      currentPos.lat,
      currentPos.lng,
      zone.lat,
      zone.lng
    ) <= radius
  );
};