import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MapView from './components/MapView';
import TimelineSlider from './components/TimelineSlider';
import IncidentDetails from './components/IncidentDetails';
import VesselRanking from './components/VesselRanking';
import ForecastPanel from './components/ForecastPanel';
import UploadModal from './components/UploadModal';
import ErrorBoundary from './components/ErrorBoundary';
import { getClientId } from './utils/clientId';

export default function App() {
  const [activeTab, setActiveTab] = useState('map');
  const [allIncidents, setAllIncidents] = useState([]);
  const [allGeometries, setAllGeometries] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);

  const [geometry, setGeometry] = useState(null);
  const [originGeojson, setOriginGeojson] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [vessels, setVessels] = useState([]);
  const [liveVessels, setLiveVessels] = useState([]);
  const [liveStatus, setLiveStatus] = useState({ connected: false, vessel_count: 0 });

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isForwardLoading, setIsForwardLoading] = useState(false);
  const [isOriginLoading, setIsOriginLoading] = useState(false);

  // Map & Timeline States
  const [mapStyle, setMapStyle] = useState('carto_voyager');
  const [simulationMode, setSimulationMode] = useState('forward'); // 'forward' | 'backward'
  const [timelineHour, setTimelineHour] = useState(0);
  const [backwardStepIdx, setBackwardStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const [layerToggles, setLayerToggles] = useState({
    spill: true,
    origin: false,
    historicalVessels: true,
    liveVessels: true,
    forecast: false,
    forecast_6h: true,
    forecast_12h: true,
    forecast_24h: true,
    forecast_48h: true
  });

  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

  // Load baseline incidents and device-isolated user uploads on startup
  useEffect(() => {
    const cid = getClientId();
    fetch(`${API_BASE}/incidents?client_id=${encodeURIComponent(cid)}`)
      .then(res => res.json())
      .then(data => {
        setAllIncidents(data);
        if (data && data.length > 0) {
          selectIncident(data[0].incident_id);
        }
      })
      .catch(console.error);

    fetch(`${API_BASE}/incidents/all-geometry?client_id=${encodeURIComponent(cid)}`)
      .then(res => res.json())
      .then(setAllGeometries)
      .catch(console.error);
  }, []);

  // Poll Live AISstream vessels gracefully (every 12s, with backoff on errors to prevent 429 Too Many Requests)
  useEffect(() => {
    let timerId = null;
    let isMounted = true;
    let delay = 10000;

    const fetchLive = async () => {
      try {
        const res = await fetch(`${API_BASE}/vessels/live`);
        if (!res.ok) {
          // If server returns 429 (Rate Limit) or 503 (Cold start / waking up), back off to 30s
          delay = res.status === 429 ? 30000 : 20000;
          if (isMounted) {
            setLiveStatus({ connected: false });
          }
        } else {
          const data = await res.json();
          if (isMounted) {
            setLiveVessels(data.vessels || []);
            setLiveStatus(data.status || { connected: false });
            delay = 12000; // restore normal 12s interval on success
          }
        }
      } catch {
        if (isMounted) {
          setLiveStatus({ connected: false });
          delay = 25000; // back off when offline / sleeping
        }
      } finally {
        if (isMounted) {
          timerId = setTimeout(fetchLive, delay);
        }
      }
    };

    fetchLive();
    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  // Function to select an incident
  const selectIncident = (incidentId) => {
    setMapStyle('satellite');
    setLayerToggles(prev => ({
      ...prev,
      liveVessels: false,
      origin: false,
      forecast: false
    }));
    setOriginGeojson(null);
    setForecastData(null);
    setSimulationMode('forward');
    setTimelineHour(0);
    setBackwardStepIdx(0);
    setIsPlaying(false);

    fetch(`${API_BASE}/incidents/${incidentId}`)
      .then(res => res.json())
      .then(setSelectedIncident)
      .catch(console.error);

    fetch(`${API_BASE}/incidents/${incidentId}/geometry`)
      .then(r => r.json())
      .then(setGeometry)
      .catch(console.error);

    fetch(`${API_BASE}/incidents/${incidentId}/vessels`)
      .then(r => r.json())
      .then(d => setVessels(d.candidate_vessels || []))
      .catch(console.error);
  };

  // Run Forward Drift Forecast on demand
  const handleRunForwardDrift = () => {
    if (!selectedIncident) return;
    setIsForwardLoading(true);
    setSimulationMode('forward');

    fetch(`${API_BASE}/incidents/${selectedIncident.incident_id}/forecast`)
      .then(r => r.json())
      .then(data => {
        setForecastData(data);
        setIsForwardLoading(false);
        setLayerToggles(prev => ({ ...prev, forecast: true, forecast_6h: true, forecast_12h: true, forecast_24h: true, forecast_48h: true }));
        setTimelineHour(0);
        setIsPlaying(true);
      })
      .catch(() => setIsForwardLoading(false));
  };

  // Run Backward Origin Tracing on demand
  const handleRunBackwardOrigin = () => {
    if (!selectedIncident) return;
    setIsOriginLoading(true);
    setSimulationMode('backward');

    fetch(`${API_BASE}/incidents/${selectedIncident.incident_id}/origin`)
      .then(r => r.json())
      .then(data => {
        setOriginGeojson(data);
        setIsOriginLoading(false);
        setLayerToggles(prev => ({ ...prev, origin: true }));
        setBackwardStepIdx(0);
        setIsPlaying(true);
      })
      .catch(() => setIsOriginLoading(false));
  };

  // Refresh live environmental telemetry from Open-Meteo
  const handleRefreshTelemetry = async () => {
    if (!selectedIncident) return;
    try {
      const res = await fetch(`${API_BASE}/incidents/${selectedIncident.incident_id}/telemetry`);
      if (res.ok) {
        const freshForcing = await res.json();
        setSelectedIncident(prev => prev ? ({ ...prev, forcing: freshForcing }) : prev);
      }
    } catch (err) {
      console.warn('Telemetry refresh error:', err);
    }
  };

  // Handle successful SAR upload (device-isolated)
  const handleUploadSuccess = (uploadData) => {
    if (uploadData && uploadData.incident) {
      const newInc = uploadData.incident;
      setAllIncidents(prev => [newInc, ...prev.filter(i => i.incident_id !== newInc.incident_id)]);

      const cid = getClientId();
      fetch(`${API_BASE}/incidents/all-geometry?client_id=${encodeURIComponent(cid)}`)
        .then(res => res.json())
        .then(setAllGeometries)
        .catch(console.error);

      selectIncident(newInc.incident_id);
    }
  };

  // Delete user-uploaded incident from backend & local state
  const handleDeleteIncident = async (incidentId) => {
    if (!window.confirm(`Are you sure you want to delete uploaded incident "${incidentId}"? This will remove its detection data, simulation masks, and maps.`)) {
      return;
    }
    try {
      const cid = getClientId();
      const res = await fetch(`${API_BASE}/incidents/${encodeURIComponent(incidentId)}?client_id=${encodeURIComponent(cid)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to delete incident.');
      }

      setAllIncidents(prev => {
        const remaining = prev.filter(inc => inc.incident_id !== incidentId);
        if (selectedIncident?.incident_id === incidentId && remaining.length > 0) {
          selectIncident(remaining[0].incident_id);
        }
        return remaining;
      });

      setAllGeometries(prev => {
        if (!prev || !prev.features) return prev;
        return {
          ...prev,
          features: prev.features.filter(f => f.properties?.incident_id !== incidentId && f.id !== incidentId)
        };
      });
    } catch (err) {
      console.error('Error deleting incident:', err);
      alert(`Could not delete incident: ${err.message}`);
    }
  };

  // Invalidate map size whenever activeTab changes (width shifts between 8 and 6-7 cols)
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 150);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const [focusedVesselMmsi, setFocusedVesselMmsi] = useState(null);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <Navbar liveStatus={liveStatus} activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-[1920px] mx-auto w-full h-[calc(100vh-53px)] lg:h-[calc(100vh-65px)] overflow-hidden lg:p-4 lg:grid lg:grid-cols-12 lg:gap-4 pb-14 lg:pb-0">
        {/* Left Side GIS Map (Desktop: 8 cols in 'map' tab, 6-7 cols in 'vessels' tab; Mobile: full screen when activeTab === 'map') */}
        <div
          className={`h-full flex-col gap-2 sm:gap-3 overflow-hidden transition-all duration-300 ${
            activeTab === 'map' ? 'flex' : 'hidden lg:flex'
          } ${
            activeTab === 'vessels' ? 'lg:col-span-6 xl:col-span-7' : 'lg:col-span-8'
          } p-2 sm:p-3 lg:p-0`}
        >
          <div className="flex-1 relative min-h-0">
            <ErrorBoundary>
              <MapView
                incident={selectedIncident}
                allGeometries={allGeometries}
                geometry={geometry}
                originGeojson={originGeojson}
                forecastData={forecastData}
                vessels={vessels}
                liveVessels={liveVessels}
                layerToggles={layerToggles}
                setLayerToggles={setLayerToggles}
                onSelectIncident={selectIncident}
                mapStyle={mapStyle}
                setMapStyle={setMapStyle}
                timelineHour={timelineHour}
                activeTab={activeTab}
                focusedVesselMmsi={focusedVesselMmsi}
                simulationMode={simulationMode}
                backwardStepIdx={backwardStepIdx}
              />
            </ErrorBoundary>
          </div>

          {/* Interactive Timeline Animation Slider (Unified Forward / Backward Controller) */}
          <div className="shrink-0">
            <TimelineSlider
              simulationMode={simulationMode}
              setSimulationMode={setSimulationMode}
              timelineHour={timelineHour}
              setTimelineHour={setTimelineHour}
              backwardStepIdx={backwardStepIdx}
              setBackwardStepIdx={setBackwardStepIdx}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              playbackSpeed={playbackSpeed}
              setPlaybackSpeed={setPlaybackSpeed}
              forecastData={forecastData}
              originGeojson={originGeojson}
              selectedIncident={selectedIncident}
              onRunForwardDrift={handleRunForwardDrift}
              onRunBackwardOrigin={handleRunBackwardOrigin}
            />
          </div>
        </div>

        {/* Mobile View: Dedicated Spill Info Tab */}
        <div
          className={`h-full flex-col gap-4 overflow-y-auto p-3 sm:p-4 touch-scroll pb-16 ${
            activeTab === 'incident' ? 'flex lg:hidden' : 'hidden'
          }`}
        >
          <IncidentDetails
            incident={selectedIncident}
            allIncidents={allIncidents}
            onSelectIncident={selectIncident}
            onRunForwardDrift={handleRunForwardDrift}
            onRunBackwardOrigin={handleRunBackwardOrigin}
            onOpenUploadModal={() => setIsUploadOpen(true)}
            onDeleteIncident={handleDeleteIncident}
            isForwardLoading={isForwardLoading}
            isOriginLoading={isOriginLoading}
          />
        </div>

        {/* Mobile View: Dedicated Forecast Tab */}
        <div
          className={`h-full flex-col gap-4 overflow-y-auto p-3 sm:p-4 touch-scroll pb-16 ${
            activeTab === 'forecast' ? 'flex lg:hidden' : 'hidden'
          }`}
        >
          <ForecastPanel
            incident={selectedIncident}
            forecastData={forecastData}
            originGeojson={originGeojson}
            onRefreshTelemetry={handleRefreshTelemetry}
          />
        </div>

        {/* Desktop Right Column (when activeTab !== 'vessels') */}
        <div
          className={`${
            activeTab !== 'vessels' ? 'hidden lg:flex lg:col-span-4' : 'hidden'
          } flex-col gap-4 overflow-y-auto h-full pr-1.5 pb-6`}
        >
          <IncidentDetails
            incident={selectedIncident}
            allIncidents={allIncidents}
            onSelectIncident={selectIncident}
            onRunForwardDrift={handleRunForwardDrift}
            onRunBackwardOrigin={handleRunBackwardOrigin}
            onOpenUploadModal={() => setIsUploadOpen(true)}
            onDeleteIncident={handleDeleteIncident}
            isForwardLoading={isForwardLoading}
            isOriginLoading={isOriginLoading}
          />
          <ForecastPanel
            incident={selectedIncident}
            forecastData={forecastData}
            originGeojson={originGeojson}
            onRefreshTelemetry={handleRefreshTelemetry}
          />
          <VesselRanking
            vessels={vessels}
            incident={selectedIncident}
            allIncidents={allIncidents}
            onSelectIncident={selectIncident}
            isDedicatedTab={false}
            focusedVesselMmsi={focusedVesselMmsi}
            setFocusedVesselMmsi={setFocusedVesselMmsi}
            onDeleteIncident={handleDeleteIncident}
          />
        </div>

        {/* Vessels View: Full Vessel Ranking (Desktop 6/5 cols in 'vessels' tab, Mobile full screen in 'vessels' tab) */}
        <div
          className={`h-full flex-col gap-4 overflow-y-auto p-3 sm:p-4 lg:p-0 lg:pr-1.5 lg:pb-6 touch-scroll pb-16 ${
            activeTab === 'vessels' ? 'flex lg:col-span-6 xl:col-span-5' : 'hidden'
          }`}
        >
          <VesselRanking
            vessels={vessels}
            incident={selectedIncident}
            allIncidents={allIncidents}
            onSelectIncident={selectIncident}
            onRunBackwardOrigin={handleRunBackwardOrigin}
            isOriginLoading={isOriginLoading}
            isDedicatedTab={true}
            focusedVesselMmsi={focusedVesselMmsi}
            setFocusedVesselMmsi={setFocusedVesselMmsi}
            onDeleteIncident={handleDeleteIncident}
          />
        </div>
      </main>

      {/* Upload SAR Image Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}
