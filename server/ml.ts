import type {
  TrafficCorridor,
  TrafficPredictionResult,
  TrafficSimulationResult,
} from '../src/types/smartcity.ts';

interface PredictInput {
  corridor: TrafficCorridor;
  hourOfDay: number; // 0-23
  dayOfWeek: string; // Mon-Sun
  weather: 'Clear' | 'Light Rain' | 'Heavy Monsoon' | 'Haze / Fog';
  historicalDensity?: number;
}

const HOUR_CURVE: Record<number, number> = {
  0: 0.18, 1: 0.12, 2: 0.1, 3: 0.1, 4: 0.14, 5: 0.25,
  6: 0.45, 7: 0.68, 8: 0.88, 9: 0.96, 10: 0.91, 11: 0.78,
  12: 0.72, 13: 0.7, 14: 0.68, 15: 0.72, 16: 0.79, 17: 0.89,
  18: 0.97, 19: 0.98, 20: 0.89, 21: 0.74, 22: 0.54, 23: 0.32,
};

const DAY_MULT: Record<string, number> = {
  Monday: 1.06,
  Tuesday: 1.04,
  Wednesday: 1.03,
  Thursday: 1.05,
  Friday: 1.09,
  Saturday: 0.88,
  Sunday: 0.66,
};

const WEATHER_MULT: Record<PredictInput['weather'], number> = {
  Clear: 1.0,
  'Haze / Fog': 1.08,
  'Light Rain': 1.19,
  'Heavy Monsoon': 1.38,
};

export function predictTrafficCongestion(input: PredictInput): TrafficPredictionResult {
  const { corridor, hourOfDay, dayOfWeek, weather } = input;
  const baseFactor = HOUR_CURVE[Math.max(0, Math.min(23, Math.round(hourOfDay)))] ?? 0.65;
  const dayFactor = DAY_MULT[dayOfWeek] ?? 1.0;
  const weatherFactor = WEATHER_MULT[weather] ?? 1.0;
  const histDensity = input.historicalDensity ?? corridor.currentDensity;

  // Weighted multivariate congestion score (normalized 0 - 99%)
  const densitySignal = Math.min(100, (histDensity / (corridor.lanes * 34)) * 100);
  const rawScore = (baseFactor * 52 + densitySignal * 0.48) * dayFactor * weatherFactor;
  const predictedCongestionPct = Math.round(Math.max(8, Math.min(99, rawScore)));

  const estimatedDensity = Math.round((predictedCongestionPct / 100) * corridor.lanes * 35);
  const predictedSpeedKmph = Math.max(
    8,
    Math.round(64 * (1 - predictedCongestionPct / 118))
  );
  const expectedTravelMin = Math.max(
    corridor.freeFlowTravelMin,
    Math.round((corridor.lengthKm / predictedSpeedKmph) * 60)
  );
  const deltaVsFreeFlowMin = Math.max(0, expectedTravelMin - corridor.freeFlowTravelMin);

  let predictedLevel: TrafficPredictionResult['predictedLevel'] = 'Smooth';
  if (predictedCongestionPct >= 80) predictedLevel = 'Severe';
  else if (predictedCongestionPct >= 62) predictedLevel = 'Heavy';
  else if (predictedCongestionPct >= 38) predictedLevel = 'Moderate';

  let recommendedAction = 'Maintain standard corridor monitoring and automated variable message signs.';
  if (predictedLevel === 'Severe') {
    recommendedAction = `Issue commuter diversion advisory toward ${corridor.alternateRoutes[0]?.name || 'parallel arterial'} and pre-stage traffic patrol units at bottlenecks.`;
  } else if (predictedLevel === 'Heavy') {
    recommendedAction = `Trigger congestion advisory for ${corridor.shortName} and prioritize public transit bus bay clearance.`;
  } else if (predictedLevel === 'Moderate') {
    recommendedAction = 'Monitor ramp merge density; prepare overflow diversion signage if density rises >10%.';
  }

  const timeImpact = Math.round(baseFactor * 45);
  const weatherImpact = Math.round((weatherFactor - 1) * 100);
  const histImpact = Math.round((densitySignal / 100) * 38);
  const dayImpact = Math.round((dayFactor - 0.6) * 35);

  return {
    corridorId: corridor.id,
    corridorName: corridor.name,
    predictedCongestionPct,
    predictedLevel,
    estimatedDensity,
    expectedTravelMin,
    deltaVsFreeFlowMin,
    confidence: weather === 'Heavy Monsoon' ? 88 : 93,
    recommendedAction,
    alternateRoutes: corridor.alternateRoutes,
    factors: [
      { factor: `Peak Hour Profile (${hourOfDay}:00)`, impactPct: timeImpact },
      { factor: 'Historical Corridor Density', impactPct: histImpact },
      { factor: `Weather (${weather})`, impactPct: Math.max(4, weatherImpact) },
      { factor: `Day Pattern (${dayOfWeek})`, impactPct: Math.max(6, dayImpact) },
    ],
  };
}

