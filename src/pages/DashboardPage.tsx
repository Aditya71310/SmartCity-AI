import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  CloudSun,
  Gauge,
  RefreshCw,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { apiRequest, formatRelativeTime } from '../services/api';
import { CityMap } from '../components/CityMap';
import type { NavPageId } from '../components/SidebarLayout';
import type { ActivityLog, CityIncident } from '../types/smartcity';

interface DashboardOverview {
  demoMode: boolean;
  city: string;
  kpis: {
    totalActiveReports: number;
    resolvedComplaints: number;
    inProgress: number;
    highPriority: number;
    cityServiceEfficiency: number;
    avgAqi: number;
  };
  departmentDistribution: Array<{
    name: string;
    fullName: string;
    active: number;
    resolved: number;
    efficiency: number;
  }>;
  weeklyTrends: Array<{ day: string; reported: number; resolved: number }>;
  priorityAlerts: CityIncident[];
  mapPoints: CityIncident[];
}

interface WeatherData {
  city: string;
  temperatureC: number;
  humidityPct: number;
  windKmph: number;
  condition: string;
  source: string;
}

const HERO_IMAGE = '/src/assets/images/mumbai_skyline_hero_1794656028817.jpg';

export function DashboardPage({ onNavigate }: { onNavigate: (page: NavPageId) => void }) {
  const { user, selectedCity, notify } = useAuth();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, act, w] = await Promise.all([
        apiRequest<DashboardOverview>('/api/dashboard/overview'),
        apiRequest<{ logs: ActivityLog[] }>('/api/dashboard/activity'),
        apiRequest<WeatherData>('/api/weather'),
      ]);
      setOverview(ov);
      setActivity(act.logs);
      setWeather(w);
    } catch (err) {
      setError((err as Error).message);
      notify('Dashboard load failed', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCity]);

  const mapCategoryToModule = (cat: string): NavPageId => {
    const c = cat.toLowerCase();
    if (c === 'waste') return 'waste';
    if (c === 'traffic') return 'traffic';
    if (c === 'environment') return 'environment';
    if (c === 'infrastructure') return 'infrastructure';
    return 'monitoring';
  };

  if (loading && !overview) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-44 rounded-2xl bg-slate-200 dark:bg-[#101D2D]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-200 dark:bg-[#101D2D]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-80 rounded-2xl bg-slate-200 dark:bg-[#101D2D]" />
          <div className="lg:col-span-5 h-80 rounded-2xl bg-slate-200 dark:bg-[#101D2D]" />
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="rounded-2xl border border-[#FF5263]/30 bg-[#101D2D] p-8 text-center">
        <p className="text-sm text-[#FF5263] font-semibold">Unable to load dashboard telemetry</p>
        <p className="text-xs text-[#91A2B8] mt-1">{error}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 rounded-xl bg-[#00C8FF] text-[#070D18] text-xs font-semibold"
        >
          Retry Sync
        </button>
      </div>
    );
  }

  const kpis = overview!.kpis;

  const kpiCards: Array<{
    label: string;
    value: string | number;
    subtext: string;
    color: string;
    target: NavPageId;
    icon: typeof Activity;
  }> = [
    {
      label: 'Total Active Reports',
      value: kpis.totalActiveReports,
      subtext: 'Open across 24 wards',
      color: 'text-[#00C8FF]',
      target: 'reports',
      icon: Activity,
    },
    {
      label: 'Resolved Complaints',
      value: kpis.resolvedComplaints,
      subtext: 'Verified field closures',
      color: 'text-[#00D69A]',
      target: 'analytics',
      icon: CheckCircle2,
    },
    {
      label: 'Issues In Progress',
      value: kpis.inProgress,
      subtext: 'Crews actively dispatched',
      color: 'text-[#FFB547]',
      target: 'monitoring',
      icon: Clock,
    },
    {
      label: 'High Priority Incidents',
      value: kpis.highPriority,
      subtext: 'Critical & High SLA queue',
      color: 'text-[#FF5263]',
      target: 'infrastructure',
      icon: AlertTriangle,
    },
    {
      label: 'City Service Efficiency',
      value: `${kpis.cityServiceEfficiency}%`,
      subtext: `City Avg AQI · ${kpis.avgAqi}`,
      color: 'text-[#00D69A]',
      target: 'environment',
      icon: Gauge,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-[#82AAD2]/20 bg-[#091321] min-h-[176px] flex flex-col md:flex-row md:items-center justify-between p-6 sm:p-8 gap-6">
        <img
          src={HERO_IMAGE}
          alt="Mumbai Smart City Command Skyline"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070D18]/95 via-[#070D18]/75 to-[#070D18]/65" />

        <div className="relative z-10 max-w-2xl">
          <p className="text-xs font-medium text-[#00C8FF] mb-1.5">
            {selectedCity} Command Centre · Simulated Demo Telemetry
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F7FC] tracking-tight [text-wrap:balance]">
            Good Morning, {user?.role === 'Municipal Administrator' || user?.role === 'Super Admin' ? 'Administrator' : user?.fullName}
          </h1>
          <p className="text-sm text-[#91A2B8] mt-1.5">
            Your city. Your intelligence. Your control.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          {weather && (
            <div className="flex items-center gap-3 rounded-xl border border-[#82AAD2]/25 bg-[#101D2D]/85 backdrop-blur-md px-4 py-2.5">
              <CloudSun className="w-7 h-7 text-[#FFB547]" />
              <div>
                <p className="font-mono text-lg font-semibold text-[#F4F7FC] leading-none tabular-nums">
                  {weather.temperatureC}°C
                </p>
                <p className="text-[11px] text-[#91A2B8] mt-1">
                  {weather.condition} · {weather.humidityPct}% RH
                </p>
              </div>
            </div>
          )}
          <button
            onClick={loadData}
            className="flex items-center gap-2 rounded-xl border border-[#82AAD2]/25 bg-[#101D2D]/85 hover:bg-[#14243A] px-3.5 py-2.5 text-xs font-medium text-[#F4F7FC] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#00C8FF] ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </section>

      {/* 5 Clickable KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              onClick={() => onNavigate(card.target)}
              className="group text-left rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] hover:border-[#00C8FF]/45 p-5 transition-all duration-150"
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-5 h-5 ${card.color}`} />
                <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-[#91A2B8] group-hover:text-[#00C8FF] transition-colors" />
              </div>
              <p className={`mt-3 font-mono text-2xl sm:text-3xl font-semibold tabular-nums ${card.color}`}>
                {card.value}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-[#F4F7FC]">{card.label}</p>
              <p className="text-xs text-slate-500 dark:text-[#91A2B8] mt-0.5">{card.subtext}</p>
            </button>
          );
        })}
      </section>

      {/* City Overview Map + Weekly Trends */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Mumbai Live Geospatial Overview</h2>
              <p className="text-xs text-slate-500 dark:text-[#91A2B8]">
                Active incidents across Waste, Traffic, Environment & Infrastructure
              </p>
            </div>
            <button
              onClick={() => onNavigate('monitoring')}
              className="text-xs font-medium text-[#00C8FF] hover:underline whitespace-nowrap"
            >
              Open Full Map
            </button>
          </div>
          <CityMap
            incidents={overview!.mapPoints}
            onSelectIncident={(inc) => onNavigate(mapCategoryToModule(inc.category))}
            className="h-[320px] w-full rounded-xl"
          />
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Weekly Incident & Resolution Trend</h2>
              <p className="text-xs text-slate-500 dark:text-[#91A2B8]">Reported vs. resolved daily volume</p>
            </div>
            <button
              onClick={() => onNavigate('analytics')}
              className="text-xs font-medium text-[#00C8FF] hover:underline whitespace-nowrap"
            >
              Analytics
            </button>
          </div>
          <div className="flex-1 min-h-[280px]">
            <ResponsiveContainer width="100%" height={290}>
              <AreaChart data={overview!.weeklyTrends}>
                <defs>
                  <linearGradient id="dashRep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C8FF" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#00C8FF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashRes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D69A" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#00D69A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(130,170,210,0.12)" />
                <XAxis dataKey="day" stroke="#91A2B8" fontSize={12} />
                <YAxis stroke="#91A2B8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#101D2D',
                    borderColor: 'rgba(130,170,210,0.25)',
                    borderRadius: 12,
                    color: '#F4F7FC',
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="reported" name="Reported" stroke="#00C8FF" fill="url(#dashRep)" strokeWidth={2} />
                <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#00D69A" fill="url(#dashRes)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Department Issue Distribution + Recent Live Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Department Issue Distribution</h2>
              <p className="text-xs text-slate-500 dark:text-[#91A2B8]">Active vs. resolved workload by department</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={overview!.departmentDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(130,170,210,0.12)" />
              <XAxis dataKey="name" stroke="#91A2B8" fontSize={11} />
              <YAxis stroke="#91A2B8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#101D2D',
                  borderColor: 'rgba(130,170,210,0.25)',
                  borderRadius: 12,
                  color: '#F4F7FC',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="active" name="Active" fill="#FFB547" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolved" name="Resolved" fill="#00D69A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Live Municipal Activity Feed</h2>
              <p className="text-xs text-slate-500 dark:text-[#91A2B8]">Real-time AI detections, dispatches & citizen updates</p>
            </div>
            <button
              onClick={() => onNavigate('settings')}
              className="text-xs font-medium text-[#00C8FF] hover:underline"
            >
              Audit Logs
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#82AAD2]/10 max-h-[250px] overflow-y-auto pr-1">
            {activity.slice(0, 8).map((log) => (
              <div key={log.id} className="py-2.5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-[#F4F7FC]">
                    {log.action} <span className="text-[#00C8FF]">· {log.module}</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-[#91A2B8] mt-0.5 truncate">{log.details}</p>
                </div>
                <span className="font-mono text-[11px] text-slate-400 dark:text-[#91A2B8] shrink-0 tabular-nums">
                  {formatRelativeTime(log.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Priority Alerts Table */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Priority Municipal Alerts</h2>
            <p className="text-xs text-slate-500 dark:text-[#91A2B8]">Click any alert to open its operational module</p>
          </div>
          <button
            onClick={() => onNavigate('monitoring')}
            className="text-xs font-medium text-[#00C8FF] hover:underline"
          >
            View All Incidents
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#82AAD2]/15 text-[11px] font-medium text-slate-500 dark:text-[#91A2B8]">
                <th className="py-2.5 pr-4">Incident</th>
                <th className="py-2.5 pr-4">Location</th>
                <th className="py-2.5 pr-4">Category</th>
                <th className="py-2.5 pr-4">Priority</th>
                <th className="py-2.5 pr-4">Department</th>
                <th className="py-2.5 pr-4">Status</th>
                <th className="py-2.5 text-right">Detected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#82AAD2]/10 text-xs">
              {overview!.priorityAlerts.map((inc) => (
                <tr
                  key={inc.id}
                  onClick={() => onNavigate(mapCategoryToModule(inc.category))}
                  className="hover:bg-slate-50 dark:hover:bg-[#14243A] cursor-pointer transition-colors"
                >
                  <td className="py-3 pr-4 font-medium text-slate-900 dark:text-[#F4F7FC] max-w-[260px] truncate">
                    <span className="font-mono text-[#00C8FF] mr-2">{inc.code}</span>
                    {inc.title}
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-[#91A2B8] whitespace-nowrap">{inc.ward}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{inc.category}</td>
                  <td className="py-3 pr-4 whitespace-nowrap font-semibold">
                    <span
                      className={
                        inc.severity === 'Critical'
                          ? 'text-[#FF5263]'
                          : inc.severity === 'High'
                            ? 'text-[#FFB547]'
                            : 'text-[#00C8FF]'
                      }
                    >
                      {inc.severity}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-[#91A2B8] whitespace-nowrap">{inc.departmentName}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">{inc.status}</td>
                  <td className="py-3 text-right font-mono text-slate-500 dark:text-[#91A2B8] tabular-nums whitespace-nowrap">
                    {formatRelativeTime(inc.detectedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
