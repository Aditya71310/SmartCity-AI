import { useEffect, useState } from 'react';
import { AlertTriangle, Droplets, Thermometer, Volume2, Wind } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CityMap } from '../components/CityMap';
import { useAuth } from '../context/AuthContext';
import { apiRequest, formatRelativeTime } from '../services/api';
import type { EnvironmentStation } from '../types/smartcity';

interface EnvAlert {
  id: string;
  stationId: string;
  stationName: string;
  ward: string;
  aqi: number;
  pm25: number;
  pm10: number;
  noiseDb: number;
  reason: string;
  severity: string;
  updatedAt: string;
}

export function EnvironmentPage() {
  const { notify } = useAuth();
  const [cityAvgAqi, setCityAvgAqi] = useState(68);
  const [stations, setStations] = useState<EnvironmentStation[]>([]);
  const [alerts, setAlerts] = useState<EnvAlert[]>([]);
  const [selected, setSelected] = useState<EnvironmentStation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [r1, r2] = await Promise.all([
          apiRequest<{ cityAvgAqi: number; stations: EnvironmentStation[] }>('/api/environment/readings'),
          apiRequest<{ alerts: EnvAlert[] }>('/api/environment/alerts'),
        ]);
        setCityAvgAqi(r1.cityAvgAqi);
        setStations(r1.stations);
        setAlerts(r2.alerts);
        if (r1.stations.length > 0) setSelected(r1.stations[0]);
      } catch (err) {
        notify('Environment telemetry error', (err as Error).message, 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const activeStation = selected || stations[0];
  const aqiColor =
    (activeStation?.aqi ?? cityAvgAqi) > 140
      ? '#FF5263'
      : (activeStation?.aqi ?? cityAvgAqi) > 90
        ? '#FFB547'
        : '#00D69A';

  return (
    <div className="space-y-6">
      {/* Header & Station Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Environment Monitoring</h1>
          <p className="text-xs text-slate-500 dark:text-[#91A2B8] mt-1">
            City-wide AQI, particulate telemetry, acoustic noise & weather correlation (Simulated Sensor Network)
          </p>
        </div>

        <select
          value={activeStation?.id || ''}
          onChange={(e) => {
            const st = stations.find((s) => s.id === e.target.value);
            if (st) setSelected(st);
          }}
          className="rounded-xl bg-white dark:bg-[#101D2D] border border-slate-200 dark:border-[#82AAD2]/20 px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-[#00C8FF]"
        >
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.stationName} (AQI {s.aqi})
            </option>
          ))}
        </select>
      </div>

      {/* Top Row: AQI Gauge + Pollutant Cards + 24h Trend */}
      {loading || !activeStation ? (
        <div className="h-64 rounded-2xl bg-slate-200 dark:bg-[#101D2D] animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* AQI Gauge + Pollutants */}
          <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5 grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
            <div className="sm:col-span-5 flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 dark:bg-[#070D18]/70 border border-slate-200 dark:border-[#82AAD2]/15">
              <p className="text-xs text-slate-500 dark:text-[#91A2B8] mb-2">Station AQI</p>
              <div
                className="w-32 h-32 rounded-full flex flex-col items-center justify-center border-[6px]"
                style={{ borderColor: aqiColor, boxShadow: `0 0 24px ${aqiColor}33` }}
              >
                <span className="font-mono text-3xl font-bold tabular-nums">{activeStation.aqi}</span>
                <span className="text-[11px] font-semibold mt-0.5" style={{ color: aqiColor }}>
                  {activeStation.category}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#91A2B8] mt-3 text-center">
                City Avg AQI: <strong className="font-mono text-[#00C8FF]">{cityAvgAqi}</strong>
              </p>
            </div>

            <div className="sm:col-span-7 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 dark:bg-[#14243A] p-3">
                <p className="text-slate-400 dark:text-[#91A2B8]">PM2.5</p>
                <p className="font-mono text-lg font-semibold mt-0.5 tabular-nums">
                  {activeStation.pm25} <span className="text-[11px] font-normal">µg/m³</span>
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-[#14243A] p-3">
                <p className="text-slate-400 dark:text-[#91A2B8]">PM10</p>
                <p className="font-mono text-lg font-semibold mt-0.5 tabular-nums">
                  {activeStation.pm10} <span className="text-[11px] font-normal">µg/m³</span>
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-[#14243A] p-3">
                <p className="text-slate-400 dark:text-[#91A2B8]">NO₂ / O₃</p>
                <p className="font-mono text-base font-semibold mt-0.5 tabular-nums">
                  {activeStation.no2} / {activeStation.o3} <span className="text-[11px] font-normal">µg/m³</span>
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-[#14243A] p-3">
                <p className="text-slate-400 dark:text-[#91A2B8]">CO₂ Level</p>
                <p className="font-mono text-base font-semibold mt-0.5 tabular-nums">
                  {activeStation.co2} <span className="text-[11px] font-normal">ppm</span>
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-[#14243A] p-3 flex items-center justify-between col-span-2">
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-[#91A2B8]">
                  <Thermometer className="w-3.5 h-3.5 text-[#FFB547]" /> {activeStation.temperatureC}°C
                </span>
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-[#91A2B8]">
                  <Droplets className="w-3.5 h-3.5 text-[#00C8FF]" /> {activeStation.humidityPct}%
                </span>
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-[#91A2B8]">
                  <Volume2 className="w-3.5 h-3.5 text-[#00D69A]" /> {activeStation.noiseDb} dB
                </span>
              </div>
            </div>
          </div>

          {/* 24h Trend Chart */}
          <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-display text-base font-semibold">24-Hour AQI & PM2.5 Trend</h2>
                <p className="text-xs text-slate-500 dark:text-[#91A2B8]">{activeStation.stationName}</p>
              </div>
              <Wind className="w-4 h-4 text-[#00C8FF]" />
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={activeStation.hourlyTrend}>
                <defs>
                  <linearGradient id="envAqiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C8FF" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#00C8FF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="envPmGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D69A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00D69A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(130,170,210,0.12)" />
                <XAxis dataKey="hour" stroke="#91A2B8" fontSize={11} />
                <YAxis stroke="#91A2B8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#101D2D',
                    borderColor: 'rgba(130,170,210,0.25)',
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="aqi" name="AQI" stroke="#00C8FF" fill="url(#envAqiGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="pm25" name="PM2.5" stroke="#00D69A" fill="url(#envPmGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Map + Pollution Hotspot Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5">
          <h2 className="font-display text-base font-semibold mb-3">Environmental Sensor Network Map</h2>
          <CityMap
            stations={stations}
            showIncidents={false}
            showTraffic={false}
            showEnvironment={true}
            onSelectStation={(st) => setSelected(st)}
            className="h-[340px] w-full rounded-xl"
            zoom={11}
          />
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Pollution Hotspots & Alerts</h2>
            <span className="text-xs font-mono text-[#FFB547]">{alerts.length} Active</span>
          </div>

          <div className="space-y-3">
            {alerts.map((al) => (
              <div
                key={al.id}
                onClick={() => {
                  const found = stations.find((s) => s.id === al.stationId);
                  if (found) setSelected(found);
                }}
                className="cursor-pointer rounded-xl border border-[#FFB547]/30 bg-[#FFB547]/8 p-3.5 hover:border-[#00C8FF]/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#FFB547] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {al.stationName}
                  </span>
                  <span className="font-mono text-[#FF5263] font-semibold">AQI {al.aqi}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-[#91A2B8] mt-1">{al.reason}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-[#91A2B8] mt-2 font-mono">
                  <span>PM10: {al.pm10} µg/m³ · Noise: {al.noiseDb} dB</span>
                  <span>{formatRelativeTime(al.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-[#82AAD2]/10">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-[#91A2B8] mb-2">All Stations</h3>
            <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
              {stations.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className={`w-full flex items-center justify-between text-xs px-3 py-2 rounded-lg transition-colors ${
                    activeStation?.id === s.id
                      ? 'bg-[#00C8FF]/12 text-[#00C8FF]'
                      : 'hover:bg-slate-50 dark:hover:bg-[#14243A]'
                  }`}
                >
                  <span className="truncate">{s.stationName}</span>
                  <span className="font-mono font-semibold tabular-nums">AQI {s.aqi}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