export function simulateTrafficEvent(
  corridor: TrafficCorridor,
  eventType: TrafficSimulationResult['eventType']
): TrafficSimulationResult {
  const multipliers: Record<TrafficSimulationResult['eventType'], number> = {
    'Normal Traffic': 0.72,
    'Heavy Congestion': 1.24,
    Accident: 1.48,
    'Road Closure': 1.75,
  };

  const simulatedCongestionPct = Math.min(
    99,
    Math.max(18, Math.round(corridor.congestionPct * multipliers[eventType]))
  );

  const simulatedSpeedKmph =
    eventType === 'Road Closure'
      ? 0
      : Math.max(6, Math.round(corridor.avgSpeedKmph / multipliers[eventType]));

  const primaryRouteEtaMin =
    eventType === 'Road Closure'
      ? corridor.expectedTravelMin + 42
      : Math.max(
          corridor.freeFlowTravelMin,
          Math.round((corridor.lengthKm / Math.max(5, simulatedSpeedKmph)) * 60)
        );

  const bestAlt = [...corridor.alternateRoutes].sort((a, b) => a.estimatedMin - b.estimatedMin)[0] ?? {
    name: 'Coastal Service Arterial',
    addedDistanceKm: 2.1,
    estimatedMin: Math.max(12, corridor.freeFlowTravelMin + 5),
    congestionPct: 44,
  };

  const altAdjustedMin =
    eventType === 'Road Closure' || eventType === 'Accident'
      ? bestAlt.estimatedMin + 4
      : bestAlt.estimatedMin;

  const timeSavedMin = Math.max(0, primaryRouteEtaMin - altAdjustedMin);

  const emergencyCorridorMinutes =
    eventType === 'Road Closure'
      ? Math.round(altAdjustedMin * 0.62)
      : Math.round(Math.min(primaryRouteEtaMin, altAdjustedMin) * 0.58);

  const advisoryMap: Record<TrafficSimulationResult['eventType'], string> = {
    'Normal Traffic': `Simulated baseline flow on ${corridor.name}. Primary corridor remains fastest option.`,
    'Heavy Congestion': `Simulated bottleneck on ${corridor.name}. Diverting eastbound commercial traffic to ${bestAlt.name} saves ~${timeSavedMin} min.`,
    Accident: `Simulated lane blockage incident on ${corridor.name}. Emergency response corridor routed via ${bestAlt.name} (${emergencyCorridorMinutes} min clearance ETA).`,
    'Road Closure': `Simulated full closure on ${corridor.name}. Mandatory detour activated via ${bestAlt.name}; note: signal timing changes require municipal traffic control authorization.`,
  };

  return {
    corridorId: corridor.id,
    corridorName: corridor.name,
    eventType,
    simulatedCongestionPct,
    simulatedSpeedKmph,
    primaryRouteEtaMin,
    recommendedRoute: {
      name: bestAlt.name,
      estimatedMin: altAdjustedMin,
      timeSavedMin,
      congestionPct: Math.min(89, bestAlt.congestionPct + (eventType === 'Road Closure' ? 14 : 6)),
    },
    emergencyCorridorMinutes,
    advisory: advisoryMap[eventType],
  };
}
