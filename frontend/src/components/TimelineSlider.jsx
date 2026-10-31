import React, { useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, FastForward, Clock, Wind, Navigation, Activity, Sparkles, Compass } from 'lucide-react';

const FORWARD_STEPS = [
  { hour: 0, label: '0h (Detection)', dist: '0.0 km', speed: '0.0 kts' },
  { hour: 6, label: '+6h', dist: '4.2 km', speed: '0.8 kts' },
  { hour: 12, label: '+12h', dist: '8.8 km', speed: '0.9 kts' },
  { hour: 18, label: '+18h', dist: '13.5 km', speed: '1.0 kts' },
  { hour: 24, label: '+24h', dist: '18.2 km', speed: '1.1 kts' },
  { hour: 36, label: '+36h', dist: '27.4 km', speed: '1.0 kts' },
  { hour: 48, label: '+48h', dist: '36.8 km', speed: '0.9 kts' }
];

const BACKWARD_STEPS = [
  { idx: 0, hour: 0, label: '0h (Spill)', sublabel: 'Detection' },
  { idx: 1, hour: -6, label: '-6h', sublabel: 'Drift' },
  { idx: 2, hour: -12, label: '-12h', sublabel: 'Drift' },
  { idx: 3, hour: -18, label: '-18h', sublabel: 'Drift' },
  { idx: 4, hour: -24, label: '-24h', sublabel: 'Origin Zone' }
];

