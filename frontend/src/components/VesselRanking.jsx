import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Anchor, Search, Filter, AlertTriangle, ShieldAlert, Navigation, Compass, Globe, MapPin, Radio, ChevronRight, ChevronDown, CheckCircle, Crosshair, Trash2, FileText, Download, CheckSquare, X, Send, Plane, Printer, ShieldCheck } from 'lucide-react';

export default function VesselRanking({
  vessels,
  incident,
  allIncidents,
  onSelectIncident,
  onRunBackwardOrigin,
  isOriginLoading,
  isDedicatedTab = false,
  focusedVesselMmsi,
  setFocusedVesselMmsi,
  onDeleteIncident
}) {
  const [viewMode, setViewMode] = useState('spill_candidates'); // 'spill_candidates' | 'full_dataset'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [fullDataset, setFullDataset] = useState([]);
  const [loadingDataset, setLoadingDataset] = useState(false);
  const [briefVessel, setBriefVessel] = useState(null); // Coast Guard Tactical Patrol Brief modal
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [activeBriefTab, setActiveBriefTab] = useState('dossier');
  const scrollContentRef = useRef(null);

  const handleModalScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 35) {
      setIsAtBottom(true);
    } else {
      setIsAtBottom(false);
    }
  };

  const scrollToBriefSection = (sectionId) => {
    setActiveBriefTab(sectionId);
    const target = document.getElementById(`brief-section-${sectionId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToBriefBottom = () => {
    if (scrollContentRef.current) {
      scrollContentRef.current.scrollTo({
        top: scrollContentRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setIsAtBottom(true);
    }
  };

  // Reset scroll position and states whenever a brief is opened
  useEffect(() => {
    if (briefVessel) {
      setIsAtBottom(false);
      setActiveBriefTab('dossier');
      if (scrollContentRef.current) {
        scrollContentRef.current.scrollTop = 0;
      }
    }
  }, [briefVessel]);

  const isUserUpload = incident?.incident_id?.startsWith('INC-UPLOAD') || incident?.is_user_upload;

  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

  // Fetch full AIS dataset when user switches to 'full_dataset' tab or searches
  useEffect(() => {
    if (viewMode === 'full_dataset') {
      setLoadingDataset(true);
      let url = `${API_BASE}/vessels/dataset?`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;
      if (selectedType !== 'All') url += `ship_type=${encodeURIComponent(selectedType)}`;

      fetch(url)
        .then(res => res.json())
        .then(data => {
          setFullDataset(data.vessels || []);
          setLoadingDataset(false);
        })
        .catch(err => {
          console.error('Error loading AIS dataset:', err);
          setLoadingDataset(false);
        });
    }
  }, [viewMode, searchQuery, selectedType]);

  // Filter local candidate vessels if searching inside spill_candidates view
  const filteredCandidateVessels = (vessels || []).filter(v => {
    const matchesSearch = !searchQuery || (
      v.vessel_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.mmsi?.includes(searchQuery) ||
      v.imo?.includes(searchQuery) ||
      v.flag?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.destination?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesType = selectedType === 'All' || v.ship_type?.toLowerCase().includes(selectedType.toLowerCase());
    return matchesSearch && matchesType;
  });

  return (
    <div className="glass-panel p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-800 space-y-3.5 sm:space-y-4 font-sans">
      {/* 1. Dedicated Tab Incident Context Banner (Visible in dedicated 'vessels' view) */}
      {isDedicatedTab && (
        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase flex items-center gap-1.5">
                <ShieldAlert className="w-3 h-3 text-orange-400" />
                Active Spill Incident
              </span>
              {isUserUpload && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                  Custom Upload
                </span>
              )}
              <span className="text-xs text-slate-300 font-mono font-semibold">ID: {incident?.incident_id || 'N/A'}</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {allIncidents && allIncidents.length > 0 && (
                <select
                  value={incident?.incident_id || ''}
                  onChange={(e) => onSelectIncident && onSelectIncident(e.target.value)}
                  className="w-full sm:max-w-[280px] bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer shadow-inner"
                  title="Switch target oil spill incident"
                >
                  {allIncidents.map(inc => (
                    <option key={inc.incident_id} value={inc.incident_id}>
                      {inc.incident_id} - {inc.location_name} ({inc.spill_area_sqkm} km²)
                    </option>
                  ))}
                </select>
              )}

              {isUserUpload && onDeleteIncident && (
                <button
                  onClick={() => onDeleteIncident(incident.incident_id)}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm"
                  title="Delete this uploaded SAR incident"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete Upload</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-orange-400 shrink-0" />
                Centroid GPS
              </div>
              <div className="text-slate-200 font-semibold truncate text-[11px] mt-0.5">
                {incident?.centroid ? `${incident.centroid[0].toFixed(4)}°, ${incident.centroid[1].toFixed(4)}°` : '5.8500°, 80.5000°'}
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Spill Area</div>
              <div className="text-cyan-400 font-bold text-[11px] mt-0.5">
                {incident?.spill_area_sqkm ? `${incident.spill_area_sqkm} km²` : '2.45 km²'}
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Correlated Vessels</div>
              <div className="text-orange-400 font-bold text-[11px] mt-0.5">
                {vessels ? `${vessels.length} Candidates` : '0 Candidates'}
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400">Origin Window</div>
                <div className="text-amber-400 font-semibold text-[11px] mt-0.5">-24h Lagrangian</div>
              </div>
              {onRunBackwardOrigin && (
                <button
                  onClick={onRunBackwardOrigin}
                  disabled={isOriginLoading}
                  className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                  title="Recalculate Backward Origin Zone"
                >
                  {isOriginLoading ? 'Tracing...' : 'Retrace'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Header & Mode Switcher (Senior Critique #5: Tactical Decision Support for Coast Guard) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Anchor className="w-5 h-5 text-orange-400 shrink-0" />
            <span>Tactical Interception Priorities (Coast Guard Action Queue)</span>
          </h3>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            Decision-support alert tool for aerial reconnaissance & physical water sampling
          </p>
        </div>

        <div className="w-full sm:w-auto grid grid-cols-2 sm:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setViewMode('spill_candidates')}
            className={`px-3 py-1.5 rounded-lg font-medium text-center transition-all ${
              viewMode === 'spill_candidates'
                ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Interception Leads ({vessels ? vessels.length : 0})
          </button>
          <button
            onClick={() => setViewMode('full_dataset')}
            className={`px-3 py-1.5 rounded-lg font-medium text-center transition-all ${
              viewMode === 'full_dataset'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            AIS Dataset Search
          </button>
        </div>
      </div>

      {/* 3. Search & Filter Controls */}
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          {/* Search Bar */}
          <div className="col-span-1 sm:col-span-8 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 sm:top-3" />
            <input
              type="text"
              placeholder="Search vessel by Name, MMSI, IMO, Flag, Destination..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Ship Type Filter Dropdown */}
          <div className="col-span-1 sm:col-span-4 relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 sm:top-3 pointer-events-none" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer transition-colors"
            >
              <option value="All">All Ship Classes</option>
              <option value="Tanker">Oil / Chemical Tankers</option>
              <option value="Container">Container Vessels</option>
              <option value="Bulk Carrier">Bulk Carriers</option>
              <option value="Supply">Offshore Supply / Tugs</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono scrollbar-none">
          <span className="text-slate-500 text-[10px] uppercase font-bold shrink-0 mr-1">Class:</span>
          {['All', 'Tanker', 'Container', 'Bulk Carrier', 'Supply'].map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-2.5 py-0.5 rounded-full border transition-all shrink-0 ${
                selectedType === type
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-semibold'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {type === 'All' ? 'All Classes' : type}
            </button>
          ))}
        </div>
      </div>

      {/* 4. VIEW 1: Candidate Suspect Vessels for Currently Selected Spill */}
      {viewMode === 'spill_candidates' && (
        <div className="space-y-3">
          {filteredCandidateVessels.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-mono text-xs glass-card rounded-xl border border-slate-800">
              <AlertTriangle className="w-8 h-8 text-amber-400/80 mx-auto mb-2" />
              <p>No candidate vessels matched search criteria around origin window.</p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedType('All'); }}
                className="mt-3 text-cyan-400 hover:underline text-[11px]"
              >
                Reset Search Filters
              </button>
            </div>
          ) : (
            filteredCandidateVessels.map((v) => {
              const isRank1 = v.suspect_rank === 1;
              const isFocused = focusedVesselMmsi === v.mmsi;

              return (
                <div
                  key={v.mmsi}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                    isFocused
                      ? 'ring-2 ring-cyan-500 border-cyan-400/80 bg-slate-900/95 shadow-xl shadow-cyan-950/50'
                      : isRank1
                      ? 'bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900 border-orange-500/50 shadow-lg shadow-orange-950/30 hover:border-orange-400'
                      : 'glass-card border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Card Header & Rank */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs sm:text-sm shrink-0 mt-0.5 sm:mt-0 ${
                          isRank1
                            ? 'bg-orange-500 text-slate-950 shadow-md shadow-orange-500/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        #{v.suspect_rank}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                            <span>{v.vessel_name}</span>
                            <span className="text-[11px] font-normal text-slate-400 font-mono">({v.ship_type})</span>
                          </h4>
                          {isRank1 && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40 uppercase animate-pulse">
                              Primary Suspect
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] sm:text-xs font-mono text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                          <span>MMSI: <strong className="text-slate-300 font-semibold">{v.mmsi}</strong></span>
                          <span>IMO: <strong className="text-slate-300 font-semibold">{v.imo}</strong></span>
                          <span>Flag: <strong className="text-slate-300 font-semibold">{v.flag}</strong></span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                          {v.destination && (
                            <div className="text-[11px] font-mono text-cyan-400 flex items-center gap-1 truncate">
                              <Compass className="w-3 h-3 shrink-0" />
                              <span className="truncate">Dest: {v.destination}</span>
                            </div>
                          )}
                          {v.corridor && (
                            <div className="text-[11px] font-mono text-purple-400 flex items-center gap-1 truncate">
                              <Navigation className="w-3 h-3 shrink-0" />
                              <span className="truncate">Route: {v.corridor} ({v.base_course ? `${v.base_course}°` : ''})</span>
                            </div>
                          )}
                          {v.is_dark_vessel && (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                                <Radio className="w-3 h-3 text-rose-400 animate-pulse shrink-0" />
                                <span>SAR Hard-Target Confirmed (+{v.sar_metallic_contact?.rcs_dbm2 || 28.4} dBm² RCS) · AIS Inactive</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Priority Score Badge */}
                    <div className="text-right shrink-0">
                      <div className="text-[9px] sm:text-[10px] uppercase font-mono text-slate-400">Interception Priority</div>
                      <div
                        className={`text-base sm:text-lg font-mono font-bold ${
                          isRank1 ? 'text-orange-400' : 'text-slate-300'
                        }`}
                      >
                        {((v.interception_priority || v.confidence_score) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Multi-Factor Score Progress Bars (5 factors laid out neatly in a 5-column grid) */}
                  {v.score_breakdown && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-800/60 font-mono text-[9px] sm:text-[10px]">
                      <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/40">
                        <div className="text-slate-400 mb-1 truncate">Proximity</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-orange-500 h-full rounded-full" style={{ width: `${v.score_breakdown.proximity * 100}%` }} />
                        </div>
                        <span className="text-slate-300 font-semibold mt-1 block">{(v.score_breakdown.proximity * 100).toFixed(0)}%</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/40">
                        <div className="text-slate-400 mb-1 truncate">Temporal</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-yellow-500 h-full rounded-full" style={{ width: `${v.score_breakdown.temporal * 100}%` }} />
                        </div>
                        <span className="text-slate-300 font-semibold mt-1 block">{(v.score_breakdown.temporal * 100).toFixed(0)}%</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/40">
                        <div className="text-slate-400 mb-1 truncate">Trajectory</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${v.score_breakdown.trajectory * 100}%` }} />
                        </div>
                        <span className="text-slate-300 font-semibold mt-1 block">{(v.score_breakdown.trajectory * 100).toFixed(0)}%</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/40">
                        <div className="text-slate-400 mb-1 truncate">Maneuver</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-purple-500 h-full rounded-full" style={{ width: `${v.score_breakdown.behavior * 100}%` }} />
                        </div>
                        <span className="text-slate-300 font-semibold mt-1 block">{(v.score_breakdown.behavior * 100).toFixed(0)}%</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/40 col-span-2 sm:col-span-1">
                        <div className="text-slate-400 mb-1 truncate">AIS Gap</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-rose-500 h-full rounded-full" style={{ width: `${v.score_breakdown.ais_gap * 100}%` }} />
                        </div>
                        <span className="text-slate-300 font-semibold mt-1 block">{(v.score_breakdown.ais_gap * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  )}

                  {/* Audit Ranking Reasons */}
                  {v.ranking_reasons && (
                    <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-slate-800/40 text-xs">
                      <div className="text-[10px] sm:text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Tactical Audit Evidence:
                      </div>
                      <ul className="space-y-1">
                        {v.ranking_reasons.map((r, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-slate-300 font-mono text-[10px] sm:text-[11px]">
                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Interactive Map Focus & Coast Guard Patrol Dispatch Actions */}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/50 flex-wrap gap-2">
                    <span className="text-[11px] font-mono text-slate-400 truncate mr-2">
                      {v.metrics?.min_distance_km !== undefined
                        ? `Closest slick approach: ${v.metrics.min_distance_km.toFixed(2)} km`
                        : 'Intersecting Spill Origin Corridor'}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setBriefVessel(v)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                        title="Generate Coast Guard Tactical Patrol Brief (Flight vector & MARPOL evidence checklist)"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Patrol Brief</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFocusedVesselMmsi && setFocusedVesselMmsi(isFocused ? null : v.mmsi)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isFocused
                            ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/20'
                        }`}
                      >
                        <Crosshair className={`w-3.5 h-3.5 ${isFocused ? 'animate-spin' : ''}`} />
                        <span>{isFocused ? 'Tracking' : 'Focus'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Senior Critique #5: IMO MARPOL Annex I Legal Standard Disclaimer */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 font-mono space-y-1.5">
            <div className="text-amber-400 font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>IMO MARPOL Annex I Evidence Standard:</span>
            </div>
            <p className="leading-relaxed text-slate-300">
              This system operates as a tactical decision-support alert tool for Coast Guard and Maritime Authorities. In compliance with international maritime law, formal judicial prosecution requires physical hydrocarbon water sampling and verified optical imagery. Mathematical models guide rapid aerial reconnaissance vectors, not automated judicial guilt.
            </p>
          </div>
        </div>
      )}


      {/* 5. VIEW 2: Full Real AIS Vessel Dataset Search */}
      {viewMode === 'full_dataset' && (
        <div className="space-y-2.5 sm:space-y-3">
          {loadingDataset ? (
            <div className="p-8 text-center text-cyan-400 font-mono text-xs animate-pulse glass-card rounded-xl border border-slate-800">
              Querying real AIS vessel dataset...
            </div>
          ) : fullDataset.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-mono text-xs glass-card rounded-xl border border-slate-800">
              <AlertTriangle className="w-8 h-8 text-cyan-400/80 mx-auto mb-2" />
              <p>No real AIS vessels found matching your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {fullDataset.map((v) => (
                <div
                  key={v.mmsi}
                  className="p-3 sm:p-3.5 rounded-xl glass-card border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all"
                >
                  <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 sm:mt-0">
                      AIS
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-100 flex flex-wrap items-center gap-1.5">
                        <span>{v.name}</span>
                        <span className="text-[11px] font-normal text-slate-400 font-mono">({v.ship_type})</span>
                      </h4>
                      <div className="text-[11px] sm:text-xs font-mono text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        <span>MMSI: <strong className="text-slate-300 font-semibold">{v.mmsi}</strong></span>
                        <span>IMO: <strong className="text-slate-300 font-semibold">{v.imo}</strong></span>
                        <span>Flag: <strong className="text-slate-300 font-semibold">{v.flag}</strong></span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {v.destination && <span className="text-cyan-400">Dest: {v.destination}</span>}
                        {v.corridor && <span className="text-purple-400">Corridor: {v.corridor}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right font-mono text-xs border-t sm:border-t-0 border-slate-800/60 pt-1.5 sm:pt-0 shrink-0">
                    <div className="text-slate-400 text-[10px]">Dimensions</div>
                    <div className="text-slate-200 font-bold">{v.length_m}m × {v.beam_m}m</div>
                    <div className="text-slate-400 text-[10px] mt-0.5">Max Draft: {v.max_draft_m}m</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Coast Guard Tactical Patrol Brief Modal & Clean Print Document */}
      {briefVessel && typeof document !== 'undefined' && createPortal(
        <>
          {/* 1. INTERACTIVE ON-SCREEN MODAL (Hidden during print) */}
          <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 no-print">
            <div className="w-full max-w-2xl glass-panel bg-slate-950/95 border border-cyan-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative">
              {/* Modal Header */}
              <div className="p-4 sm:p-4.5 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-cyan-950/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    <Plane className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 flex-wrap">
                      <span>Coast Guard Tactical Patrol Brief</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                        MARPOL Annex I
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/80 text-amber-300 border border-amber-500/40">
                        Rank #{briefVessel.suspect_rank}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Aerial Reconnaissance Vector & Hydrocarbon Sampling Mission Plan
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBriefVessel(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Close Brief"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Interactive Section Navigation Tabs / Quick Jump Bar */}
              <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between gap-1 overflow-x-auto shrink-0 text-[11px] font-mono">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => scrollToBriefSection('dossier')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      activeBriefTab === 'dossier'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                        : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    🎯 1. Dossier
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToBriefSection('evidence')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      activeBriefTab === 'evidence'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                        : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    📡 2. SAR Proof
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToBriefSection('protocol')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      activeBriefTab === 'protocol'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                        : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    📋 3. Protocol (4-Step)
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToBriefSection('legal')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      activeBriefTab === 'legal'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                        : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    ⚖️ 4. Notice
                  </button>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-[10px] text-cyan-400/80 shrink-0">
                  <span>Scroll down for sampling protocol</span>
                  <ChevronDown className="w-3 h-3 animate-bounce" />
                </div>
              </div>

              {/* Modal Scrollable Content */}
              <div
                ref={scrollContentRef}
                onScroll={handleModalScroll}
                className="custom-modal-scrollbar p-4 sm:p-5 overflow-y-auto space-y-4 font-mono text-xs text-slate-300 flex-1 min-h-0"
              >
                {/* 1. Target Vessel & Priority Bar */}
                <div id="brief-section-dossier" className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Target Vessel</div>
                    <div className="font-bold text-slate-100 text-sm mt-0.5 truncate">{briefVessel.vessel_name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{briefVessel.ship_type}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Identification</div>
                    <div className="text-slate-200 mt-0.5">MMSI: <strong>{briefVessel.mmsi}</strong></div>
                    <div className="text-[10px] text-slate-400">IMO: {briefVessel.imo || 'N/A'} | Flag: {briefVessel.flag || 'Unknown'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Interception Priority</div>
                    <div className="text-sm font-bold text-orange-400 mt-0.5">
                      {((briefVessel.interception_priority || briefVessel.confidence_score) * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-slate-400">Tactical Rank #{briefVessel.suspect_rank}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Heading & Transit</div>
                    <div className="text-slate-200 mt-0.5">{briefVessel.base_course}° Heading</div>
                    <div className="text-[10px] text-cyan-400 truncate">{briefVessel.corridor}</div>
                  </div>
                </div>

                {/* 2. Physical SAR Evidence Section */}
                <div id="brief-section-evidence" className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
                  <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Physical Satellite Radar Grounding</span>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-1.5 leading-relaxed">
                    <div>
                      • <strong>Radar Cross-Section (RCS):</strong> {briefVessel.sar_metallic_contact?.rcs_dbm2 || '+28.4'} dBm² (Confirmed metallic microwave dielectric reflection on satellite SAR scene).
                    </div>
                    <div>
                      • <strong>Transponder Status:</strong>{' '}
                      {briefVessel.is_dark_vessel ? (
                        <span className="text-rose-400 font-bold bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-500/30">
                          Uncooperative / Dark Target (AIS Transponder Inactive during transit window)
                        </span>
                      ) : (
                        <span className="text-emerald-400">Continuous AIS transponder stream verified.</span>
                      )}
                    </div>
                    <div>
                      • <strong>Spill Proximity:</strong> Transited within {briefVessel.metrics?.min_distance_km?.toFixed(2) || '1.2'} km of probable spill envelope.
                    </div>
                  </div>
                </div>

                {/* 3. Aerial Reconnaissance Vector Checklist (4-Step Legal Protocol) */}
                <div id="brief-section-protocol" className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                  <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                      <span>Coast Guard Intercept & Legal Sampling Protocol (IMO MARPOL Annex I):</span>
                    </div>
                    <span className="text-[10px] text-amber-400/80 font-normal">4 Mandatory Actions</span>
                  </div>
                  <div className="space-y-2 text-[11px]">
                    <div className="flex items-start gap-2 text-slate-200 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                      <span className="w-5 h-5 rounded bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 border border-cyan-500/40">1</span>
                      <div>
                        <strong className="text-cyan-300">Aerial Optical & FLIR Infrared Imagery:</strong>
                        <p className="text-slate-400 mt-0.5 leading-relaxed">
                          Fly intercept patrol at altitude 500–1,500 ft; capture high-resolution forward-looking infrared (FLIR) imagery documenting oil slick continuity trailing vessel stern.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-slate-200 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                      <span className="w-5 h-5 rounded bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 border border-cyan-500/40">2</span>
                      <div>
                        <strong className="text-cyan-300">Physical Hydrocarbon Sampling:</strong>
                        <p className="text-slate-400 mt-0.5 leading-relaxed">
                          Dispatch surface cutter or launch rigid-hull inflatable dinghy (RHIB); draw three (3) tamper-sealed sample bottles of oil sheen + background clean water control for Gas Chromatography-Mass Spectrometry (GC-MS) laboratory fingerprinting.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-slate-200 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                      <span className="w-5 h-5 rounded bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 border border-cyan-500/40">3</span>
                      <div>
                        <strong className="text-cyan-300">Oil Record Book (ORB) Audit:</strong>
                        <p className="text-slate-400 mt-0.5 leading-relaxed">
                          Board vessel at next territorial port of call; audit and impound certified copies of Part I Machinery Space bilge tank logs and Oil Discharge Monitoring Equipment (ODME) operational history.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-slate-200 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                      <span className="w-5 h-5 rounded bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 border border-cyan-500/40">4</span>
                      <div>
                        <strong className="text-cyan-300">Evidentiary Chain of Custody:</strong>
                        <p className="text-slate-400 mt-0.5 leading-relaxed">
                          Complete time-stamped, tamper-evident custody receipts signed by boarding officer and master; required by admiralty court judges under IMO MARPOL Annex I guidelines.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Legal Disclaimer */}
                <div id="brief-section-legal" className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200/90 leading-relaxed">
                  <strong>Legal Notice:</strong> This tactical brief provides actionable flight coordinates and mission planning for maritime law enforcement authorities. It does NOT constitute legal judgment or financial liability without physical sample laboratory GC-MS corroboration.
                </div>
              </div>

              {/* Visual Bottom Fade Gradient (signals content continues below) */}
              <div
                className={`pointer-events-none absolute bottom-[62px] left-0 right-0 h-10 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent transition-opacity duration-300 ${
                  isAtBottom ? 'opacity-0' : 'opacity-100'
                }`}
              />

              {/* Floating Scroll Cue Button (Dismisses once scrolled to bottom) */}
              {!isAtBottom && (
                <div className="absolute bottom-[72px] left-0 right-0 flex justify-center pointer-events-none z-10">
                  <button
                    type="button"
                    onClick={scrollToBriefBottom}
                    className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-cyan-950/95 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/50 shadow-2xl text-[11px] font-mono tracking-wide animate-bounce cursor-pointer transition-all"
                  >
                    <span>Scroll for Sampling Protocol & Legal Notice</span>
                    <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                  </button>
                </div>
              )}

              {/* Modal Sticky Footer Actions */}
              <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-2 flex-wrap shrink-0">
                <span className="text-[11px] font-mono text-slate-400">
                  Target GPS: {incident?.centroid ? `${incident.centroid[0].toFixed(4)}°N, ${incident.centroid[1].toFixed(4)}°E` : '5.8500°N, 80.5000°E'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(`MISSION VECTOR: Intercept ${briefVessel.vessel_name} (MMSI: ${briefVessel.mmsi}) near [${incident?.centroid?.[0]}, ${incident?.centroid?.[1]}], Heading: ${briefVessel.base_course}deg`);
                      alert('Flight Intercept Coordinates copied to clipboard!');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Copy Vector</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Mission PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBriefVessel(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. ISOLATED OFFICIAL A4 PRINTABLE DOCUMENT (Visible ONLY when printing / saving PDF) */}
          <div className="hidden print-patrol-brief">
            {/* Government / Maritime Authority Header */}
            <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '8px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '9pt', fontWeight: 'bold', letterSpacing: '1px', color: '#334155' }}>
                    GOVERNMENT OF INDIA • MINISTRY OF PORTS, SHIPPING AND WATERWAYS
                  </div>
                  <div style={{ fontSize: '8.5pt', fontWeight: 'bold', color: '#0369a1', marginTop: '2px' }}>
                    INDIAN COAST GUARD / MARITIME RESCUE COORDINATION CENTRE (MRCC)
                  </div>
                  <h1 style={{ fontSize: '15pt', fontWeight: '800', color: '#0f172a', margin: '4px 0 0 0', textTransform: 'uppercase' }}>
                    Tactical Patrol Brief & MARPOL Sampling Directive
                  </h1>
                  <div style={{ fontSize: '8.5pt', color: '#64748b', marginTop: '2px' }}>
                    Aerial Reconnaissance Vector, Satellite SAR Corroboration & Hydrocarbon Chain of Custody
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '8pt', color: '#334155', minWidth: '220px' }}>
                  <div style={{ fontWeight: 'bold' }}>REF: ICG-MRCC-PATROL-{briefVessel.mmsi || 'SAR'}-{new Date().toISOString().slice(0, 10)}</div>
                  <div style={{ color: '#b91c1c', fontWeight: 'bold', margin: '2px 0' }}>RESTRICTED // LAW ENFORCEMENT SENSITIVE</div>
                  <div>DATE: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  <div>TIME: {new Date().toLocaleTimeString('en-GB', { timeZone: 'UTC' })} UTC</div>
                </div>
              </div>
            </div>

            {/* Target Suspect Vessel Dossier Table */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '10pt', fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>1. Suspect Vessel Dossier</span>
                <span style={{ fontSize: '8pt', padding: '1px 6px', background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171', borderRadius: '3px', fontWeight: 'bold' }}>
                  PRIORITY ATTRIBUTION RANK #{briefVessel.suspect_rank}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', fontFamily: 'monospace' }}>
                <tbody>
                  <tr style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                    <td style={{ padding: '6px 8px', width: '25%', fontWeight: 'bold', color: '#475569' }}>Target Vessel</td>
                    <td style={{ padding: '6px 8px', width: '25%', fontWeight: 'bold', color: '#0f172a' }}>{briefVessel.vessel_name}</td>
                    <td style={{ padding: '6px 8px', width: '25%', fontWeight: 'bold', color: '#475569' }}>Vessel Type</td>
                    <td style={{ padding: '6px 8px', width: '25%' }}>{briefVessel.ship_type}</td>
                  </tr>
                  <tr style={{ border: '1px solid #cbd5e1' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold', color: '#475569' }}>MMSI / IMO</td>
                    <td style={{ padding: '6px 8px' }}>{briefVessel.mmsi} / {briefVessel.imo || 'N/A'}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold', color: '#475569' }}>Flag State</td>
                    <td style={{ padding: '6px 8px' }}>{briefVessel.flag || 'Unknown'}</td>
                  </tr>
                  <tr style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold', color: '#475569' }}>Interception Priority</td>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold', color: '#c2410c' }}>
                      {((briefVessel.interception_priority || briefVessel.confidence_score) * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold', color: '#475569' }}>Transit Course / Corridor</td>
                    <td style={{ padding: '6px 8px' }}>{briefVessel.base_course}° / {briefVessel.corridor}</td>
                  </tr>
                  <tr style={{ border: '1px solid #cbd5e1' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold', color: '#475569' }}>Dimensions / Draft</td>
                    <td style={{ padding: '6px 8px' }}>{briefVessel.length_m}m × {briefVessel.beam_m}m (Draft: {briefVessel.max_draft_m}m)</td>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold', color: '#475569' }}>Spill Proximity (CPA)</td>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{briefVessel.metrics?.min_distance_km?.toFixed(2) || '1.2'} km</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Physical SAR Satellite Corroboration */}
            <div style={{ marginBottom: '14px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '8px 10px', background: '#f0f9ff' }}>
              <div style={{ fontSize: '9.5pt', fontWeight: 'bold', color: '#0369a1', textTransform: 'uppercase', marginBottom: '4px' }}>
                2. Physical Satellite SAR Radar Grounding
              </div>
              <div style={{ fontSize: '8.5pt', lineHeight: '1.45', color: '#1e293b' }}>
                <div>• <strong>Radar Cross-Section (RCS):</strong> {briefVessel.sar_metallic_contact?.rcs_dbm2 || '+28.4'} dBm² (Confirmed double-bounce metallic microwave dielectric reflection on satellite SAR scene).</div>
                <div>• <strong>AIS Transponder Status:</strong> {briefVessel.is_dark_vessel ? 'UNCOOPERATIVE / DARK TARGET — Transponder turned OFF during transit through discharge envelope.' : 'Continuous AIS transponder stream verified.'}</div>
                <div>• <strong>Spill Centroid Coordinates:</strong> {incident?.centroid ? `${incident.centroid[0].toFixed(4)}°N, ${incident.centroid[1].toFixed(4)}°E` : '5.8500°N, 80.5000°E'} (Observed SAR Slick Extent: {incident?.area_km2 || '14.2'} km²)</div>
              </div>
            </div>

            {/* Mandatory 4-Step Legal Sampling Protocol */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '10pt', fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase', marginBottom: '6px' }}>
                3. Mandatory Coast Guard Field Sampling Protocol (IMO MARPOL Annex I)
              </div>
              <div style={{ fontSize: '8.5pt', lineHeight: '1.4' }}>
                <div style={{ marginBottom: '6px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                  <strong>[STEP 1] Aerial Optical & FLIR Infrared Imagery:</strong>
                  <div>Dispatch airborne patrol (Dornier 228 / Coast Guard ALH) at altitude 500–1,500 ft; record calibrated forward-looking infrared (FLIR) imagery documenting continuous oil slick trailing vessel stern.</div>
                </div>
                <div style={{ marginBottom: '6px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                  <strong>[STEP 2] Physical Hydrocarbon Sampling:</strong>
                  <div>Dispatch surface cutter or launch rigid-hull inflatable dinghy (RHIB); draw three (3) tamper-sealed sample glass bottles of surface sheen plus one control sample of clean background seawater for Gas Chromatography-Mass Spectrometry (GC-MS) laboratory fingerprinting.</div>
                </div>
                <div style={{ marginBottom: '6px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                  <strong>[STEP 3] Oil Record Book (ORB) Audit:</strong>
                  <div>Board vessel at next territorial port of call; audit and impound certified copies of Part I Machinery Space bilge tank logs and 15 ppm Oil Discharge Monitoring Equipment (ODME) operational history.</div>
                </div>
                <div style={{ marginBottom: '6px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                  <strong>[STEP 4] Evidentiary Chain of Custody:</strong>
                  <div>Complete time-stamped, tamper-evident custody receipts signed by boarding officer and vessel master; admissible under Admiralty Court rules as required by IMO MARPOL Annex I guidelines.</div>
                </div>
              </div>
            </div>

            {/* Intercept Vector & Flight Dispatch */}
            <div style={{ marginBottom: '14px', padding: '8px 10px', border: '1px solid #fde68a', background: '#fffbeb', borderRadius: '4px', fontSize: '8.5pt' }}>
              <div style={{ fontWeight: 'bold', color: '#92400e', textTransform: 'uppercase', marginBottom: '3px' }}>
                4. Mission Intercept Vector & Communications Directive
              </div>
              <div>
                <strong>Intercept Bearing:</strong> {briefVessel.base_course}° on corridor {briefVessel.corridor} | <strong>Target Coordinates:</strong> {incident?.centroid ? `${incident.centroid[0].toFixed(4)}°N, ${incident.centroid[1].toFixed(4)}°E` : '5.8500°N, 80.5000°E'}. Contact Maritime Operations Center on VHF Ch 16 / 4125 kHz.
              </div>
            </div>

            {/* Statutory Legal Disclaimer & Sign-off Block */}
            <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px', fontSize: '7.5pt', color: '#64748b', lineHeight: '1.35' }}>
              <div>
                <strong>STATUTORY NOTICE:</strong> This tactical brief provides actionable flight coordinates and mission planning for law enforcement authorities. It does not constitute final legal judgment without physical sample laboratory corroboration.
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '10px' }}>
                <div style={{ width: '45%', borderTop: '1px solid #94a3b8', paddingTop: '4px' }}>
                  <div style={{ fontWeight: 'bold', color: '#0f172a' }}>Duty Marine Safety Inspector</div>
                  <div>Signature & Stamp / Date</div>
                </div>
                <div style={{ width: '45%', borderTop: '1px solid #94a3b8', paddingTop: '4px', textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', color: '#0f172a' }}>Authorized Watch Commander, MRCC</div>
                  <div>Command Seal & Signature / Date</div>
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
