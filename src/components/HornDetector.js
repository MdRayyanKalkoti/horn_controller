import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getMapboxPOIs } from '../utils/geoUtils';
import { temporaryGeocode, getCoordinates } from '../utils/geoUtils';

// Initialize Mapbox
mapboxgl.accessToken = 'pk.eyJ1IjoibWQtcmF5eWFuLTA0IiwiYSI6ImNtY2Rhc2d6azBnemkya3NhN3FtN2pud3AifQ.9Pffdl35floWurrolAs55Q';

const NO_HONK_ZONES = [
  { lat: 18.6300, lng: 73.8200, name: "Central School Zone", radius: 1000 },
  { lat: 18.6250, lng: 73.8250, name: "City Hospital Area", radius: 200 },
  { lat: 18.6200, lng: 73.8150, name: "Downtown Quiet Zone", radius: 100 },
  { lat: 18.6350, lng: 73.8300, name: "Residential Area", radius: 50 },
  { 
    lat: 18.5604,
    lng: 73.7906,
    name: "Shambhu Vihar Society", 
    address: "Baner CHS, Aundh, Pune, Maharashtra 411007",
    radius: 3000
  }
];

const HornDetector = () => {
  // State management
  const [position, setPosition] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState('--');
  const [inRestrictedZone, setInRestrictedZone] = useState(false);
  const [nearestZone, setNearestZone] = useState({ name: '', distance: 0 });
  const [distanceTraveled, setDistanceTraveled] = useState(0);
  const [tripDuration, setTripDuration] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [noHonkZones, setNoHonkZones] = useState(NO_HONK_ZONES);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  
  // Refs
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const watchId = useRef(null);
  const startTime = useRef(null);
  const prevPosition = useRef(null);
  const pathCoordinates = useRef([]);

  // Geocoding functions
  const handleLocationSearch = useCallback(async (query) => {
    try {
      const result = await temporaryGeocode(query);
      const coords = getCoordinates(result);
      setSearchResults(result);
      return coords;
    } catch (error) {
      console.error('Geocoding error:', error);
      throw error;
    }
  }, []);

  const handleSearchClick = async () => {
    if (!searchQuery.trim()) return;
    try {
      const coords = await handleLocationSearch(searchQuery);
      if (coords && map.current) {
        map.current.flyTo({
          center: [coords[0], coords[1]],
          zoom: 14
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  // Core functionality
  const loadPOIs = useCallback(async () => {
    try {
      const [schools, hospitals] = await Promise.all([
        getMapboxPOIs(18.5204, 73.8567, 'school'),
        getMapboxPOIs(18.5204, 73.8567, 'hospital')
      ]);

      const newZones = [
        ...NO_HONK_ZONES,
        ...schools.map(place => ({
          lat: place.center[1],
          lng: place.center[0],
          name: place.text,
          radius: 100,
          type: 'school'
        })),
        ...hospitals.map(place => ({
          lat: place.center[1],
          lng: place.center[0],
          name: place.text,
          radius: 200,
          type: 'hospital'
        }))
      ];

      setNoHonkZones(newZones);
    } catch (error) {
      console.error("Failed to load POIs:", error);
    }
  }, []);

  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }, []);

  const calculateBearing = useCallback((lat1, lon1, lat2, lon2) => {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return (θ * 180 / Math.PI + 360) % 360;
  }, []);

  const bearingToDirection = useCallback((bearing) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(bearing / 45) % 8];
  }, []);

  const createVehicleMarker = useCallback(() => {
    const el = document.createElement('div');
    el.className = 'vehicle-marker';
    el.style.width = '32px';
    el.style.height = '32px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.color = inRestrictedZone ? '#ff0000' : '#4CAF50';
    el.style.fontSize = '24px';
    el.style.fontWeight = 'bold';
    el.innerHTML = '➤';
    return el;
  }, [inRestrictedZone]);

  const checkZoneProximity = useCallback((currentPos) => {
    if (!currentPos) return;

    let minDistance = Infinity;
    let closestZone = null;

    noHonkZones.forEach(zone => {
      const distance = calculateDistance(
        currentPos.lat, currentPos.lng,
        zone.lat, zone.lng
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestZone = zone;
      }
    });

    setNearestZone({
      name: closestZone?.name || '',
      distance: Math.round(minDistance)
    });

    const isInZone = closestZone && minDistance < closestZone.radius;
    setInRestrictedZone(isInZone);
  }, [noHonkZones, calculateDistance]);

  const updatePath = useCallback(() => {
    if (!map.current || pathCoordinates.current.length < 2) return;

    const source = map.current.getSource('route');
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: pathCoordinates.current
        }
      });
    }
  }, []);

  // Map initialization
  const initMap = useCallback(() => {
    if (map.current || !position) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: darkMode ? 'mapbox://styles/mapbox/dark-v10' : 'mapbox://styles/mapbox/light-v10',
      center: [position.lng, position.lat],
      zoom: 14
    });

    map.current.addControl(new mapboxgl.NavigationControl());

    noHonkZones.forEach(zone => {
      const el = document.createElement('div');
      el.className = 'zone-marker';
      el.innerHTML = `<span>${zone.name}</span>`;
      new mapboxgl.Marker(el)
        .setLngLat([zone.lng, zone.lat])
        .addTo(map.current);

      map.current.on('load', () => {
        map.current.addLayer({
          id: `zone-${zone.name}`,
          type: 'circle',
          source: {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [zone.lng, zone.lat]
              },
              properties: {
                description: zone.name
              }
            }
          },
          paint: {
            'circle-radius': zone.radius,
            'circle-color': '#ff0000',
            'circle-opacity': 0.1,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ff0000'
          }
        });
      });
    });

    map.current.on('load', () => {
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        }
      });

      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3bb2d0',
          'line-width': 4
        }
      });
    });

    marker.current = new mapboxgl.Marker({
      element: createVehicleMarker()
    }).setLngLat([position.lng, position.lat])
      .addTo(map.current);
  }, [position, darkMode, createVehicleMarker, noHonkZones]);

  // Position tracking
  const handlePositionUpdate = useCallback((position) => {
    const { latitude, longitude, speed: gpsSpeed, accuracy } = position.coords;
    const now = new Date();
    
    setPosition({ lat: latitude, lng: longitude });
    setGpsAccuracy(accuracy);
    setLastUpdate(now.toLocaleTimeString());
    setSpeed(Math.round((gpsSpeed || 0) * 3.6));

    if (prevPosition.current) {
      const bearing = calculateBearing(
        prevPosition.current.lat, prevPosition.current.lng,
        latitude, longitude
      );
      setHeading(bearingToDirection(bearing));

      const distance = calculateDistance(
        prevPosition.current.lat, prevPosition.current.lng,
        latitude, longitude
      );
      setDistanceTraveled(prev => prev + (distance / 1000));
    }

    pathCoordinates.current.push([longitude, latitude]);
    if (pathCoordinates.current.length > 100) {
      pathCoordinates.current.shift();
    }

    if (startTime.current) {
      setTripDuration(Math.floor((now - startTime.current) / 1000 / 60));
    }

    prevPosition.current = { lat: latitude, lng: longitude };
    checkZoneProximity({ lat: latitude, lng: longitude });
  }, [calculateBearing, bearingToDirection, calculateDistance, checkZoneProximity]);

  // Effects
  useEffect(() => {
    if (!navigator.geolocation) return;
    
    startTime.current = new Date();
    pathCoordinates.current = [];

    watchId.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      (error) => console.error("GPS error:", error),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId.current);
  }, [handlePositionUpdate]);

  useEffect(() => { loadPOIs(); }, [loadPOIs]);
  useEffect(() => { if (position) initMap(); }, [position, initMap]);
  useEffect(() => { if (!map.current) return;
    map.current.setStyle(darkMode ? 'mapbox://styles/mapbox/dark-v10' : 'mapbox://styles/mapbox/light-v10');
  }, [darkMode]);

  useEffect(() => {
    if (!position || !map.current || !marker.current) return;

    marker.current.setLngLat([position.lng, position.lat]);
    const markerEl = marker.current.getElement();
    markerEl.style.backgroundColor = inRestrictedZone ? '#ff0000' : '#4CAF50';

    map.current.flyTo({
      center: [position.lng, position.lat],
      essential: true
    });

    updatePath();
  }, [position, inRestrictedZone, updatePath]);

  // UI Rendering
  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>
      <div className="dashboard">
        <div className="header">
          <h1>Real-time Vehicle Horn Detector</h1>
          <p>Live geolocation tracking that automatically disables honking in restricted zones</p>
          <button onClick={() => setDarkMode(!darkMode)} className="theme-toggle">
            {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>

        <div className="main-content">
          <div className="map-container" ref={mapContainer}>
            <div className="map-search-container">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search location..."
                className="map-search-input"
                onKeyPress={(e) => e.key === 'Enter' && handleSearchClick()}
              />
              <button onClick={handleSearchClick} className="map-search-button">
                Search
              </button>
              {searchResults && (
                <div className="map-search-results">
                  {searchResults.features.slice(0, 5).map((feature, index) => (
                    <div
                      key={index}
                      className="map-search-result"
                      onClick={() => {
                        if (map.current) {
                          map.current.flyTo({
                            center: feature.center,
                            zoom: 14
                          });
                        }
                        setSearchResults(null);
                      }}
                    >
                      {feature.place_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="status-panel">
            <div className={`status-indicator ${inRestrictedZone ? 'restricted' : 'allowed'}`}>
              <h2>{inRestrictedZone ? '🚫 HONKING DISABLED' : '🔊 HONKING ENABLED'}</h2>
              <p>{inRestrictedZone 
                ? `You are in ${nearestZone.name} (${nearestZone.distance}m)` 
                : 'You are outside restricted zones.'}
              </p>
              <div className="status-icon">
                {inRestrictedZone ? '⛔ No Honking' : '✅ Safe to honk'}
              </div>
            </div>

            <div className="position-info">
              <h3>Current Position</h3>
              <p>Latitude: {position ? position.lat.toFixed(6) : '--'}</p>
              <p>Longitude: {position ? position.lng.toFixed(6) : '--'}</p>
              <p>Speed: {speed} km/h</p>
              <p>Heading: {heading}</p>
              <p>Accuracy: {gpsAccuracy.toFixed(0)} meters</p>
              <p>Last update: {lastUpdate || '--'}</p>
            </div>

            <div className="zone-info">
              <h3>Nearest Restricted Zone</h3>
              {nearestZone.name ? (
                <div className="zone-details">
                  <div className="zone-name">{nearestZone.name}</div>
                  <div className={`zone-distance ${nearestZone.distance < 200 ? 'warning' : ''}`}>
                    {nearestZone.distance}m away
                  </div>
                </div>
              ) : (
                <p>No restricted zones nearby</p>
              )}
            </div>
          </div>

          <div className="stats-panel">
            <div className="stat-card">
              <h4>Vehicle Information</h4>
              <div className="stat-value">{speed} km/h</div>
              <div className="stat-label">CURRENT SPEED</div>
            </div>

            <div className="stat-card">
              <h4>Trip Duration</h4>
              <div className="stat-value">{tripDuration} min</div>
              <div className="stat-label">DURATION</div>
            </div>

            <div className="stat-card">
              <h4>Distance to Zone</h4>
              <div className={`stat-value ${nearestZone.distance < 200 ? 'warning' : 'safe'}`}>
                {nearestZone.distance}m
              </div>
              <div className="stat-label">
                {nearestZone.distance < 200 ? 'Approaching' : 'Safe'}
              </div>
            </div>

            <div className="stat-card">
              <h4>Distance Traveled</h4>
              <div className="stat-value">{distanceTraveled.toFixed(1)} km</div>
              <div className="stat-label">TOTAL DISTANCE</div>
            </div>
          </div>
        </div>

        <div className="footer">
          <p>Real-time Horn Detection System | Uses live geolocation to enforce no-honk zones</p>
          <p>Automatically disables honking within restricted areas</p>
        </div>
      </div>
    </div>
  );
};

export default HornDetector;