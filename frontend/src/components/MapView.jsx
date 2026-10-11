import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Globe, Radio, EyeOff, Navigation, Compass, Minimize2, Maximize2, ChevronDown, ChevronUp, Play, Pause, RotateCcw, ArrowRight, ArrowLeft, ShieldAlert, Sparkles, Satellite, AlertTriangle, Wind } from 'lucide-react';

const CARTO_API_KEY = 'cb1_2k7z_1_fbe29935c68e085b6c29a984';

const BASEMAP_URLS = {
  carto_voyager: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`,
  carto_dark: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`,
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
};

const BASEMAP_ATTRIBUTIONS = {
  carto_voyager: '&copy; Sagar Netra &copy; UDAAN',
  carto_dark: '&copy; Sagar Netra &copy; UDAAN',
  satellite: '&copy; Sagar Netra &copy; UDAAN'
};

// SVG Ship Icon Generator
const createVesselSvgIcon = (courseDeg, rankColor, isRank1, vesselName, rankNum) => {
  const rotation = (courseDeg || 0) - 90; // Align SVG bow pointing forward
  const size = isRank1 ? 28 : 22;
  const half = size / 2;

  const svgHtml = `
    <div style="position:relative; width:${size}px; height:${size}px; display:flex; items-center; justify-center;">
      ${isRank1 ? `<div style="position:absolute; inset:-3px; border-radius:50%; border:1.5px dashed ${rankColor}; opacity:0.8; animation:spin 8s linear infinite;"></div>` : ''}
      <svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${rotation}deg); filter: drop-shadow(0 0 6px ${rankColor});">
        <!-- Ship Hull -->
        <path d="M 18 2 L 28 14 L 26 31 C 26 33.5 10 33.5 10 31 L 8 14 Z" fill="${rankColor}" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
        <!-- Deck Superstructure -->
        <rect x="14" y="18" width="8" height="9" rx="1.5" fill="#ffffff" opacity="0.95"/>
        <!-- Bow Indicator -->
        <polygon points="18,4 22,10 14,10" fill="#ffffff"/>
        <!-- Navigation Beacon Light -->
        <circle cx="18" cy="8" r="2" fill="${isRank1 ? '#ffea00' : '#ffffff'}"/>
      </svg>
      <!-- Rank Badge Overlay -->
      <span style="
        position: absolute;
        top: -4px;
        right: -4px;
        background: ${rankColor};
        color: #020617;
        font-family: monospace;
        font-weight: 800;
        font-size: 8px;
        width: 13px;
        height: 13px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #ffffff;
        box-shadow: 0 0 4px rgba(0,0,0,0.6);
      ">#${rankNum}</span>
    </div>
  `;

  return L.divIcon({
    className: 'vessel-svg-icon-marker',
    html: svgHtml,
    iconSize: [size, size],
    iconAnchor: [half, half]
  });
};

