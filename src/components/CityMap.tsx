import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Compass, Layers, LocateFixed } from 'lucide-react';
import type {
  CityIncident,
  EnvironmentStation,
  TrafficCorridor,
} from '../types/smartcity';

export type MapStyleMode = 'hybrid' | 'satellite' | 'street' | 'dark';

export interface CityMapProps {
  incidents?: CityIncident[];
  corridors?: TrafficCorridor[];
  stations?: EnvironmentStation[];
  showIncidents?: boolean;
  showTraffic?: boolean;
  showEnvironment?: boolean;
  selectedId?: string | null;
  onSelectIncident?: (incident: CityIncident) => void;
  onSelectStation?: (station: EnvironmentStation) => void;
  onSelectCorridor?: (corridor: TrafficCorridor) => void;
  center?: [number, number];
  zoom?: number;
  className?: string;
  defaultStyle?: MapStyleMode;
}

const CATEGORY_COLORS: Record<string, string> = {
  Waste: '#00D69A',
  Traffic: '#FFB547',
  Environment: '#00C8FF',
  Infrastructure: '#FF5263',
  Drainage: '#38BDF8',
  Streetlights: '#FBBF24',
  Water: '#60A5FA',
};

const CORRIDOR_COLORS: Record<TrafficCorridor['status'], string> = {
  Smooth: '#00D69A',
  Moderate: '#00C8FF',
  Heavy: '#FFB547',
  Severe: '#FF5263',
};

const MAP_STYLE_OPTIONS: Array<{ id: MapStyleMode; label: string }> = [
  { id: 'hybrid', label: 'Satellite' },
  { id: 'street', label: 'Street' },
  { id: 'dark', label: 'Tactical' },
];

