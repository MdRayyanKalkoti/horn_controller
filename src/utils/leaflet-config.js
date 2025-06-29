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

// Custom icons for POIs
const schoolIcon = new L.Icon({
  iconUrl: '/icons/school-icon.png',  // Place these in public/icons/
  iconSize: [25, 25],
  iconAnchor: [12, 25],
  popupAnchor: [0, -25]
});

const hospitalIcon = new L.Icon({
  iconUrl: '/icons/hospital-icon.png',
  iconSize: [25, 25],
  iconAnchor: [12, 25],
  popupAnchor: [0, -25]
});

// Function to add POI markers to map
export function addPOIMarkers(map, noHonkZones) {
  noHonkZones.forEach(zone => {
    const icon = zone.type === 'school' ? schoolIcon : 
                zone.type === 'hospital' ? hospitalIcon : 
                L.Icon.Default;
    
    L.marker([zone.lat, zone.lng], { icon })
      .addTo(map)
      .bindPopup(`
        <b>${zone.name}</b><br>
        Type: ${zone.type}<br>
        Radius: ${zone.radius}m
      `);
  });
}

// Usage in your HornDetector component:
// 1. Initialize map first
// 2. After loading POIs, call:
//    addPOIMarkers(map, NO_HONK_ZONES);

export default L;