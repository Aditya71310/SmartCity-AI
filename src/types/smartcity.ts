export type UserRole =
  | 'Super Admin'
  | 'Municipal Administrator'
  | 'Department Officer'
  | 'Field Officer'
  | 'Citizen';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  organisation: string;
  designation: string;
  departmentId?: string;
  avatarUrl?: string;
  active: boolean;
  emailVerified: boolean;
  notificationPrefs: {
    highPriority: boolean;
    citizenReports: boolean;
    environmentAlerts: boolean;
    taskUpdates: boolean;
  };
  createdAt: string;
}

export interface Organisation {
  id: string;
  name: string;
  code: string;
  city: string;
  jurisdiction: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  headOfficer: string;
  slaHours: number;
  activeCrewCount: number;
  efficiencyScore: number;
}

export type IncidentCategory =
  | 'Waste'
  | 'Traffic'
  | 'Environment'
  | 'Infrastructure'
  | 'Drainage'
  | 'Streetlights'
  | 'Water';

export type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low';
export type IncidentStatus = 'Open' | 'Assigned' | 'In Progress' | 'Resolved' | 'Escalated';

export interface CityIncident {
  id: string;
  code: string;
  title: string;
  description: string;
  category: IncidentCategory;
  severity: SeverityLevel;
  status: IncidentStatus;
  ward: string;
  locationName: string;
  lat: number;
  lng: number;
  departmentId: string;
  departmentName: string;
  assignedTo?: string;
  detectedAt: string;
  updatedAt: string;
  source: 'AI Vision' | 'IoT Sensor' | 'Citizen Report' | 'Traffic ML' | 'Field Inspection';
  isSimulated: boolean;
  confidence?: number;
}

export interface DetectionBox {
  label: string;
  confidence: number;
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  category?: string;
}

export interface WasteDetection {
  id: string;
  code: string;
  imageUrl: string;
  locationName: string;
  ward: string;
  lat: number;
  lng: number;
  detectedCategories: Array<{
    category: 'Plastic' | 'Organic Waste' | 'Paper' | 'Metal' | 'Mixed Garbage' | 'Illegal Dumping';
    confidence: number;
    percentage: number;
  }>;
  boxes: DetectionBox[];
  severity: SeverityLevel;
  estimatedVolumeKg: number;
  status: 'Detected' | 'Task Assigned' | 'In Progress' | 'Collected';
  analysisMode: 'Gemini Vision AI' | 'Demonstration CV Mode';
  detectedAt: string;
  isSimulated: boolean;
}

export interface WasteTask {
  id: string;
  code: string;
  detectionId: string;
  locationName: string;
  ward: string;
  teamName: string;
  vehicleId: string;
  priority: SeverityLevel;
  status: 'Pending' | 'Dispatched' | 'Collected' | 'Verified';
  assignedAt: string;
  completedAt?: string;
  notes?: string;
}

export interface TrafficCorridor {
  id: string;
  name: string;
  shortName: string;
  ward: string;
  lengthKm: number;
  lanes: number;
  currentDensity: number; // vehicles/km
  congestionPct: number; // 0-100
  avgSpeedKmph: number;
  expectedTravelMin: number;
  freeFlowTravelMin: number;
  status: 'Smooth' | 'Moderate' | 'Heavy' | 'Severe';
  coordinates: Array<[number, number]>;
  alternateRoutes: Array<{
    name: string;
    addedDistanceKm: number;
    estimatedMin: number;
    congestionPct: number;
  }>;
  accidentHotspot: boolean;
  cameraLabel: string;
  updatedAt: string;
  isSimulated: boolean;
}

export interface TrafficPredictionResult {
  corridorId: string;
  corridorName: string;
  predictedCongestionPct: number;
  predictedLevel: 'Smooth' | 'Moderate' | 'Heavy' | 'Severe';
  estimatedDensity: number;
  expectedTravelMin: number;
  deltaVsFreeFlowMin: number;
  confidence: number;
  recommendedAction: string;
  alternateRoutes: TrafficCorridor['alternateRoutes'];
  factors: Array<{ factor: string; impactPct: number }>;
}

export interface TrafficSimulationResult {
  corridorId: string;
  corridorName: string;
  eventType: 'Normal Traffic' | 'Heavy Congestion' | 'Accident' | 'Road Closure';
  simulatedCongestionPct: number;
  simulatedSpeedKmph: number;
  primaryRouteEtaMin: number;
  recommendedRoute: {
    name: string;
    estimatedMin: number;
    timeSavedMin: number;
    congestionPct: number;
  };
  emergencyCorridorMinutes: number;
  advisory: string;
}

export interface EnvironmentStation {
  id: string;
  stationName: string;
  ward: string;
  lat: number;
  lng: number;
  aqi: number;
  category: 'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very Poor';
  pm25: number;
  pm10: number;
  no2: number;
  co2: number;
  o3: number;
  temperatureC: number;
  humidityPct: number;
  noiseDb: number;
  alertActive: boolean;
  hourlyTrend: Array<{ hour: string; aqi: number; pm25: number; noiseDb: number }>;
  updatedAt: string;
  isSimulated: boolean;
}

export interface InfrastructureIssue {
  id: string;
  code: string;
  imageUrl: string;
  issueType: 'Pothole' | 'Road Crack' | 'Damaged Infrastructure' | 'Overflowing Drain' | 'Damaged Streetlight';
  locationName: string;
  ward: string;
  lat: number;
  lng: number;
  boxes: DetectionBox[];
  confidence: number;
  severity: SeverityLevel;
  recommendedPriority: 'Immediate (24h)' | 'High (48h)' | 'Scheduled (7d)' | 'Routine';
  status: 'Reported' | 'Task Created' | 'Repair In Progress' | 'Verified';
  analysisMode: 'Gemini Vision AI' | 'Demonstration CV Mode';
  detectedAt: string;
  isSimulated: boolean;
}

export interface MaintenanceTask {
  id: string;
  code: string;
  issueId: string;
  title: string;
  locationName: string;
  ward: string;
  assignedCrew: string;
  priority: SeverityLevel;
  status: 'Scheduled' | 'In Progress' | 'Verification Pending' | 'Verified';
  estimatedCostInr: number;
  assignedAt: string;
  completedAt?: string;
  verificationNotes?: string;
}

export type ReportStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Assigned'
  | 'In Progress'
  | 'Resolved'
  | 'Rejected';

export interface CitizenReport {
  id: string;
  trackingCode: string;
  citizenId: string;
  citizenName: string;
  citizenEmail: string;
  title: string;
  description: string;
  category: string;
  aiClassifiedCategory: string;
  aiPriority: SeverityLevel;
  aiRecommendedDepartment: string;
  aiConfidence: number;
  possibleDuplicateId?: string;
  possibleDuplicateCode?: string;
  ward: string;
  locationName: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  status: ReportStatus;
  linkedIncidentId?: string;
  timeline: Array<{
    status: ReportStatus;
    note: string;
    actor: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  severity: SeverityLevel;
  category: string;
  targetModule: string;
  targetId?: string;
  read: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  details: string;
  timestamp: string;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  chart?: {
    title: string;
    type: 'bar' | 'line' | 'pie';
    data: Array<{ name: string; value: number; secondary?: number }>;
  };
  referencedIncidents?: Array<{
    id: string;
    code: string;
    title: string;
    severity: SeverityLevel;
    module: string;
  }>;
  toolsUsed?: string[];
}