export function CityMap({
  incidents = [],
  corridors = [],
  stations = [],
  showIncidents = true,
  showTraffic = true,
  showEnvironment = true,
  selectedId,
  onSelectIncident,
  onSelectStation,
  onSelectCorridor,
  center = [19.062, 72.855],
  zoom = 12,
  className = 'h-[420px] w-full rounded-xl overflow-hidden',
  defaultStyle = 'hybrid',
}: CityMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const overlayLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyleMode>(defaultStyle);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
      maxZoom: 18,
    });

    const baseGroup = L.layerGroup().addTo(map);
    const overlayGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    baseLayerGroupRef.current = baseGroup;
    overlayLayerGroupRef.current = overlayGroup;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      baseLayerGroupRef.current = null;
      overlayLayerGroupRef.current = null;
    };
  }, []);

  // Switch photorealistic / street / tactical basemap layers with zero API keys
  useEffect(() => {
    const map = mapRef.current;
    const baseGroup = baseLayerGroupRef.current;
    if (!map || !baseGroup) return;

    baseGroup.clearLayers();
    const container = map.getContainer();
    container.dataset.mapStyle = mapStyle;

    if (mapStyle === 'hybrid' || mapStyle === 'satellite') {
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
          maxZoom: 18,
          className: 'smartcity-satellite-tiles',
        }
      ).addTo(baseGroup);

      if (mapStyle === 'hybrid') {
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom: 18,
            opacity: 0.62,
          }
        ).addTo(baseGroup);

        L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
          {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 18,
            opacity: 0.95,
          }
        ).addTo(baseGroup);
      }
    } else if (mapStyle === 'street') {
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Map &copy; Esri &amp; OpenStreetMap contributors',
          maxZoom: 18,
        }
      ).addTo(baseGroup);
    } else {
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; OpenStreetMap &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 19,
        }
      ).addTo(baseGroup);
    }
  }, [mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    const group = overlayLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (showTraffic) {
      corridors.forEach((corridor) => {
        const color = CORRIDOR_COLORS[corridor.status] || '#00C8FF';
        const isSelected = selectedId === corridor.id;

        // Luminous outer halo for crisp readability over realistic satellite imagery
        L.polyline(corridor.coordinates, {
          color,
          weight: isSelected ? 13 : 9,
          opacity: isSelected ? 0.34 : 0.2,
          interactive: false,
        }).addTo(group);

        const poly = L.polyline(corridor.coordinates, {
          color,
          weight: isSelected ? 6 : 4,
          opacity: isSelected ? 1 : 0.9,
        }).addTo(group);

        poly.bindTooltip(
          `<div style="font-size:12px;"><strong>${corridor.shortName}</strong><br/>Congestion: ${corridor.congestionPct}% · ${corridor.avgSpeedKmph} km/h</div>`,
          { sticky: true }
        );
        if (onSelectCorridor) {
          poly.on('click', () => onSelectCorridor(corridor));
        }
      });
    }

    if (showEnvironment) {
      stations.forEach((st) => {
        const color = st.aqi > 140 ? '#FF5263' : st.aqi > 90 ? '#FFB547' : '#00D69A';

        L.circle([st.lat, st.lng], {
          radius: 950,
          color,
          weight: 1,
          opacity: 0.42,
          dashArray: '4 4',
          fillColor: color,
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(group);

        const icon = L.divIcon({
          className: 'custom-env-marker',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:rgba(7,13,24,0.92);border:2px solid ${color};color:#F4F7FC;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;box-shadow:0 2px 14px ${color}66;">${st.aqi}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const marker = L.marker([st.lat, st.lng], { icon }).addTo(group);
        marker.bindTooltip(
          `<div style="font-size:12px;"><strong>${st.stationName}</strong><br/>AQI: ${st.aqi} (${st.category}) · PM2.5: ${st.pm25} µg/m³</div>`
        );
        if (onSelectStation) {
          marker.on('click', () => onSelectStation(st));
        }
      });
    }

    if (showIncidents) {
      incidents.forEach((inc) => {
        const color = CATEGORY_COLORS[inc.category] || '#00C8FF';
        const isCritical = inc.severity === 'Critical' || inc.severity === 'High';
        const isSelected = selectedId === inc.id;
        const size = isSelected ? 22 : 16;

        const icon = L.divIcon({
          className: 'custom-inc-marker',
          html: `<div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
            ${isCritical ? `<span class="marker-pulse-ring" style="position:absolute;inset:-5px;border-radius:9999px;border:2px solid ${color};"></span>` : ''}
            <span style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid #070D18;box-shadow:0 0 14px ${color}, 0 2px 6px rgba(0,0,0,0.65);display:block;"></span>
          </div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([inc.lat, inc.lng], { icon }).addTo(group);
        marker.bindTooltip(
          `<div style="font-size:12px;"><strong>${inc.code}</strong> · ${inc.category}<br/>${inc.locationName}<br/>Severity: ${inc.severity} · ${inc.status}</div>`
        );
        if (onSelectIncident) {
          marker.on('click', () => onSelectIncident(inc));
        }
      });
    }
  }, [
    incidents,
    corridors,
    stations,
    showIncidents,
    showTraffic,
    showEnvironment,
    selectedId,
    onSelectIncident,
    onSelectStation,
    onSelectCorridor,
  ]);

  const handleRecenter = () => {
    mapRef.current?.flyTo(center, zoom, { duration: 0.7 });
  };

  return (
    <div className={`${className} border border-[#82AAD2]/20 bg-[#070D18] relative z-0`}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Top-right basemap style & recenter controls */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-1.5 pointer-events-auto">
        <div
          className="flex items-center gap-0.5 p-1 rounded-lg bg-[#091321]/88 backdrop-blur-md border border-[#82AAD2]/25 shadow-lg"
          role="group"
          aria-label="Map layer style"
        >
          <span className="px-1.5 text-[#00C8FF]" aria-hidden="true">
            <Layers className="w-3.5 h-3.5" />
          </span>
          {MAP_STYLE_OPTIONS.map((opt) => {
            const active =
              opt.id === mapStyle || (opt.id === 'hybrid' && mapStyle === 'satellite');
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMapStyle(opt.id)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#00C8FF]/20 text-[#00C8FF] border border-[#00C8FF]/45'
                    : 'text-[#91A2B8] hover:text-[#F4F7FC] border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
          {mapStyle === 'hybrid' && (
            <button
              type="button"
              onClick={() => setMapStyle('satellite')}
              title="Hide labels for pure aerial view"
              className="px-2 py-1 rounded-md text-[11px] font-medium text-[#91A2B8] hover:text-[#00D69A] border border-transparent transition-colors whitespace-nowrap cursor-pointer"
            >
              Pure Aerial
            </button>
          )}
          {mapStyle === 'satellite' && (
            <button
              type="button"
              onClick={() => setMapStyle('hybrid')}
              title="Show roads and neighborhood labels"
              className="px-2 py-1 rounded-md text-[11px] font-medium bg-[#00D69A]/15 text-[#00D69A] border border-[#00D69A]/40 transition-colors whitespace-nowrap cursor-pointer"
            >
              + Labels
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleRecenter}
          title="Recenter on Mumbai Metropolitan Region"
          aria-label="Recenter map"
          className="p-2 rounded-lg bg-[#091321]/88 backdrop-blur-md border border-[#82AAD2]/25 text-[#91A2B8] hover:text-[#00C8FF] hover:border-[#00C8FF]/50 shadow-lg transition-colors cursor-pointer"
        >
          <LocateFixed className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Subtle telemetry coordinate badge */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#091321]/82 backdrop-blur-md border border-[#82AAD2]/20 text-[10px] font-mono text-[#91A2B8]">
        <Compass className="w-3 h-3 text-[#00C8FF]" />
        <span className="tabular-nums">
          {center[0].toFixed(3)}°N, {center[1].toFixed(3)}°E · MUMBAI GIS
        </span>
      </div>
    </div>
  );
}
