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

// Simple marker creator for POIs
export function addPOIMarkers(map, zones) {
  zones.forEach(zone => {
    L.marker([zone.lat, zone.lng])
      .addTo(map)
      .bindPopup(`<b>${zone.name}</b>`);
  });
}

export default L;