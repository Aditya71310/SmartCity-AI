import { useEffect, useState } from 'react';
import { Layers, MapPin, Search, X, CheckCircle2 } from 'lucide-react';
import { CityMap } from '../components/CityMap';
import { useAuth } from '../context/AuthContext';
import { apiRequest, formatRelativeTime } from '../services/api';
import type {
  CityIncident,
  EnvironmentStation,
  IncidentStatus,
  TrafficCorridor,
} from '../types/smartcity';

interface MapPayload {
  incidents: CityIncident[];
  trafficCorridors: TrafficCorridor[];
  environmentStations: EnvironmentStation[];
  demoMode: boolean;
}

const FILTER_OPTIONS = ['All', 'Waste', 'Traffic', 'Environment', 'Infrastructure', 'Drainage', 'Streetlights'];

export function MonitoringPage() {
  const { user, notify } = useAuth();
  const [data, setData] = useState<MapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showTrafficLayer, setShowTrafficLayer] = useState(true);
  const [showEnvLayer, setShowEnvLayer] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<CityIncident | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadMapData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<MapPayload>('/api/city/map-data');
      setData(res);
      if (!selectedIncident && res.incidents.length > 0) {
        setSelectedIncident(res.incidents[0]);
      }
    } catch (err) {
      notify('Map sync failed', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMapData();
  }, []);

  const filteredIncidents = (data?.incidents || []).filter((inc) => {
    const matchesCat = categoryFilter === 'All' || inc.category.toLowerCase() === categoryFilter.toLowerCase();
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      inc.title.toLowerCase().includes(q) ||
      inc.locationName.toLowerCase().includes(q) ||
      inc.ward.toLowerCase().includes(q) ||
      inc.code.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const handleUpdateIncidentStatus = async (status: IncidentStatus) => {
    if (!selectedIncident) return;
    setUpdatingStatus(true);
    try {
      const res = await apiRequest<{ incident: CityIncident }>(`/api/city/incidents/${selectedIncident.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setSelectedIncident(res.incident);
      setData((prev) =>
        prev
          ? {
              ...prev,
              incidents: prev.incidents.map((i) => (i.id === res.incident.id ? res.incident : i)),
            }
          : prev
      );
      notify('Incident updated', `${res.incident.code} marked as ${status}`, 'success');
    } catch (err) {
      notify('Update failed', (err as Error).message, 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const canModify = user?.role !== 'Citizen';

  return (
    <div className="space-y-5">
      {/* Header & Layer Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Live City Monitoring</h1>
          <p className="text-xs text-slate-500 dark:text-[#91A2B8] mt-1">
            Mumbai Geospatial Command · Simulated Municipal Feeds · {filteredIncidents.length} active markers visible
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#91A2B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter ward or incident..."
              className="rounded-xl bg-white dark:bg-[#101D2D] border border-slate-200 dark:border-[#82AAD2]/20 pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#00C8FF]"
            />
          </div>

          <button
            onClick={() => setShowTrafficLayer((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              showTrafficLayer
                ? 'bg-[#FFB547]/15 border-[#FFB547]/40 text-[#FFB547]'
                : 'bg-white dark:bg-[#101D2D] border-slate-200 dark:border-[#82AAD2]/15 text-slate-500 dark:text-[#91A2B8]'
            }`}
          >
            Traffic Corridors
          </button>
          <button
            onClick={() => setShowEnvLayer((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              showEnvLayer
                ? 'bg-[#00C8FF]/15 border-[#00C8FF]/40 text-[#00C8FF]'
                : 'bg-white dark:bg-[#101D2D] border-slate-200 dark:border-[#82AAD2]/15 text-slate-500 dark:text-[#91A2B8]'
            }`}
          >
            AQI Stations
          </button>
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-white dark:bg-[#101D2D] border border-slate-200 dark:border-[#82AAD2]/15 w-fit">
        {FILTER_OPTIONS.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              categoryFilter === cat
                ? 'bg-[#00C8FF] text-[#070D18] font-semibold'
                : 'text-slate-600 dark:text-[#91A2B8] hover:text-slate-900 dark:hover:text-[#F4F7FC]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Split: Map + Inspector Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 relative">
          {loading && !data ? (
            <div className="h-[540px] rounded-2xl bg-slate-200 dark:bg-[#101D2D] animate-pulse" />
          ) : (
            <CityMap
              incidents={filteredIncidents}
              corridors={data?.trafficCorridors || []}
              stations={data?.environmentStations || []}
              showIncidents={true}
              showTraffic={showTrafficLayer}
              showEnvironment={showEnvLayer}
              selectedId={selectedIncident?.id}
              onSelectIncident={(inc) => setSelectedIncident(inc)}
              className="h-[540px] w-full rounded-2xl"
              zoom={12}
            />
          )}

          {/* Map Legend Bar */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-[#91A2B8]">
            <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-[#00C8FF]" /> Layers:</span>
            <span>Green · Waste</span>
            <span>Amber · Traffic</span>
            <span>Red · Infrastructure</span>
            <span>Cyan · Environment / AQI</span>
          </div>
        </div>

        {/* Side Incident Detail & Queue */}
        <div className="lg:col-span-4 space-y-4">
          {selectedIncident ? (
            <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/20 bg-white dark:bg-[#101D2D] p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-xs text-[#00C8FF] font-semibold">
                    {selectedIncident.code} · {selectedIncident.category}
                  </span>
                  <h2 className="font-display text-base font-semibold mt-1 leading-snug">
                    {selectedIncident.title}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedIncident(null)}
                  className="p-1 text-slate-400 hover:text-[#F4F7FC]"
                  aria-label="Close inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-[#91A2B8] leading-relaxed">
                {selectedIncident.description}
              </p>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100 dark:border-[#82AAD2]/10">
                <div>
                  <p className="text-slate-400 dark:text-[#91A2B8]">Location</p>
                  <p className="font-medium mt-0.5">{selectedIncident.locationName}</p>
                </div>
                <div>
                  <p className="text-slate-400 dark:text-[#91A2B8]">Ward</p>
                  <p className="font-medium mt-0.5">{selectedIncident.ward}</p>
                </div>
                <div>
                  <p className="text-slate-400 dark:text-[#91A2B8]">Severity</p>
                  <p
                    className={`font-semibold mt-0.5 ${
                      selectedIncident.severity === 'Critical'
                        ? 'text-[#FF5263]'
                        : selectedIncident.severity === 'High'
                          ? 'text-[#FFB547]'
                          : 'text-[#00C8FF]'
                    }`}
                  >
                    {selectedIncident.severity}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 dark:text-[#91A2B8]">Detected</p>
                  <p className="font-mono mt-0.5">{formatRelativeTime(selectedIncident.detectedAt)}</p>
                </div>
                <div>
                  <p className="text-slate-400 dark:text-[#91A2B8]">Department</p>
                  <p className="font-medium mt-0.5">{selectedIncident.departmentName}</p>
                </div>
                <div>
                  <p className="text-slate-400 dark:text-[#91A2B8]">Current Status</p>
                  <p className="font-semibold text-[#00D69A] mt-0.5">{selectedIncident.status}</p>
                </div>
              </div>

              {canModify && (
                <div className="pt-3 border-t border-slate-100 dark:border-[#82AAD2]/10 space-y-2">
                  <p className="text-[11px] text-slate-400 dark:text-[#91A2B8]">Update Incident Status</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Assigned', 'In Progress', 'Resolved'] as IncidentStatus[]).map((st) => (
                      <button
                        key={st}
                        disabled={updatingStatus || selectedIncident.status === st}
                        onClick={() => handleUpdateIncidentStatus(st)}
                        className={`px-2.5 py-2 rounded-xl text-xs font-medium border transition-colors ${
                          selectedIncident.status === st
                            ? 'bg-[#00D69A]/15 border-[#00D69A]/40 text-[#00D69A]'
                            : 'border-slate-200 dark:border-[#82AAD2]/20 hover:border-[#00C8FF]/40'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-6 text-center">
              <MapPin className="w-7 h-7 text-[#00C8FF] mx-auto mb-2" />
              <p className="text-sm font-medium">Select a marker on the map</p>
              <p className="text-xs text-slate-500 dark:text-[#91A2B8] mt-1">
                Click any incident pin to inspect severity, ward, department, and dispatch status.
              </p>
            </div>
          )}

          {/* Filtered Incident List */}
          <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-4">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-[#91A2B8] mb-3">
              Active Incident Queue ({filteredIncidents.length})
            </h3>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {filteredIncidents.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    selectedIncident?.id === inc.id
                      ? 'border-[#00C8FF]/50 bg-[#00C8FF]/8'
                      : 'border-slate-100 dark:border-[#82AAD2]/10 hover:bg-slate-50 dark:hover:bg-[#14243A]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-[#00C8FF]">{inc.code}</span>
                    <span className="text-[11px] text-slate-400 dark:text-[#91A2B8] flex items-center gap-1">
                      {inc.status === 'Resolved' && <CheckCircle2 className="w-3 h-3 text-[#00D69A]" />}
                      {inc.status}
                    </span>
                  </div>
                  <p className="text-xs font-medium mt-1 line-clamp-1">{inc.title}</p>
                  <p className="text-[11px] text-slate-500 dark:text-[#91A2B8] mt-0.5">
                    {inc.ward} · {inc.severity}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