export default function TimelineSlider({
  simulationMode = 'forward',
  setSimulationMode,
  timelineHour = 0,
  setTimelineHour,
  backwardStepIdx = 0,
  setBackwardStepIdx,
  isPlaying,
  setIsPlaying,
  playbackSpeed,
  setPlaybackSpeed,
  forecastData,
  originGeojson,
  selectedIncident,
  onRunForwardDrift,
  onRunBackwardOrigin
}) {
  const timerRef = useRef(null);
  const isBackward = simulationMode === 'backward';

  // Dynamic Environmental Forcing
  const forcing = selectedIncident?.forcing || forecastData?.['6h']?.geojson?.properties?.forcing || originGeojson?.properties?.forcing;
  const windSpeedMps = forcing?.wind_speed_m_s || 6.28;
  const windKnots = (windSpeedMps * 1.94384).toFixed(1);
  const currentSpeedMps = forcing?.current_speed_m_s || 0.45;

  // Forward Drift Calculations
  const estForwardDriftKm = (timelineHour * (currentSpeedMps + 0.03 * windSpeedMps) * 3.6).toFixed(1);

  // Backward Origin Calculations
  const ensembleSteps = originGeojson?.properties?.ensemble_steps;
  const currentBackwardStep = ensembleSteps?.[backwardStepIdx] || ensembleSteps?.[0];
  const backwardHoursElapsed = backwardStepIdx * 6;
  const estBackwardDriftKm = (backwardHoursElapsed * (currentSpeedMps + 0.03 * windSpeedMps) * 3.6).toFixed(1);
  const currentOriginArea = currentBackwardStep?.area_sqkm ?? (backwardStepIdx === 0 ? 0.6 : (backwardStepIdx * 5.8).toFixed(1));

  // Unified Animation Loop Effect
  useEffect(() => {
    if (isPlaying) {
      // Minor slow animation speed (2.4s per step) so each dispersion phase is clearly visible
      const intervalMs = isBackward
        ? Math.max(600, 2400 / playbackSpeed)
        : Math.max(300, 1500 / playbackSpeed);

      timerRef.current = setInterval(() => {
        if (isBackward) {
          setBackwardStepIdx((prev) => {
            if (prev >= 4) {
              // Finish simulation and stay on final -24h origin area (do not reset!)
              if (setIsPlaying) setIsPlaying(false);
              return 4;
            }
            return prev + 1;
          });
        } else {
          setTimelineHour((prevHour) => {
            if (prevHour >= 48) {
              if (setIsPlaying) setIsPlaying(false);
              return 48;
            }
            return prevHour + 1;
          });
        }
      }, intervalMs);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isBackward, playbackSpeed, setBackwardStepIdx, setTimelineHour, setIsPlaying]);

  const togglePlay = () => {
    if (!isPlaying) {
      // If user clicks play while already at the end of the simulation, replay from 0
      if (isBackward && backwardStepIdx >= 4) {
        setBackwardStepIdx(0);
      } else if (!isBackward && timelineHour >= 48) {
        setTimelineHour(0);
      }
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    if (isBackward) {
      setBackwardStepIdx(0);
    } else {
      setTimelineHour(0);
    }
  };

  const toggleSpeed = () => {
    if (playbackSpeed === 1) setPlaybackSpeed(2);
    else if (playbackSpeed === 2) setPlaybackSpeed(4);
    else setPlaybackSpeed(1);
  };

  const handleModeChange = (newMode) => {
    setIsPlaying(false);
    if (setSimulationMode) setSimulationMode(newMode);
    if (newMode === 'backward') {
      setBackwardStepIdx(0);
      if (!originGeojson && onRunBackwardOrigin) {
        onRunBackwardOrigin();
      }
    } else {
      setTimelineHour(0);
      if (!forecastData && onRunForwardDrift) {
        onRunForwardDrift();
      }
    }
  };

  const progressPercent = isBackward
    ? (backwardStepIdx / 4) * 100
    : (timelineHour / 48) * 100;

  return (
    <div className="w-full glass-panel border border-slate-800/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-2xl space-y-2.5 sm:space-y-3 font-sans">
      {/* Header Info Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800/80 pb-2 sm:pb-2.5">
        <div className="flex items-center justify-between md:justify-start gap-2 sm:gap-3 flex-wrap">
          {/* Icon & Title */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all ${
              isPlaying
                ? isBackward
                  ? 'bg-amber-950/80 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-950/50 animate-pulse'
                  : 'bg-cyan-950/80 border-cyan-500/50 text-cyan-400 shadow-lg shadow-cyan-950/50 animate-pulse'
                : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}>
              {isBackward ? <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </div>

            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[11px] sm:text-xs uppercase tracking-wider font-semibold text-slate-200">
                  {isBackward ? 'Backward Origin Drift' : 'Forward Drift Forecast'}
                </span>
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full border text-[9px] sm:text-[10px] font-mono font-bold ${
                  isBackward
                    ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                    : 'bg-purple-950/70 border-purple-500/40 text-purple-300'
                }`}>
                  {isBackward ? `-${backwardHoursElapsed}h` : `+${timelineHour}h`}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-mono hidden sm:block">
                {isBackward
                  ? '1,000-particle Monte Carlo stochastic eddy diffusion & reverse advection'
                  : 'Trajectory modeling surface current & wind vector drift physics'}
              </p>
            </div>
          </div>

          {/* Mode Switcher Segmented Control */}
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 ml-auto md:ml-2">
            <button
              type="button"
              onClick={() => handleModeChange('backward')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
                isBackward
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Switch to 1,000-particle Backward Origin Tracing"
            >
              <Sparkles className="w-3 h-3" />
              <span>Backward (-24h)</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('forward')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
                !isBackward
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Switch to Forward Drift Forecast"
            >
              <Compass className="w-3 h-3" />
              <span>Forward (+48h)</span>
            </button>
          </div>
        </div>

        {/* Dynamic Telemetry Metrics */}
        <div className="grid grid-cols-3 md:flex md:items-center gap-1.5 sm:gap-3 md:gap-4 text-[10px] sm:text-xs font-mono">
          <div className="flex items-center justify-center md:justify-start gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-900/90 border border-slate-800">
            <Navigation className={`w-3 h-3 shrink-0 hidden xs:block ${isBackward ? 'text-amber-400' : 'text-cyan-400'}`} />
            <span className="text-slate-400 hidden sm:inline">{isBackward ? 'Rev Drift:' : 'Drift:'}</span>
            <span className={`font-bold truncate ${isBackward ? 'text-amber-300' : 'text-cyan-300'}`}>
              {isBackward ? `${estBackwardDriftKm}km` : `${estForwardDriftKm}km`}
            </span>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-900/90 border border-slate-800">
            <Wind className="w-3 h-3 text-purple-400 shrink-0 hidden xs:block" />
            <span className="text-slate-400 hidden sm:inline">Forcing:</span>
            <span className="text-purple-300 font-bold truncate">{windKnots}kts</span>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-900/90 border border-slate-800">
            <Activity className={`w-3 h-3 shrink-0 hidden xs:block ${isBackward ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span className="text-slate-400 hidden sm:inline">Area:</span>
            <span className={`font-bold truncate ${isBackward ? 'text-amber-300' : 'text-emerald-300'}`}>
              {isBackward ? `${currentOriginArea}km²` : `+${(timelineHour * 4.2).toFixed(0)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Main Interactive Controls & Slider Bar */}
      <div className="flex items-center gap-2 sm:gap-4 pt-0.5 sm:pt-1">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs transition-all shadow-lg shrink-0 cursor-pointer ${
            isPlaying
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-amber-950/50 hover:brightness-110'
              : isBackward
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-950/50 hover:brightness-110'
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-cyan-950/50 hover:brightness-110'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                <span className="hidden sm:inline">PLAY </span>
                <span>{isBackward ? 'BACKWARD' : 'ANIMATION'}</span>
              </span>
            </>
          )}
        </button>

        {/* Reset Button */}
        <button
          type="button"
          onClick={handleReset}
          className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          title={isBackward ? "Reset to 0h Spill" : "Reset to 0h Detection"}
        >
          <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Speed Toggle */}
        <button
          type="button"
          onClick={toggleSpeed}
          className="flex items-center gap-0.5 sm:gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px] sm:text-xs hover:border-cyan-500/50 transition-colors shrink-0 cursor-pointer"
          title="Change playback speed"
        >
          <FastForward className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isBackward ? 'text-amber-400' : 'text-cyan-400'}`} />
          <span>{playbackSpeed}x</span>
        </button>

        {/* Custom Timeline Slider Control */}
        <div className="flex-1 relative flex flex-col justify-center px-1 sm:px-2 min-w-0">
          {/* Progress Bar background */}
          <div className="relative w-full h-2.5 sm:h-3 bg-slate-900 border border-slate-800 rounded-full overflow-hidden cursor-pointer">
            <div
              className={`h-full transition-all duration-150 rounded-full ${
                isBackward
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400'
                  : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* HTML5 Native Range Input Overlay */}
          <input
            type="range"
            min={0}
            max={isBackward ? 4 : 48}
            step={1}
            value={isBackward ? backwardStepIdx : timelineHour}
            onChange={(e) => {
              setIsPlaying(false);
              const val = parseInt(e.target.value, 10);
              if (isBackward) {
                setBackwardStepIdx(val);
              } else {
                setTimelineHour(val);
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          {/* Step Tick Marks */}
          <div className="relative w-full h-6 sm:h-8 mt-1 sm:mt-2">
            {isBackward ? (
              // Backward Steps (0h -> -24h)
              BACKWARD_STEPS.map((s) => {
                const isActive = backwardStepIdx === s.idx;
                const isPassed = backwardStepIdx >= s.idx;
                const percent = (s.idx / 4) * 100;
                let translateClass = '-translate-x-1/2';
                if (s.idx === 0) translateClass = 'translate-x-0';
                if (s.idx === 4) translateClass = '-translate-x-full';

                return (
                  <button
                    key={s.idx}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setBackwardStepIdx(s.idx);
                    }}
                    style={{ left: `${percent}%` }}
                    className={`absolute top-0 flex flex-col items-center group transition-colors focus:outline-none cursor-pointer ${translateClass}`}
                  >
                    <div
                      className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all ${
                        isActive
                          ? 'bg-amber-400 ring-2 sm:ring-4 ring-amber-500/30 scale-125'
                          : isPassed
                          ? 'bg-amber-600'
                          : 'bg-slate-700 group-hover:bg-slate-500'
                      }`}
                    />
                    <span
                      className={`text-[9px] sm:text-[10px] font-mono mt-0.5 sm:mt-1 transition-all whitespace-nowrap ${
                        isActive
                          ? 'text-amber-300 font-bold scale-105'
                          : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })
            ) : (
              // Forward Steps (0h -> +48h)
              FORWARD_STEPS.map((s) => {
                const isActive = timelineHour === s.hour;
                const isPassed = timelineHour >= s.hour;
                const percent = (s.hour / 48) * 100;
                let translateClass = '-translate-x-1/2';
                if (s.hour === 0) translateClass = 'translate-x-0';
                if (s.hour === 48) translateClass = '-translate-x-full';

                return (
                  <button
                    key={s.hour}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setTimelineHour(s.hour);
                    }}
                    style={{ left: `${percent}%` }}
                    className={`absolute top-0 flex flex-col items-center group transition-colors focus:outline-none cursor-pointer ${translateClass}`}
                  >
                    <div
                      className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all ${
                        isActive
                          ? 'bg-cyan-400 ring-2 sm:ring-4 ring-cyan-500/30 scale-125'
                          : isPassed
                          ? 'bg-cyan-600'
                          : 'bg-slate-700 group-hover:bg-slate-500'
                      }`}
                    />
                    <span
                      className={`text-[9px] sm:text-[10px] font-mono mt-0.5 sm:mt-1 transition-all ${
                        isActive
                          ? 'text-cyan-300 font-bold scale-105'
                          : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                    >
                      +{s.hour}h
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