// Live AIS Ship Icon Generator with Course Rotation & Pulsing Beacon
const createLiveVesselIcon = (courseDeg, vesselName) => {
  const rotation = (courseDeg || 0) - 90; // Rotate bow to course heading
  const size = 30;
  const half = size / 2;

  const svgHtml = `
    <div style="position:relative; width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center;">
      <div style="position:absolute; inset:-4px; border-radius:50%; background:rgba(16,185,129,0.3); animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${rotation}deg); filter: drop-shadow(0 0 8px #10b981);">
        <!-- Ship Hull -->
        <path d="M 18 2 L 28 14 L 26 31 C 26 33.5 10 33.5 10 31 L 8 14 Z" fill="#10b981" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
        <!-- Deck Superstructure -->
        <rect x="14" y="18" width="8" height="9" rx="1.5" fill="#ffffff" opacity="0.95"/>
        <!-- Bow Indicator -->
        <polygon points="18,4 22,10 14,10" fill="#ffffff"/>
        <!-- Navigation Beacon Light -->
        <circle cx="18" cy="8" r="2.2" fill="#34d399"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    className: 'live-vessel-svg-marker',
    html: svgHtml,
    iconSize: [size, size],
    iconAnchor: [half, half]
  });
};

// Organic ocean curve generator between simulation steps (meandering natural fluid streamlines)
const generateCurvedOilPath = (points) => {
  if (!points || points.length === 0) return [];
  if (points.length === 1) return points;

  const curved = [];
  for (let i = 0; i < points.length - 1; i++) {
    const pA = points[i];
    const pB = points[i + 1];

    const dLat = pB[0] - pA[0];
    const dLon = pB[1] - pA[1];
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);

    // Lateral normal vector for natural ocean current curvature (Coriolis & eddy meander)
    const normLat = dist > 0 ? -dLon / dist : 0;
    const normLon = dist > 0 ? dLat / dist : 0;
    const bendDirection = (i % 2 === 0 ? 1 : -1);
    const bendMag = dist * 0.08 * bendDirection;

    const numSub = 12;
    for (let t = 0; t <= numSub; t++) {
      if (i > 0 && t === 0) continue;
      const frac = t / numSub;
      const baseLat = pA[0] + frac * dLat;
      const baseLon = pA[1] + frac * dLon;
      const meander = Math.sin(frac * Math.PI) * bendMag;
      curved.push([baseLat + meander * normLat, baseLon + meander * normLon]);
    }
  }
  return curved;
};

export default function MapView({
  incident,
  allGeometries,
  geometry,
  originGeojson,
  forecastData,
  vessels,
  liveVessels,
  layerToggles,
  setLayerToggles,
  onSelectIncident,
  mapStyle,
  setMapStyle,
  timelineHour = 0,
  activeTab = 'map',
  focusedVesselMmsi,
  simulationMode = 'forward',
  backwardStepIdx = 0
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);

  // Panel Minimize State - minimized by default on mobile screens
  const [isPanelMinimized, setIsPanelMinimized] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768;
  });

  // GeoJSON Layer References
  const allSpillsLayerRef = useRef(null);
  const selectedSpillLayerRef = useRef(null);
  const originLayerRef = useRef(null);
  const ensembleParticlesGroupRef = useRef(null);
  const ensembleBoundaryGroupRef = useRef(null);
  const oilStreamlineGroupRef = useRef(null);
  const cfarMarkersGroupRef = useRef(null);
  const forecastLayerRef = useRef(null);
  const driftTimelineLayerRef = useRef(null);
  const vesselTracksLayerRef = useRef(null);
  const vesselMarkersGroupRef = useRef(null);
  const liveVesselMarkersGroupRef = useRef(null);
  const liveMarkersMapRef = useRef({});


  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
    });

    const map = L.map(mapContainerRef.current, {
      center: [14.0, 78.0],
      zoom: 5,
      minZoom: 3,
      maxZoom: 20,
      maxBounds: [[-85, -180], [85, 180]],
      maxBoundsViscosity: 1.0,
      worldCopyJump: true,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Define dedicated custom map panes with explicit z-indices to guarantee layer order.
    // This permanently eliminates any race conditions where layers added later cover earlier layers.
    map.createPane('allSpillsPane');
    map.getPane('allSpillsPane').style.zIndex = 405;

    map.createPane('selectedSpillPane');
    map.getPane('selectedSpillPane').style.zIndex = 410;

    map.createPane('originZonePane');
    map.getPane('originZonePane').style.zIndex = 415;

    map.createPane('oilStreamlinesPane');
    map.getPane('oilStreamlinesPane').style.zIndex = 416;

    map.createPane('ensembleParticlesPane');
    map.getPane('ensembleParticlesPane').style.zIndex = 418;

    map.createPane('forecastPane');
    map.getPane('forecastPane').style.zIndex = 420;

    map.createPane('driftTimelinePane');
    map.getPane('driftTimelinePane').style.zIndex = 425;

    map.createPane('vesselTracksPane');
    map.getPane('vesselTracksPane').style.zIndex = 430;

    map.createPane('cfarContactsPane');
    map.getPane('cfarContactsPane').style.zIndex = 433;

    map.createPane('vesselIntersectionsPane');
    map.getPane('vesselIntersectionsPane').style.zIndex = 435;

    const initialTile = L.tileLayer(BASEMAP_URLS[mapStyle] || BASEMAP_URLS.carto_voyager, {
      minZoom: 3,
      maxZoom: 20,
      maxNativeZoom: mapStyle === 'satellite' ? 17 : 19,
      subdomains: 'abcd',
      noWrap: true,
      bounds: [[-85, -180], [85, 180]],
      attribution: BASEMAP_ATTRIBUTIONS[mapStyle] || BASEMAP_ATTRIBUTIONS.carto_voyager
    }).addTo(map);

    tileLayerRef.current = initialTile;

    // Initialize Layer Groups with dedicated panes
    allSpillsLayerRef.current = L.geoJSON(null, {
      pane: 'allSpillsPane',
      style: {
        color: '#ea580c',
        weight: 2,
        fillColor: '#f97316',
        fillOpacity: 0.65
      },
      onEachFeature: (feature, layer) => {
        layer.on('click', () => {
          const incId = feature.properties?.incident_id;
          if (incId) {
            handleSpillClick(incId);
          }
        });
        if (feature.properties?.location_name) {
          layer.bindTooltip(`<b>${feature.properties.location_name}</b><br/>Area: ${feature.properties.spill_area_sqkm} sq km`, {
            sticky: true
          });
        }
      }
    }).addTo(map);

    selectedSpillLayerRef.current = L.geoJSON(null, {
      pane: 'selectedSpillPane',
      style: {
        color: '#38bdf8',
        weight: 4,
        fillColor: '#0284c7',
        fillOpacity: 0.85
      }
    }).addTo(map);

    originLayerRef.current = L.geoJSON(null, {
      pane: 'originZonePane',
      style: {
        color: '#eab308',
        weight: 2.5,
        dashArray: '6, 6',
        fillColor: '#facc15',
        fillOpacity: 0.35
      }
    }).addTo(map);

    ensembleParticlesGroupRef.current = L.layerGroup([], { pane: 'ensembleParticlesPane' }).addTo(map);
    ensembleBoundaryGroupRef.current = L.layerGroup([], { pane: 'originZonePane' }).addTo(map);
    oilStreamlineGroupRef.current = L.layerGroup([], { pane: 'oilStreamlinesPane' }).addTo(map);
    cfarMarkersGroupRef.current = L.layerGroup([], { pane: 'cfarContactsPane' }).addTo(map);

    forecastLayerRef.current = L.geoJSON(null, {
      pane: 'forecastPane',
      style: (feature) => {
        const hr = feature?.properties?.forecast_hour;
        let color = '#a855f7';
        if (hr === '+6h') color = '#38bdf8';
        else if (hr === '+12h') color = '#60a5fa';
        else if (hr === '+24h') color = '#818cf8';
        else if (hr === '+48h') color = '#a855f7';

        return {
          color: color,
          weight: 2,
          dashArray: '4, 4',
          fillColor: color,
          fillOpacity: 0.3
        };
      }
    }).addTo(map);

    driftTimelineLayerRef.current = L.layerGroup().addTo(map);
    vesselTracksLayerRef.current = L.layerGroup().addTo(map);
    vesselMarkersGroupRef.current = L.layerGroup().addTo(map);
    liveVesselMarkersGroupRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    // Fluid resize observer for mobile keyboard/orientation/tab switches
    let resizeObserver = null;
    if (window.ResizeObserver && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle User Click on Oil Spill Polygon
  const handleSpillClick = (incidentId) => {
    if (setMapStyle) setMapStyle('satellite');
    if (setLayerToggles) {
      setLayerToggles(prev => ({
        ...prev,
        liveVessels: false
      }));
    }
    if (onSelectIncident) {
      onSelectIncident(incidentId);
    }
  };

  // 2. Switch Basemap Layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const url = BASEMAP_URLS[mapStyle] || BASEMAP_URLS.carto_voyager;
    const attr = BASEMAP_ATTRIBUTIONS[mapStyle] || BASEMAP_ATTRIBUTIONS.carto_voyager;

    const newTile = L.tileLayer(url, {
      minZoom: 3,
      maxZoom: 20,
      maxNativeZoom: mapStyle === 'satellite' ? 17 : 19,
      subdomains: 'abcd',
      noWrap: true,
      bounds: [[-85, -180], [85, 180]],
      attribution: attr
    }).addTo(map);

    tileLayerRef.current = newTile;
  }, [mapStyle]);

  // Auto-resize Leaflet map canvas whenever activeTab or layout changes
  useEffect(() => {
    if (mapRef.current) {
      const timer = setTimeout(() => {
        if (mapRef.current) {
          try {
            mapRef.current.invalidateSize();
            if (incident?.centroid) {
              const [lat, lon] = incident.centroid;
              if (typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon)) {
                mapRef.current.setView([lat, lon], 11);
              }
            }
          } catch (e) {
            console.warn("Error invalidating map size on tab switch:", e);
          }
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // 3. Update All Oil Spills Layer
  useEffect(() => {
    if (!allSpillsLayerRef.current) return;
    allSpillsLayerRef.current.clearLayers();

    if (layerToggles.spill && allGeometries && allGeometries.features) {
      allSpillsLayerRef.current.addData(allGeometries);
    }
  }, [allGeometries, layerToggles.spill]);

  // 4. Update Selected Incident Highlight & Pan Map
  useEffect(() => {
    const map = mapRef.current;
    if (!selectedSpillLayerRef.current) return;
    selectedSpillLayerRef.current.clearLayers();

    if (geometry) {
      selectedSpillLayerRef.current.addData(geometry);
    }

    if (incident?.centroid && map) {
      const [lat, lon] = incident.centroid;
      if (typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon)) {
        // Safe check for mobile tab switching: if map container is hidden (display: none),
        // clientWidth / clientHeight will be 0. Calling flyTo in Leaflet with 0x0 size produces
        // NaN coordinates causing `Invalid LatLng object: (NaN, NaN)` exception.
        // Fall back gracefully to setView when container is hidden!
        const isContainerVisible = mapContainerRef.current &&
          mapContainerRef.current.offsetParent !== null &&
          mapContainerRef.current.clientWidth > 0 &&
          mapContainerRef.current.clientHeight > 0;

        if (isContainerVisible) {
          try {
            const size = map.getSize();
            if (size.x > 0 && size.y > 0) {
              map.flyTo([lat, lon], 11, { duration: 1.5 });
            } else {
              map.setView([lat, lon], 11);
            }
          } catch {
            map.setView([lat, lon], 11);
          }
        } else {
          try {
            map.setView([lat, lon], 11);
          } catch {
            // Ignored if map pane is detached
          }
        }
      }
    }
  }, [geometry, incident]);

  // 5. Fit Bounds on Origin Zone when loaded
  useEffect(() => {
    const map = mapRef.current;
    if (!originLayerRef.current) return;
    originLayerRef.current.clearLayers();

    if (layerToggles.origin && originGeojson) {
      if (map) {
        try {
          const props = originGeojson.properties || {};
          const c = props.probable_origin_centroid || [incident?.centroid?.[0], incident?.centroid?.[1]];
          const bounds = L.latLngBounds([incident?.centroid, c]);
          const isContainerVisible = mapContainerRef.current &&
            mapContainerRef.current.offsetParent !== null &&
            mapContainerRef.current.clientWidth > 0 &&
            mapContainerRef.current.clientHeight > 0;

          if (isContainerVisible) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12, animate: true, duration: 1.2 });
          }
        } catch (e) {
          console.warn("Could not fitBounds on origin zone:", e);
        }
      }
    }
  }, [originGeojson, layerToggles.origin, incident]);

  // 5b. Render 1,000-Particle Ensemble Particles, Curved Oil Streamline & Dynamic Error Boundary driven by bottom TimelineSlider
  useEffect(() => {
    if (!ensembleParticlesGroupRef.current || !ensembleBoundaryGroupRef.current) return;
    ensembleParticlesGroupRef.current.clearLayers();
    ensembleBoundaryGroupRef.current.clearLayers();
    if (oilStreamlineGroupRef.current) oilStreamlineGroupRef.current.clearLayers();

    const steps = originGeojson?.properties?.ensemble_steps;
    if (!layerToggles.origin || !steps || steps.length === 0 || simulationMode !== 'backward') return;

    const currentStep = steps[backwardStepIdx] || steps[0];

    // 1. Render organic curved oil drift line connecting observed spill to current drifting dots (not a straight line)
    if (backwardStepIdx > 0 && oilStreamlineGroupRef.current) {
      const pathCentroids = steps.slice(0, backwardStepIdx + 1).map(s => [s.centroid[0], s.centroid[1]]);
      const curvedPath = generateCurvedOilPath(pathCentroids);

      if (curvedPath.length > 1) {
        // Outer glowing translucent oil wake / sheen ribbon
        const sheenRibbon = L.polyline(curvedPath, {
          pane: 'oilStreamlinesPane',
          color: '#d97706',
          weight: 7,
          opacity: 0.38,
          lineCap: 'round',
          lineJoin: 'round'
        });
        oilStreamlineGroupRef.current.addLayer(sheenRibbon);

        // Core golden iridescent oil flow streamline
        const coreStream = L.polyline(curvedPath, {
          pane: 'oilStreamlinesPane',
          color: '#f59e0b',
          weight: 3.2,
          opacity: 0.95,
          dashArray: '10, 6',
          lineCap: 'round',
          lineJoin: 'round'
        });
        oilStreamlineGroupRef.current.addLayer(coreStream);

        // Connect trailing filaments/tendrils directly into the representative particle dots
        const headPt = curvedPath[curvedPath.length - 1];
        const stepParticles = currentStep.particles || [];
        if (stepParticles.length > 0) {
          const sampleIndices = [0, 45, 110, 190, 280, 390, 510, 640, 780, 890, 960];
          sampleIndices.forEach((idx, i) => {
            const p = stepParticles[idx % stepParticles.length];
            if (p) {
              const dotPt = [p[1], p[0]]; // [lat, lon]
              const midLat = (headPt[0] * 0.35 + dotPt[0] * 0.65) + (Math.sin(i * 1.6) * 0.0006);
              const midLon = (headPt[1] * 0.35 + dotPt[1] * 0.65) + (Math.cos(i * 1.6) * 0.0006);
              const tendril = L.polyline([headPt, [midLat, midLon], dotPt], {
                pane: 'oilStreamlinesPane',
                color: '#fbbf24',
                weight: 1.2,
                opacity: 0.65,
                dashArray: '3, 4'
              });
              oilStreamlineGroupRef.current.addLayer(tendril);
            }
          });
        }
      }
    }

    // 2. Render active step expanding honest error boundary with realistic proportional area
    if (currentStep.boundary) {
      const boundaryLayer = L.geoJSON(currentStep.boundary, {
        pane: 'originZonePane',
        style: {
          color: '#f59e0b',
          weight: 2.2,
          dashArray: '5, 5',
          fillColor: '#fbbf24',
          fillOpacity: 0.22 + (backwardStepIdx * 0.03)
        }
      }).bindTooltip(`
        <div style="font-family:sans-serif; color:#f8fafc; padding:3px;">
          <b style="color:#f59e0b;">ENSEMBLE ERROR BOUNDARY (${currentStep.label})</b><br/>
          Area: <b>${currentStep.area_sqkm} km²</b> (95% CI)<br/>
          Stochastic Monte Carlo Drifters: <b>${currentStep.particle_count_total || 1000}</b>
        </div>
      `, { sticky: true });
      ensembleBoundaryGroupRef.current.addLayer(boundaryLayer);
    }

    // 3. Render 1,000 golden dots representing the stochastic ensemble dispersion cloud
    if (currentStep.particles && currentStep.particles.length > 0) {
      const canvasRenderer = L.canvas({ pane: 'ensembleParticlesPane' });
      currentStep.particles.forEach((pt) => {
        const pMarker = L.circleMarker([pt[1], pt[0]], {
          renderer: canvasRenderer,
          radius: 2.2,
          color: '#f59e0b',
          weight: 0.8,
          fillColor: '#fbbf24',
          fillOpacity: 0.82
        });
        ensembleParticlesGroupRef.current.addLayer(pMarker);
      });
    }

    // 4. At the origin step (-24h, backwardStepIdx === 4), show subtle origin target marker with hover tooltip
    if (backwardStepIdx === steps.length - 1 && currentStep.centroid) {
      const originMarker = L.circleMarker([currentStep.centroid[0], currentStep.centroid[1]], {
        pane: 'originZonePane',
        radius: 8,
        color: '#ffffff',
        weight: 2.5,
        fillColor: '#eab308',
        fillOpacity: 0.95
      }).bindTooltip(`
        <div style="font-family:sans-serif; color:#f8fafc; padding:3px;">
          <b style="color:#eab308;">PROBABLE ORIGIN CENTROID (-24h)</b><br/>
          Estimated Area: <b>${currentStep.area_sqkm} km²</b><br/>
          1,000 Stochastic Monte Carlo Drifters
        </div>
      `, { direction: 'top' });
      ensembleBoundaryGroupRef.current.addLayer(originMarker);
    }
  }, [backwardStepIdx, simulationMode, originGeojson, layerToggles.origin]);


  // 6. Update Forward Forecast Envelopes Layer
  useEffect(() => {
    if (!forecastLayerRef.current) return;
    forecastLayerRef.current.clearLayers();

    if (layerToggles.forecast && forecastData) {
      const features = [];
      ['6h', '12h', '24h', '48h'].forEach(step => {
        if (layerToggles[`forecast_${step}`] !== false && forecastData[step]?.geojson) {
          features.push(forecastData[step].geojson);
        }
      });
      if (features.length > 0) {
        forecastLayerRef.current.addData({ type: 'FeatureCollection', features });
      }
    }
  }, [forecastData, layerToggles]);

  // 7. Update Drift Timeline Animation Layer (Physics-based Open Sea Trajectory)
  useEffect(() => {
    if (!driftTimelineLayerRef.current) return;
    driftTimelineLayerRef.current.clearLayers();

    if (geometry && timelineHour > 0) {
      // Drift math: surface currents push East-Southeast (offshore along shipping lane)
      // Never drift North onto land!
      const latOffset = -timelineHour * 0.0006; // Southward away from coast
      const lonOffset = timelineHour * 0.0035;  // Eastward along shipping lane
      const expansionFactor = 1.0 + (timelineHour * 0.008);

      const cLat = incident ? incident.centroid[0] : 0;
      const cLon = incident ? incident.centroid[1] : 0;

      const driftedCoords = geometry.geometry.coordinates[0].map(([lon, lat]) => {
        const newLon = cLon + (lon - cLon) * expansionFactor + lonOffset;
        const newLat = cLat + (lat - cLat) * expansionFactor + latOffset;
        return [newLon, newLat];
      });

      const driftedGeojson = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [driftedCoords]
        },
        properties: {
          title: `Drift Position (+${timelineHour}h)`
        }
      };

      const driftPolygonLayer = L.geoJSON(driftedGeojson, {
        pane: 'driftTimelinePane',
        style: {
          color: '#ec4899',
          weight: 3,
          dashArray: '4, 4',
          fillColor: '#f43f5e',
          fillOpacity: 0.55
        }
      });

      if (incident?.centroid) {
        const centerMarker = L.circleMarker([cLat + latOffset, cLon + lonOffset], {
          pane: 'driftTimelinePane',
          radius: 7,
          color: '#ffffff',
          weight: 2,
          fillColor: '#ec4899',
          fillOpacity: 0.95
        }).bindTooltip(`<b>Animated Drift Position (+${timelineHour}h)</b><br/>Open Ocean Shipping Corridor`, { permanent: true, direction: 'top' });

        driftTimelineLayerRef.current.addLayer(centerMarker);
      }

      driftTimelineLayerRef.current.addLayer(driftPolygonLayer);
    }
  }, [geometry, timelineHour, incident]);

  // 8. Render Animated Candidate Suspect Vessel Tracks & Dynamic Vessel Image Markers
  useEffect(() => {
    if (!vesselTracksLayerRef.current || !vesselMarkersGroupRef.current) return;
    vesselTracksLayerRef.current.clearLayers();
    vesselMarkersGroupRef.current.clearLayers();

    if (layerToggles.historicalVessels && vessels && vessels.length > 0) {
      vessels.forEach((v) => {
        if (v.waypoints && v.waypoints.length > 1) {
          const latLons = v.waypoints.map(wp => [wp.lat, wp.lon]);
          const isRank1 = v.suspect_rank === 1;
          const pinColor = isRank1 ? '#f97316' : (v.suspect_rank === 2 ? '#eab308' : '#38bdf8');

          // Bold, high-contrast and clearly visible maritime navigation tracks
          // Rendered on dedicated 'vesselTracksPane' (z-index 430) to always stay on top of oil spills (z-index 410)
          const glowLine = L.polyline(latLons, {
            pane: 'vesselTracksPane',
            color: pinColor,
            weight: isRank1 ? 6.5 : 4.5,
            opacity: 0.45
          });

          // 2. Bold bright core dashed line (Clearly visible on any dark satellite or street basemap)
          const trackLine = L.polyline(latLons, {
            pane: 'vesselTracksPane',
            color: '#ffffff',
            weight: isRank1 ? 2.8 : 2.0,
            dashArray: isRank1 ? '7, 5' : '5, 5',
            opacity: 0.95
          });

          vesselTracksLayerRef.current.addLayer(glowLine);
          vesselTracksLayerRef.current.addLayer(trackLine);

          // Calculate Interpolated Vessel Position along trajectory based on `timelineHour`
          // Position vessels realistically along their transit route (vessels have sailed past or are approaching)
          // NEVER freeze vessel #1 directly on top of the blue oil spill polygon!
          const totalWps = v.waypoints.length;
          const wpStart = v.waypoints[0];
          const wpOrigin = v.waypoints[2] || v.waypoints[1];
          const wpEnd = v.waypoints[totalWps - 1];

          // Natural transit staging: Rank 1 is ahead along its course (0.70), other vessels nearby in the corridor
          const staggerFractions = [0.70, 0.35, 0.62, 0.42, 0.78];
          const baseOffset = staggerFractions[(v.suspect_rank - 1) % staggerFractions.length];
          const timeProgressFrac = (timelineHour / 48.0) * (1.0 - baseOffset);
          const currentFrac = Math.min(0.98, Math.max(0.05, baseOffset + timeProgressFrac));

          const currentLat = wpStart.lat + (wpEnd.lat - wpStart.lat) * currentFrac;
          const currentLon = wpStart.lon + (wpEnd.lon - wpStart.lon) * currentFrac;

          // Compute instantaneous heading course angle along track
          const dLon = wpEnd.lon - wpStart.lon;
          const dLat = wpEnd.lat - wpStart.lat;
          const courseAngle = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;

          // Add Rank #1 Origin Slick Intersection Marker (sleek, compact)
          if (isRank1) {
            const minDist = v.metrics?.min_distance_km !== undefined ? `${v.metrics.min_distance_km.toFixed(2)} km` : 'Near Origin';
            const speedRed = v.metrics?.speed_drop_knots ? `${v.metrics.speed_drop_knots} kts` : 'None (Steady Speed)';
            const aisGap = v.metrics?.ais_gap_minutes ? `${v.metrics.ais_gap_minutes} mins` : 'None (Continuous AIS)';

            const dischargeMarker = L.circleMarker([wpOrigin.lat, wpOrigin.lon], {
              pane: 'vesselIntersectionsPane',
              radius: 9,
              color: '#f97316',
              weight: 2,
              dashArray: '3, 3',
              fillColor: '#ea580c',
              fillOpacity: 0.22
            }).bindTooltip(`
              <div style="font-family:sans-serif; padding:2px;">
                <b style="color:#f97316;">RANK #1 DISCHARGE INTERSECTION</b><br/>
                Slick Origin Proximity: <b>${minDist}</b><br/>
                Speed Reduction: <b>${speedRed}</b><br/>
                AIS Gap: <b>${aisGap}</b>
              </div>
            `, { permanent: false, direction: 'right' });

            vesselTracksLayerRef.current.addLayer(dischargeMarker);
          }

          // Render Real Vessel SVG Icon with direction heading
          const vesselIcon = createVesselSvgIcon(courseAngle, pinColor, isRank1, v.vessel_name, v.suspect_rank);

          const marker = L.marker([currentLat, currentLon], { icon: vesselIcon });
          marker.bindPopup(`
            <div style="font-family:sans-serif; color:#f8fafc; padding:4px;">
              <b style="color:${pinColor};">Priority #${v.suspect_rank}: ${v.vessel_name}</b><br/>
              <span style="font-size:11px; color:#cbd5e1;">Type: ${v.ship_type} | Flag: ${v.flag}</span><br/>
              <span style="font-size:11px; color:#cbd5e1;">Destination: <b>${v.destination || 'N/A'}</b></span><br/>
              <span style="font-size:11px; color:#cbd5e1;">Route: <b>${v.corridor || 'Regional Shipping Lane'}</b></span><br/>
              <span style="font-size:11px; color:#cbd5e1;">Course Heading: <b>${courseAngle.toFixed(0)}°</b></span><br/>
              <span style="font-size:11px; color:#38bdf8;">Interception Priority: <b>${((v.interception_priority || v.confidence_score) * 100).toFixed(1)}%</b></span>
              ${v.is_dark_vessel ? `<br/><span style="font-size:10px; color:#f87171; font-weight:bold;">[!] Dark Vessel: AIS Inactive (SAR Steel Hull Confirmed)</span>` : ''}
            </div>
          `);

          vesselMarkersGroupRef.current.addLayer(marker);

          // Senior Critique #3: Direct SAR Metallic Hard-Target Detection (CFAR)
          if ((v.is_dark_vessel || v.sar_metallic_contact?.cfar_detected) && cfarMarkersGroupRef.current) {
            const contact = v.sar_metallic_contact;
            const cCoord = contact?.contact_coord || [wpOrigin.lat, wpOrigin.lon];
            const rcs = contact?.rcs_dbm2 || 28.4;

            const cfarBlip = L.circleMarker([cCoord[0], cCoord[1]], {
              pane: 'cfarContactsPane',
              radius: 11,
              color: '#38bdf8',
              weight: 2,
              fillColor: '#0284c7',
              fillOpacity: 0.45
            }).bindTooltip(`
              <div style="font-family:sans-serif; padding:2px;">
                <b style="color:#38bdf8;">SAR METALLIC RADAR CONTACT (CFAR)</b><br/>
                Target: <b>${v.vessel_name}</b><br/>
                RCS Reflectivity: <b>+${rcs} dBm²</b> (Steel Hull)<br/>
                <span style="color:#f87171;">Transponder: AIS Inactive (Ghost Ship)</span><br/>
                Physical microwave reflection confirmed on SAR satellite scene.
              </div>
            `, { direction: 'top' });

            cfarMarkersGroupRef.current.addLayer(cfarBlip);
          }
        }
      });
    }
  }, [vessels, layerToggles.historicalVessels, timelineHour]);

  // Pan and smooth-zoom map viewport to focused vessel track
  useEffect(() => {
    if (!focusedVesselMmsi || !vessels || !mapRef.current) return;
    const vessel = vessels.find(v => v.mmsi === focusedVesselMmsi);
    if (vessel && vessel.waypoints && vessel.waypoints.length > 0) {
      const midIdx = Math.floor(vessel.waypoints.length / 2);
      const wp = vessel.waypoints[midIdx] || vessel.waypoints[0];
      try {
        mapRef.current.flyTo([wp.lat, wp.lon], 12, { animate: true, duration: 1.2 });
      } catch (err) {
        console.warn('flyTo error:', err);
      }
    }
  }, [focusedVesselMmsi, vessels]);

  // 9. Render Live AIS Vessels Layer (Smooth sliding position interpolation & course rotation)
  useEffect(() => {
    if (!liveVesselMarkersGroupRef.current) return;

    if (!layerToggles.liveVessels) {
      liveVesselMarkersGroupRef.current.clearLayers();
      liveMarkersMapRef.current = {};
      return;
    }

    if (liveVessels && liveVessels.length > 0) {
      const currentMmsis = new Set(liveVessels.map(v => v.mmsi));

      // Remove markers no longer present
      Object.keys(liveMarkersMapRef.current).forEach(mmsi => {
        if (!currentMmsis.has(mmsi)) {
          liveVesselMarkersGroupRef.current.removeLayer(liveMarkersMapRef.current[mmsi]);
          delete liveMarkersMapRef.current[mmsi];
        }
      });

      liveVessels.forEach((lv) => {
        const liveIcon = createLiveVesselIcon(lv.course, lv.vessel_name);
        const popupHtml = `
          <div style="font-family:sans-serif; color:#f8fafc; padding:4px;">
            <b style="color:#10b981;">LIVE AIS: ${lv.vessel_name}</b><br/>
            <span style="font-size:11px; color:#cbd5e1;">Type: <b>${lv.ship_type || 'Vessel'}</b></span><br/>
            <span style="font-size:11px; color:#cbd5e1;">MMSI: ${lv.mmsi}</span><br/>
            <span style="font-size:11px; color:#38bdf8;">Speed: <b>${lv.speed_knots} knots</b> | Course: <b>${lv.course}°</b></span><br/>
            <span style="font-size:10px; color:#94a3b8;">Live Position: [${lv.lat.toFixed(4)}°, ${lv.lon.toFixed(4)}°]</span>
          </div>
        `;

        if (liveMarkersMapRef.current[lv.mmsi]) {
          // Smoothly slide existing marker to new LatLng coordinate
          const marker = liveMarkersMapRef.current[lv.mmsi];
          marker.setLatLng([lv.lat, lv.lon]);
          marker.setIcon(liveIcon);
          if (marker.getPopup()) {
            marker.getPopup().setContent(popupHtml);
          }
        } else {
          // Create new live vessel SVG marker
          const liveMarker = L.marker([lv.lat, lv.lon], { icon: liveIcon });
          liveMarker.bindPopup(popupHtml);
          liveVesselMarkersGroupRef.current.addLayer(liveMarker);
          liveMarkersMapRef.current[lv.mmsi] = liveMarker;
        }
      });
    }
  }, [liveVessels, layerToggles.liveVessels]);

  return (
    <div className="relative w-full h-full min-h-[360px] sm:min-h-[450px] rounded-xl sm:rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Leaflet Map DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[360px] sm:min-h-[450px] z-10" />

      {/* Carto / Satellite Basemap Switcher (Compact on mobile) */}
      <div className="absolute top-2.5 left-2.5 sm:top-4 sm:left-4 z-[400] glass-panel p-1 sm:p-1.5 rounded-lg sm:rounded-xl border border-slate-800/90 flex items-center gap-0.5 sm:gap-1 shadow-xl max-w-[calc(100vw-110px)] sm:max-w-none overflow-x-auto">
        <button
          onClick={() => setMapStyle('carto_voyager')}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${mapStyle === 'carto_voyager'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
        >
          <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span><span className="hidden sm:inline">Carto </span>Voyager</span>
        </button>

        <button
          onClick={() => setMapStyle('carto_dark')}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${mapStyle === 'carto_dark'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
        >
          <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span><span className="hidden sm:inline">Carto </span>Dark<span className="hidden sm:inline"> Matter</span></span>
        </button>

        <button
          onClick={() => setMapStyle('satellite')}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${mapStyle === 'satellite'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
        >
          <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300" />
          <span>Satellite<span className="hidden sm:inline"> Imagery</span></span>
        </button>
      </div>

      {/* Floating Layer Control Panel with Minimize/Expand Toggle */}
      <div className={`absolute top-2.5 right-2.5 sm:top-4 sm:right-4 z-[400] glass-panel rounded-xl border border-slate-800/90 shadow-2xl transition-all duration-300 ${isPanelMinimized ? 'p-1.5 sm:p-2 w-auto' : 'p-3 sm:p-4 w-60 sm:w-64 max-w-[calc(100vw-1.5rem)]'
        } text-xs font-sans`}>
        {/* Header Bar */}
        <div className={`flex items-center justify-between font-semibold text-slate-200 uppercase tracking-wider ${isPanelMinimized ? '' : 'border-b border-slate-800 pb-2 mb-2.5 sm:mb-3'
          }`}>
          <button
            type="button"
            className="flex items-center gap-1.5 cursor-pointer focus:outline-none"
            onClick={() => setIsPanelMinimized(!isPanelMinimized)}
          >
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
            <span className="text-[11px] sm:text-xs">{isPanelMinimized ? 'Layers' : 'GIS Layers'}</span>
            {!isPanelMinimized && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping ml-1" />}
          </button>

          <button
            type="button"
            onClick={() => setIsPanelMinimized(!isPanelMinimized)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ml-1"
            title={isPanelMinimized ? "Expand Layers Panel" : "Minimize Layers Panel"}
          >
            {isPanelMinimized ? <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" /> : <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>
        </div>

        {/* Expandable Layer Controls */}
        {!isPanelMinimized && (
          <div className="space-y-2 sm:space-y-2.5 max-h-[50vh] sm:max-h-none overflow-y-auto pr-1">
            <label className="flex items-center justify-between cursor-pointer hover:text-white transition-colors text-[11px] sm:text-xs">
              <span className="flex items-center gap-1.5 sm:gap-2">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-orange-500 shadow-sm shadow-orange-500/50 shrink-0" />
                <span>Ocean Spills (60+)</span>
              </span>
              <input
                type="checkbox"
                checked={layerToggles.spill}
                onChange={(e) => setLayerToggles({ ...layerToggles, spill: e.target.checked })}
                className="accent-cyan-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-white transition-colors text-[11px] sm:text-xs">
              <span className="flex items-center gap-1.5 sm:gap-2">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-yellow-400 shadow-sm shadow-yellow-400/50 shrink-0" />
                <span>Probable Origin (-24h)</span>
              </span>
              <input
                type="checkbox"
                checked={layerToggles.origin}
                onChange={(e) => setLayerToggles({ ...layerToggles, origin: e.target.checked })}
                className="accent-cyan-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-white transition-colors text-[11px] sm:text-xs">
              <span className="flex items-center gap-1.5 sm:gap-2">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-orange-400 shadow-sm shadow-orange-400/50 shrink-0" />
                <span>Suspect Track Lines</span>
              </span>
              <input
                type="checkbox"
                checked={layerToggles.historicalVessels}
                onChange={(e) => setLayerToggles({ ...layerToggles, historicalVessels: e.target.checked })}
                className="accent-cyan-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-white transition-colors text-[11px] sm:text-xs">
              <span className="flex items-center gap-1.5 sm:gap-2">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-emerald-400 shadow-sm shadow-emerald-400/50 shrink-0" />
                <span>Live AIS ({liveVessels ? liveVessels.length : 0})</span>
              </span>
              <input
                type="checkbox"
                checked={layerToggles.liveVessels}
                onChange={(e) => setLayerToggles({ ...layerToggles, liveVessels: e.target.checked })}
                className="accent-cyan-500 rounded"
              />
            </label>

            <div className="pt-2 border-t border-slate-800">
              <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mb-1">Forecast Envelopes</div>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {['6h', '12h', '24h', '48h'].map(step => (
                  <label key={step} className="flex items-center gap-1.5 cursor-pointer text-slate-300 text-[11px]">
                    <input
                      type="checkbox"
                      checked={layerToggles[`forecast_${step}`] !== false}
                      onChange={(e) => setLayerToggles({ ...layerToggles, [`forecast_${step}`]: e.target.checked })}
                      className="accent-purple-500 rounded"
                    />
                    <span>+{step}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>


    </div>
  );
}
