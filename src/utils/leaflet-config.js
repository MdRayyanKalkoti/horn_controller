import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Configure default Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

// Custom icons configuration
const createCustomIcon = (iconUrl, iconSize = [25, 25]) => new L.Icon({
  iconUrl,
  iconSize,
  iconAnchor: [12, 25],
  popupAnchor: [0, -25]
});

// Predefined icons
const icons = {
  school: createCustomIcon('/icons/school-icon.png'),
  hospital: createCustomIcon('/icons/hospital-icon.png'),
  search: createCustomIcon('/icons/search-marker.png', [30, 30])
};

// Vehicle marker (dynamic color)
const createVehicleIcon = (isRestricted) => L.divIcon({
  className: 'vehicle-marker',
  html: '➤',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
  style: {
    color: isRestricted ? '#ff0000' : '#4CAF50',
    fontSize: '24px',
    fontWeight: 'bold'
  }
});

// Main functions
export function addPOIMarkers(map, zones) {
  if (!map) return;
  
  zones.forEach(zone => {
    const icon = zone.type && icons[zone.type] ? icons[zone.type] : L.Icon.Default;
    
    const marker = L.marker([zone.lat, zone.lng], { icon })
      .addTo(map)
      .bindPopup(`
        <b>${zone.name}</b><br>
        ${zone.type ? `Type: ${zone.type}<br>` : ''}
        Radius: ${zone.radius}m
        ${zone.address ? `<br>Address: ${zone.address}` : ''}
      `);

    // Add zone radius circle
    L.circle([zone.lat, zone.lng], {
      color: '#ff0000',
      fillColor: '#ff0000',
      fillOpacity: 0.1,
      radius: zone.radius
    }).addTo(map);
  });
}

export function updateVehicleMarker(map, position, isRestricted) {
  if (!map || !position) return null;
  
  return L.marker([position.lat, position.lng], {
    icon: createVehicleIcon(isRestricted),
    zIndexOffset: 1000
  }).addTo(map);
}

export function updatePathLayer(map, coordinates) {
  if (!map || coordinates.length < 2) return null;
  
  return L.polyline(coordinates, {
    color: '#3bb2d0',
    weight: 4,
    lineJoin: 'round',
    lineCap: 'round'
  }).addTo(map);
}

export function createMarkerFromGeocode(geocodeResult, map) {
  if (!geocodeResult?.features?.[0] || !map) return null;
  
  const [lng, lat] = geocodeResult.features[0].center;
  const marker = L.marker([lat, lng], { icon: icons.search })
    .addTo(map)
    .bindPopup(geocodeResult.features[0].place_name);
  
  return marker;
}

export default L;