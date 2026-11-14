import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Ambulance,
  Navigation,
  Play,
  Sliders,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CityMap } from '../components/CityMap';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import type {
  TrafficCorridor,
  TrafficPredictionResult,
  TrafficSimulationResult,
} from '../types/smartcity';

const TRAFFIC_SAMPLE_IMG = '/src/assets/images/traffic_corridor_sample_1794656029203.jpg';

export function TrafficIntelligencePage() {
  const { notify } = useAuth();
  const [corridors, setCorridors] = useState<TrafficCorridor[]>([]);
  const [selected, setSelected] = useState<TrafficCorridor | null>(null);
  const [loading, setLoading] = useState(true);

  // ML Predictor state
  const [hourOfDay, setHourOfDay] = useState(18);
  const [dayOfWeek, setDayOfWeek] = useState('Friday');
  const [weather, setWeather] = useState<'Clear' | 'Light Rain' | 'Heavy Monsoon' | 'Haze / Fog'>('Clear');
  const [histDensity, setHistDensity] = useState(145);
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<TrafficPredictionResult | null>(null);

  // Simulator state
  const [simEvent, setSimEvent] = useState<TrafficSimulationResult['eventType']>('Heavy Congestion');
  const [simulating, setSimulating] = useState(false);
  const [simulation, setSimulation] = useState<TrafficSimulationResult | null>(null);

  const loadCorridors = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ corridors: TrafficCorridor[] }>('/api/traffic/current');
      setCorridors(res.corridors);
      if (res.corridors.length > 0) {
        setSelected(res.corridors[0]);
        setHistDensity(res.corridors[0].currentDensity);
      }
    } catch (err) {
      notify('Traffic feed error', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCorridors();
  }, []);

  const runPrediction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selected) return;
    setPredicting(true);
    try {
      const res = await apiRequest<{ prediction: TrafficPredictionResult }>('/api/traffic/predict', {
        method: 'POST',
        body: JSON.stringify({
          corridorId: selected.id,
          hourOfDay,
          dayOfWeek,
          weather,
          historicalDensity: histDensity,
        }),
      });
      setPrediction(res.prediction);
      notify('ML Prediction Ready', `${selected.shortName}: ${res.prediction.predictedCongestionPct}% congestion`, 'success');
    } catch (err) {
      notify('Prediction error', (err as Error).message, 'error');
    } finally {
      setPredicting(false);
    }
  };

  const runSimulation = async (eventType: TrafficSimulationResult['eventType']) => {
    if (!selected) return;
    setSimEvent(eventType);
    setSimulating(true);
    try {
      const res = await apiRequest<{ simulation: TrafficSimulationResult }>('/api/traffic/simulate', {
        method: 'POST',
        body: JSON.stringify({ corridorId: selected.id, eventType }),
      });
      setSimulation(res.simulation);
      notify(`Simulated: ${eventType}`, `Alternate route: ${res.simulation.recommendedRoute.name}`, 'info');
    } catch (err) {
      notify('Simulation failed', (err as Error).message, 'error');
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    if (selected) {
      runPrediction();
      runSimulation('Heavy Congestion');
    }
  }, [selected?.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Traffic Intelligence</h1>
          <p className="text-xs text-slate-500 dark:text-[#91A2B8] mt-1">
            Corridor density analytics, ML congestion forecasting & advisory rerouting simulation (Simulated Telemetry)
          </p>
        </div>
        <select
          value={selected?.id || ''}
          onChange={(e) => {
            const found = corridors.find((c) => c.id === e.target.value) || null;
            setSelected(found);
            if (found) setHistDensity(found.currentDensity);
          }}
          className="rounded-xl bg-white dark:bg-[#101D2D] border border-slate-200 dark:border-[#82AAD2]/20 px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-[#00C8FF]"
        >
          {corridors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Top Row: Corridor Visual + Map + Selected Corridor Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#00C8FF]">
              {selected?.cameraLabel || 'Corridor Feed'}
            </span>
            <span className="text-xs font-medium text-[#FFB547]">Simulated Feed</span>
          </div>
          <div className="relative rounded-xl overflow-hidden border border-[#82AAD2]/20 aspect-video bg-[#070D18]">
            <img
              src={TRAFFIC_SAMPLE_IMG}
              alt={selected?.name || 'Mumbai Expressway'}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070D18]/85 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-[#F4F7FC]">
              <span className="font-semibold">{selected?.shortName}</span>
              <span className="font-mono tabular-nums">
                {selected?.avgSpeedKmph} km/h · {selected?.currentDensity} veh/km
              </span>
            </div>
          </div>

          {selected && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-[#91A2B8]">Current Congestion</span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    selected.congestionPct >= 75
                      ? 'text-[#FF5263]'
                      : selected.congestionPct >= 55
                        ? 'text-[#FFB547]'
                        : 'text-[#00D69A]'
                  }`}
                >
                  {selected.congestionPct}% · {selected.status}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-[#070D18] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    selected.congestionPct >= 75
                      ? 'bg-[#FF5263]'
                      : selected.congestionPct >= 55
                        ? 'bg-[#FFB547]'
                        : 'bg-[#00D69A]'
                  }`}
                  style={{ width: `${selected.congestionPct}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                <div className="rounded-xl bg-slate-50 dark:bg-[#14243A] p-2.5">
                  <p className="text-[11px] text-slate-400 dark:text-[#91A2B8]">Current ETA</p>
                  <p className="font-mono font-semibold mt-0.5 tabular-nums">{selected.expectedTravelMin} min</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-[#14243A] p-2.5">
                  <p className="text-[11px] text-slate-400 dark:text-[#91A2B8]">Free-Flow</p>
                  <p className="font-mono font-semibold mt-0.5 tabular-nums">{selected.freeFlowTravelMin} min</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-[#14243A] p-2.5">
                  <p className="text-[11px] text-slate-400 dark:text-[#91A2B8]">Hotspot</p>
                  <p className="font-semibold mt-0.5 text-[#FFB547]">
                    {selected.accidentHotspot ? 'Flagged' : 'Normal'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base font-semibold">Mumbai Arterial Corridor Map</h2>
            <span className="text-xs text-slate-500 dark:text-[#91A2B8]">Click any corridor polyline to inspect</span>
          </div>
          {loading ? (
            <div className="h-[340px] rounded-xl bg-slate-200 dark:bg-[#14243A] animate-pulse" />
          ) : (
            <CityMap
              corridors={corridors}
              showIncidents={false}
              showTraffic={true}
              showEnvironment={false}
              selectedId={selected?.id}
              onSelectCorridor={(c) => {
                setSelected(c);
                setHistDensity(c.currentDensity);
              }}
              className="h-[340px] w-full rounded-xl"
              zoom={12}
            />
          )}
        </div>
      </div>

      {/* Bottom Row: ML Congestion Predictor + Interactive Event & Rerouting Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ML Predictor */}
        <form
          onSubmit={runPrediction}
          className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#00C8FF]" />
              <h2 className="font-display text-base font-semibold">ML Congestion Prediction Model</h2>
            </div>
            <button
              type="submit"
              disabled={predicting}
              className="px-3.5 py-1.5 rounded-xl bg-[#00C8FF] hover:bg-[#00B4E6] text-[#070D18] text-xs font-semibold"
            >
              {predicting ? 'Predicting...' : 'Run Forecast'}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 dark:text-[#91A2B8] mb-1">Hour ({hourOfDay}:00)</label>
              <input
                type="range"
                min={0}
                max={23}
                value={hourOfDay}
                onChange={(e) => setHourOfDay(Number(e.target.value))}
                className="w-full accent-[#00C8FF]"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-[#91A2B8] mb-1">Day of Week</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-2.5 py-1.5"
              >
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-500 dark:text-[#91A2B8] mb-1">Weather</label>
              <select
                value={weather}
                onChange={(e) => setWeather(e.target.value as typeof weather)}
                className="w-full rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-2.5 py-1.5"
              >
                <option value="Clear">Clear</option>
                <option value="Haze / Fog">Haze / Fog</option>
                <option value="Light Rain">Light Rain</option>
                <option value="Heavy Monsoon">Heavy Monsoon</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-500 dark:text-[#91A2B8] mb-1">Density (veh/km)</label>
              <input
                type="number"
                min={20}
                max={260}
                value={histDensity}
                onChange={(e) => setHistDensity(Number(e.target.value))}
                className="w-full rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-2.5 py-1.5 font-mono"
              />
            </div>
          </div>

          {prediction && (
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-[#82AAD2]/10">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 dark:bg-[#14243A] p-3">
                  <p className="text-[11px] text-slate-400 dark:text-[#91A2B8]">Predicted Level</p>
                  <p className="font-mono text-lg font-bold text-[#FFB547] mt-0.5 tabular-nums">
                    {prediction.predictedCongestionPct}% · {prediction.predictedLevel}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-[#14243A] p-3">
                  <p className="text-[11px] text-slate-400 dark:text-[#91A2B8]">Est. Density</p>
                  <p className="font-mono text-lg font-bold text-[#00C8FF] mt-0.5 tabular-nums">
                    {prediction.estimatedDensity} veh/km
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-[#14243A] p-3">
                  <p className="text-[11px] text-slate-400 dark:text-[#91A2B8]">Expected Travel</p>
                  <p className="font-mono text-lg font-bold mt-0.5 tabular-nums">
                    {prediction.expectedTravelMin} min
                  </p>
                </div>
              </div>

              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={prediction.factors} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(130,170,210,0.12)" />
                    <XAxis type="number" stroke="#91A2B8" fontSize={11} />
                    <YAxis dataKey="factor" type="category" width={145} stroke="#91A2B8" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#101D2D',
                        borderColor: 'rgba(130,170,210,0.25)',
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="impactPct" name="Weight (%)" fill="#00C8FF" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <p className="text-xs text-slate-600 dark:text-[#91A2B8]">
                <strong className="text-[#00D69A]">Advisory Action:</strong> {prediction.recommendedAction}
              </p>
            </div>
          )}
        </form>

        {/* Interactive Road Event & Emergency Rerouting Simulator */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-[#00D69A]" />
              <h2 className="font-display text-base font-semibold">Interactive Corridor Event Simulator</h2>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-[#91A2B8]">Advisory Routing Only</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              ['Normal Traffic', 'Heavy Congestion', 'Accident', 'Road Closure'] as TrafficSimulationResult['eventType'][]
            ).map((ev) => (
              <button
                key={ev}
                disabled={simulating}
                onClick={() => runSimulation(ev)}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  simEvent === ev
                    ? ev === 'Road Closure' || ev === 'Accident'
                      ? 'bg-[#FF5263]/15 border-[#FF5263]/50 text-[#FF5263]'
                      : 'bg-[#00C8FF]/15 border-[#00C8FF]/50 text-[#00C8FF]'
                    : 'border-slate-200 dark:border-[#82AAD2]/15 text-slate-600 dark:text-[#91A2B8] hover:border-[#00C8FF]/40'
                }`}
              >
                {ev}
              </button>
            ))}
          </div>

          {simulation && (
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-[#82AAD2]/10">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl bg-slate-50 dark:bg-[#14243A] p-3">
                  <p className="text-[11px] text-slate-400 dark:text-[#91A2B8]">Simulated Load</p>
                  <p className="font-mono text-lg font-bold text-[#FF5263] mt-0.5 tabular-nums">
                    {simulation.simulatedCongestionPct}%
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-[#14243A] p-3">
                  <p className="text-[11px] text-slate-400 dark:text-[#91A2B8]">Primary ETA</p>
                  <p className="font-mono text-lg font-bold mt-0.5 tabular-nums">
                    {simulation.primaryRouteEtaMin} min
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-[#14243A] p-3">
                  <p className="text-[11px] text-slate-400 dark:text-[#91A2B8]">Detour Time Saved</p>
                  <p className="font-mono text-lg font-bold text-[#00D69A] mt-0.5 tabular-nums">
                    +{simulation.recommendedRoute.timeSavedMin} min
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#00D69A]/30 bg-[#00D69A]/8 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#00D69A] flex items-center gap-1.5">
                    <Navigation className="w-4 h-4" />
                    Recommended Alternate Route
                  </span>
                  <span className="font-mono text-[#F4F7FC] tabular-nums">
                    {simulation.recommendedRoute.estimatedMin} min ({simulation.recommendedRoute.congestionPct}% load)
                  </span>
                </div>
                <p className="text-sm font-semibold">{simulation.recommendedRoute.name}</p>
                <p className="text-xs text-slate-600 dark:text-[#91A2B8]">{simulation.advisory}</p>
              </div>

              <div className="rounded-xl border border-[#FFB547]/30 bg-[#FFB547]/8 p-3.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Ambulance className="w-5 h-5 text-[#FFB547] shrink-0" />
                  <div>
                    <p className="font-semibold">Emergency Green-Corridor Simulation</p>
                    <p className="text-slate-500 dark:text-[#91A2B8]">
                      Estimated ambulance transit via {simulation.recommendedRoute.name}
                    </p>
                  </div>
                </div>
                <span className="font-mono font-bold text-[#FFB547] text-sm tabular-nums shrink-0">
                  {simulation.emergencyCorridorMinutes} min
                </span>
              </div>

              <p className="text-[11px] text-slate-400 dark:text-[#91A2B8] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#FFB547] shrink-0" />
                Note: Simulation outputs advisory routing only and does not directly actuate live road traffic signals.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
