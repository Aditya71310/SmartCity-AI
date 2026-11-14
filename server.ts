import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import {
  hashPassword,
  requireAuth,
  requireRoles,
  signSessionToken,
  verifyPassword,
  type AuthedRequest,
} from './server/auth.ts';
import { getDb, resetDbToSeed, saveDb, type StoredUser } from './server/db.ts';
import { predictTrafficCongestion, simulateTrafficEvent } from './server/ml.ts';
import {
  analyzeInfrastructureImageWithAI,
  analyzeWasteImageWithAI,
  runCopilotChat,
  triageCitizenReportWithAI,
} from './server/ai.ts';
import type {
  CitizenReport,
  CityIncident,
  IncidentStatus,
  ReportStatus,
  UserRole,
} from './src/types/smartcity.ts';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

function sanitizeUser(u: StoredUser) {
  const { passwordHash: _, ...profile } = u;
  return profile;
}

function appendLog(actorName: string, actorRole: string, action: string, module: string, details: string) {
  const db = getDb();
  db.activityLogs.unshift({
    id: `act-${crypto.randomUUID().slice(0, 8)}`,
    actorName,
    actorRole,
    action,
    module,
    details,
    timestamp: new Date().toISOString(),
  });
  db.activityLogs = db.activityLogs.slice(0, 80);
  saveDb(db);
}

// ==========================================
// AUTHENTICATION & PROFILES
// ==========================================

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const db = getDb();
  const user = db.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!user || !verifyPassword(String(password), user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (!user.active) {
    return res.status(403).json({ error: 'This account has been deactivated by an administrator.' });
  }
  const token = signSessionToken(user.id, user.role);
  appendLog(user.fullName, user.role, 'Signed In', 'Authentication', `Session started for ${user.email}`);
  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/demo-login', (req, res) => {
  const { role } = req.body ?? {};
  const db = getDb();
  const user = db.users.find((u) => u.role === role && u.active) || db.users[0];
  const token = signSessionToken(user.id, user.role);
  appendLog(user.fullName, user.role, 'Demo Quick-Login', 'Authentication', `Entered platform as ${user.role}`);
  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/register', (req, res) => {
  const { fullName, email, password, organisation, designation, role } = req.body ?? {};
  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  const db = getDb();
  const normalizedEmail = String(email).trim().toLowerCase();
  if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }
  const allowedRoles: UserRole[] = [
    'Super Admin',
    'Municipal Administrator',
    'Department Officer',
    'Field Officer',
    'Citizen',
  ];
  const assignedRole: UserRole = allowedRoles.includes(role) ? role : 'Citizen';

  const newUser: StoredUser = {
    id: `usr-${crypto.randomUUID().slice(0, 8)}`,
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    role: assignedRole,
    organisation: String(organisation || 'Mumbai Civic Portal').trim(),
    designation: String(designation || (assignedRole === 'Citizen' ? 'Mumbai Resident' : 'Municipal Staff')).trim(),
    active: true,
    emailVerified: true,
    notificationPrefs: {
      highPriority: true,
      citizenReports: true,
      environmentAlerts: true,
      taskUpdates: true,
    },
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(String(password)),
  };

  db.users.push(newUser);
  saveDb(db);
  appendLog(newUser.fullName, newUser.role, 'Registered Account', 'Authentication', `Created ${assignedRole} account`);
  const token = signSessionToken(newUser.id, newUser.role);
  res.status(201).json({ token, user: sanitizeUser(newUser) });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  const db = getDb();
  const exists = db.users.some((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
  res.json({
    ok: true,
    message: exists
      ? `Password reset instructions dispatched to ${email} (demo environment: default password remains SmartCity@2026).`
      : `If an account exists for ${email}, reset instructions have been dispatched.`,
  });
});

app.get('/api/profile', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.authUser });
});

app.put('/api/profile', requireAuth, (req: AuthedRequest, res) => {
  const db = getDb();
  const idx = db.users.findIndex((u) => u.id === req.authUser!.id);
  if (idx === -1) return res.status(404).json({ error: 'Profile not found.' });
  const { fullName, organisation, designation, notificationPrefs } = req.body ?? {};
  if (fullName) db.users[idx].fullName = String(fullName).trim();
  if (organisation) db.users[idx].organisation = String(organisation).trim();
  if (designation) db.users[idx].designation = String(designation).trim();
  if (notificationPrefs) {
    db.users[idx].notificationPrefs = {
      ...db.users[idx].notificationPrefs,
      ...notificationPrefs,
    };
  }
  saveDb(db);
  res.json({ user: sanitizeUser(db.users[idx]) });
});

// ==========================================
// WEATHER & DASHBOARD
// ==========================================

app.get('/api/weather', requireAuth, async (_req, res) => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const resp = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=19.076&longitude=72.8777&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (resp.ok) {
      const data: any = await resp.json();
      const current = data.current;
      const code = Number(current?.weather_code ?? 1);
      const condition =
        code >= 61 ? 'Rain Showers' : code >= 45 ? 'Coastal Haze' : code >= 2 ? 'Partly Cloudy' : 'Clear Sky';
      return res.json({
        city: 'Mumbai',
        temperatureC: Math.round(Number(current?.temperature_2m ?? 29)),
        humidityPct: Math.round(Number(current?.relative_humidity_2m ?? 68)),
        windKmph: Math.round(Number(current?.wind_speed_10m ?? 14)),
        condition,
        source: 'Open-Meteo Live API',
      });
    }
  } catch {
    // Fallback below
  }
  res.json({
    city: 'Mumbai',
    temperatureC: 29,
    humidityPct: 67,
    windKmph: 16,
    condition: 'Partly Cloudy',
    source: 'Simulated Mumbai Telemetry',
  });
});

app.get('/api/dashboard/overview', requireAuth, (_req, res) => {
  const db = getDb();
  const totalActiveReports = db.incidents.filter((i) => i.status !== 'Resolved').length +
    db.citizenReports.filter((r) => r.status !== 'Resolved' && r.status !== 'Rejected').length;
  const resolvedComplaints = db.incidents.filter((i) => i.status === 'Resolved').length +
    db.citizenReports.filter((r) => r.status === 'Resolved').length;
  const inProgress = db.incidents.filter((i) => i.status === 'In Progress' || i.status === 'Assigned').length;
  const highPriority = db.incidents.filter(
    (i) => (i.severity === 'Critical' || i.severity === 'High') && i.status !== 'Resolved'
  ).length;
  const cityServiceEfficiency = Math.round(
    db.departments.reduce((sum, d) => sum + d.efficiencyScore, 0) / db.departments.length
  );

  const departmentDistribution = db.departments.map((d) => ({
    name: d.code,
    fullName: d.name,
    active: db.incidents.filter((i) => i.departmentId === d.id && i.status !== 'Resolved').length,
    resolved: db.incidents.filter((i) => i.departmentId === d.id && i.status === 'Resolved').length,
    efficiency: d.efficiencyScore,
  }));

  const weeklyTrends = [
    { day: 'Mon', reported: 42, resolved: 35 },
    { day: 'Tue', reported: 48, resolved: 39 },
    { day: 'Wed', reported: 38, resolved: 36 },
    { day: 'Thu', reported: 54, resolved: 46 },
    { day: 'Fri', reported: 61, resolved: 51 },
    { day: 'Sat', reported: 36, resolved: 33 },
    { day: 'Sun', reported: 29, resolved: 27 },
  ];

  const avgAqi = Math.round(
    db.environmentStations.reduce((s, st) => s + st.aqi, 0) / db.environmentStations.length
  );

  res.json({
    demoMode: db.meta.demoMode,
    city: db.meta.city,
    kpis: {
      totalActiveReports,
      resolvedComplaints,
      inProgress,
      highPriority,
      cityServiceEfficiency,
      avgAqi,
    },
    departmentDistribution,
    weeklyTrends,
    priorityAlerts: db.incidents
      .filter((i) => i.status !== 'Resolved')
      .sort((a, b) => {
        const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        return order[a.severity] - order[b.severity];
      })
      .slice(0, 6),
    mapPoints: db.incidents.slice(0, 12),
  });
});

app.get('/api/dashboard/activity', requireAuth, (_req, res) => {
  const db = getDb();
  res.json({
    logs: db.activityLogs.slice(0, 16),
    demoMode: db.meta.demoMode,
  });
});

// ==========================================
// LIVE CITY MONITORING
// ==========================================

app.get('/api/city/incidents', requireAuth, (req, res) => {
  const db = getDb();
  const { category, severity, status, q } = req.query;
  let items = db.incidents;
  if (category && category !== 'All') {
    items = items.filter((i) => i.category.toLowerCase() === String(category).toLowerCase());
  }
  if (severity && severity !== 'All') {
    items = items.filter((i) => i.severity.toLowerCase() === String(severity).toLowerCase());
  }
  if (status && status !== 'All') {
    items = items.filter((i) => i.status.toLowerCase() === String(status).toLowerCase());
  }
  if (q) {
    const query = String(q).toLowerCase();
    items = items.filter(
      (i) =>
        i.title.toLowerCase().includes(query) ||
        i.ward.toLowerCase().includes(query) ||
        i.locationName.toLowerCase().includes(query) ||
        i.code.toLowerCase().includes(query)
    );
  }
  res.json({ incidents: items, total: items.length, demoMode: db.meta.demoMode });
});

app.get('/api/city/map-data', requireAuth, (_req, res) => {
  const db = getDb();
  res.json({
    incidents: db.incidents,
    wasteDetections: db.wasteDetections,
    trafficCorridors: db.trafficCorridors,
    environmentStations: db.environmentStations,
    infrastructureIssues: db.infrastructureIssues,
    demoMode: db.meta.demoMode,
  });
});

app.patch(
  '/api/city/incidents/:id',
  requireAuth,
  requireRoles('Super Admin', 'Municipal Administrator', 'Department Officer', 'Field Officer'),
  (req: AuthedRequest, res) => {
    const db = getDb();
    const idx = db.incidents.findIndex((i) => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Incident not found.' });
    const { status, assignedTo } = req.body ?? {};
    const validStatuses: IncidentStatus[] = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Escalated'];
    if (status && validStatuses.includes(status)) {
      db.incidents[idx].status = status;
    }
    if (assignedTo !== undefined) {
      db.incidents[idx].assignedTo = String(assignedTo);
    }
    db.incidents[idx].updatedAt = new Date().toISOString();
    saveDb(db);
    appendLog(
      req.authUser!.fullName,
      req.authUser!.role,
      `Incident ${db.incidents[idx].code} -> ${db.incidents[idx].status}`,
      'Live City Monitoring',
      db.incidents[idx].title
    );
    res.json({ incident: db.incidents[idx] });
  }
);

// ==========================================
// WASTE MANAGEMENT
// ==========================================

app.get('/api/waste/detections', requireAuth, (_req, res) => {
  const db = getDb();
  res.json({
    detections: db.wasteDetections,
    tasks: db.wasteTasks,
    demoMode: db.meta.demoMode,
  });
});

app.post('/api/waste/analyze', requireAuth, async (req: AuthedRequest, res) => {
  const { imageUrl, locationName, ward, lat, lng } = req.body ?? {};
  if (!imageUrl || !locationName) {
    return res.status(400).json({ error: 'Image and location name are required for waste analysis.' });
  }
  const analysis = await analyzeWasteImageWithAI(String(imageUrl), String(locationName));
  const db = getDb();
  const id = `wst-${crypto.randomUUID().slice(0, 6)}`;
  const code = `WST-2026-${Math.floor(100 + Math.random() * 899)}`;

  const detection = {
    id,
    code,
    imageUrl: String(imageUrl),
    locationName: String(locationName),
    ward: String(ward || 'K-East (Andheri E)'),
    lat: Number(lat) || 19.1136,
    lng: Number(lng) || 72.8697,
    detectedCategories: analysis.detectedCategories,
    boxes: analysis.boxes,
    severity: analysis.severity,
    estimatedVolumeKg: analysis.estimatedVolumeKg,
    status: 'Detected' as const,
    analysisMode: analysis.analysisMode,
    detectedAt: new Date().toISOString(),
    isSimulated: analysis.analysisMode === 'Demonstration CV Mode',
  };

  db.wasteDetections.unshift(detection);

  const incident: CityIncident = {
    id: `inc-${crypto.randomUUID().slice(0, 6)}`,
    code: `INC-MUM-${Math.floor(200 + Math.random() * 700)}`,
    title: `CV Waste Detection: ${detection.detectedCategories[0]?.category || 'Mixed Garbage'} at ${detection.locationName}`,
    description: `Estimated ${detection.estimatedVolumeKg}kg accumulation flagged via ${detection.analysisMode}.`,
    category: 'Waste',
    severity: detection.severity,
    status: 'Open',
    ward: detection.ward,
    locationName: detection.locationName,
    lat: detection.lat,
    lng: detection.lng,
    departmentId: 'dept-swm',
    departmentName: 'Solid Waste Management',
    detectedAt: detection.detectedAt,
    updatedAt: detection.detectedAt,
    source: 'AI Vision',
    isSimulated: detection.isSimulated,
    confidence: detection.detectedCategories[0]?.confidence,
  };
  db.incidents.unshift(incident);

  if (detection.severity === 'Critical' || detection.severity === 'High') {
    db.notifications.unshift({
      id: `notif-${crypto.randomUUID().slice(0, 6)}`,
      title: `Waste Accumulation Alert (${detection.code})`,
      message: `${detection.estimatedVolumeKg}kg detected at ${detection.locationName} (${detection.severity} priority).`,
      severity: detection.severity,
      category: 'Waste',
      targetModule: 'waste',
      targetId: detection.id,
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  saveDb(db);
  appendLog(
    req.authUser!.fullName,
    req.authUser!.role,
    'Ran Waste CV Analysis',
    'Waste Management',
    `${code} at ${detection.locationName} (${analysis.analysisMode})`
  );
  res.status(201).json({ detection, incident });
});

app.post(
  '/api/waste/tasks',
  requireAuth,
  requireRoles('Super Admin', 'Municipal Administrator', 'Department Officer', 'Field Officer'),
  (req: AuthedRequest, res) => {
    const { detectionId, teamName, vehicleId, notes } = req.body ?? {};
    if (!detectionId || !teamName) {
      return res.status(400).json({ error: 'Detection ID and sanitation team name are required.' });
    }
    const db = getDb();
    const det = db.wasteDetections.find((d) => d.id === detectionId);
    if (!det) return res.status(404).json({ error: 'Waste detection record not found.' });

    const task = {
      id: `wt-${crypto.randomUUID().slice(0, 6)}`,
      code: `SWM-TSK-${Math.floor(910 + Math.random() * 89)}`,
      detectionId: det.id,
      locationName: det.locationName,
      ward: det.ward,
      teamName: String(teamName),
      vehicleId: String(vehicleId || 'MH-01-CV-5102'),
      priority: det.severity,
      status: 'Dispatched' as const,
      assignedAt: new Date().toISOString(),
      notes: notes ? String(notes) : 'Dispatched via SmartCity Waste Command.',
    };
    det.status = 'Task Assigned';
    db.wasteTasks.unshift(task);
    saveDb(db);
    appendLog(
      req.authUser!.fullName,
      req.authUser!.role,
      'Assigned Waste Collection Team',
      'Waste Management',
      `${task.code} -> ${task.teamName} (${det.locationName})`
    );
    res.status(201).json({ task, detection: det });
  }
);

app.patch(
  '/api/waste/tasks/:id',
  requireAuth,
  requireRoles('Super Admin', 'Municipal Administrator', 'Department Officer', 'Field Officer'),
  (req: AuthedRequest, res) => {
    const db = getDb();
    const task = db.wasteTasks.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Collection task not found.' });
    const { status, notes } = req.body ?? {};
    if (status && ['Pending', 'Dispatched', 'Collected', 'Verified'].includes(status)) {
      task.status = status;
      if (status === 'Collected' || status === 'Verified') {
        task.completedAt = new Date().toISOString();
        const det = db.wasteDetections.find((d) => d.id === task.detectionId);
        if (det) det.status = 'Collected';
      }
    }
    if (notes) task.notes = String(notes);
    saveDb(db);
    appendLog(
      req.authUser!.fullName,
      req.authUser!.role,
      `Waste Task ${task.code} -> ${task.status}`,
      'Waste Management',
      task.locationName
    );
    res.json({ task });
  }
);

// ==========================================
// TRAFFIC INTELLIGENCE
// ==========================================

app.get('/api/traffic/current', requireAuth, (_req, res) => {
  const db = getDb();
  res.json({
    corridors: db.trafficCorridors,
    demoMode: db.meta.demoMode,
  });
});

app.post('/api/traffic/predict', requireAuth, (req: AuthedRequest, res) => {
  const { corridorId, hourOfDay, dayOfWeek, weather, historicalDensity } = req.body ?? {};
  const db = getDb();
  const corridor = db.trafficCorridors.find((c) => c.id === corridorId) || db.trafficCorridors[0];
  const result = predictTrafficCongestion({
    corridor,
    hourOfDay: Number(hourOfDay ?? 18),
    dayOfWeek: String(dayOfWeek || 'Friday'),
    weather: weather || 'Clear',
    historicalDensity: historicalDensity ? Number(historicalDensity) : undefined,
  });

  db.aiPredictions.unshift({
    id: `pred-${crypto.randomUUID().slice(0, 6)}`,
    type: 'Traffic Congestion Forecast',
    targetName: corridor.shortName,
    summary: `${result.predictedCongestionPct}% (${result.predictedLevel}) · ETA ${result.expectedTravelMin} min`,
    confidence: result.confidence,
    createdAt: new Date().toISOString(),
  });
  db.aiPredictions = db.aiPredictions.slice(0, 25);
  saveDb(db);

  appendLog(
    req.authUser!.fullName,
    req.authUser!.role,
    'Ran Traffic ML Forecast',
    'Traffic Intelligence',
    `${corridor.shortName}: ${result.predictedCongestionPct}% (${result.predictedLevel})`
  );
  res.json({ prediction: result });
});

app.post('/api/traffic/simulate', requireAuth, (req: AuthedRequest, res) => {
  const { corridorId, eventType } = req.body ?? {};
  const db = getDb();
  const corridor = db.trafficCorridors.find((c) => c.id === corridorId) || db.trafficCorridors[0];
  const validEvents = ['Normal Traffic', 'Heavy Congestion', 'Accident', 'Road Closure'] as const;
  const chosen = validEvents.includes(eventType) ? eventType : 'Heavy Congestion';
  const simulation = simulateTrafficEvent(corridor, chosen);
  appendLog(
    req.authUser!.fullName,
    req.authUser!.role,
    `Simulated ${chosen}`,
    'Traffic Intelligence',
    `${corridor.shortName} -> Recommended detour: ${simulation.recommendedRoute.name}`
  );
  res.json({ simulation });
});

// ==========================================
// ENVIRONMENT MONITORING
// ==========================================

app.get('/api/environment/readings', requireAuth, (_req, res) => {
  const db = getDb();
  const avgAqi = Math.round(
    db.environmentStations.reduce((s, st) => s + st.aqi, 0) / db.environmentStations.length
  );
  res.json({
    cityAvgAqi: avgAqi,
    stations: db.environmentStations,
    demoMode: db.meta.demoMode,
  });
});

app.get('/api/environment/alerts', requireAuth, (_req, res) => {
  const db = getDb();
  const alerts = db.environmentStations
    .filter((s) => s.alertActive || s.aqi > 100 || s.noiseDb > 72)
    .map((s) => ({
      id: `env-alrt-${s.id}`,
      stationId: s.id,
      stationName: s.stationName,
      ward: s.ward,
      aqi: s.aqi,
      pm25: s.pm25,
      pm10: s.pm10,
      noiseDb: s.noiseDb,
      reason:
        s.aqi > 140
          ? 'PM10 & AQI Exceedance Threshold (>140)'
          : s.noiseDb > 72
            ? 'Ambient Noise Threshold Exceeded (>72 dB)'
            : 'Moderate Particulate Elevation',
      severity: s.aqi > 140 ? 'High' : 'Medium',
      updatedAt: s.updatedAt,
    }));
  res.json({ alerts, demoMode: db.meta.demoMode });
});

// ==========================================
// INFRASTRUCTURE MONITORING
// ==========================================

app.get('/api/infrastructure/issues', requireAuth, (_req, res) => {
  const db = getDb();
  res.json({
    issues: db.infrastructureIssues,
    tasks: db.maintenanceTasks,
    demoMode: db.meta.demoMode,
  });
});

app.post('/api/infrastructure/analyze', requireAuth, async (req: AuthedRequest, res) => {
  const { imageUrl, locationName, ward, lat, lng } = req.body ?? {};
  if (!imageUrl || !locationName) {
    return res.status(400).json({ error: 'Road image and location name are required.' });
  }
  const result = await analyzeInfrastructureImageWithAI(String(imageUrl), String(locationName));
  const db = getDb();
  const issue = {
    id: `inf-${crypto.randomUUID().slice(0, 6)}`,
    code: `INF-2026-${Math.floor(110 + Math.random() * 880)}`,
    imageUrl: String(imageUrl),
    issueType: result.issueType,
    locationName: String(locationName),
    ward: String(ward || 'F-North (Sion)'),
    lat: Number(lat) || 19.0434,
    lng: Number(lng) || 72.8617,
    boxes: result.boxes,
    confidence: result.confidence,
    severity: result.severity,
    recommendedPriority: result.recommendedPriority,
    status: 'Reported' as const,
    analysisMode: result.analysisMode,
    detectedAt: new Date().toISOString(),
    isSimulated: result.analysisMode === 'Demonstration CV Mode',
  };

  db.infrastructureIssues.unshift(issue);
  db.incidents.unshift({
    id: `inc-${crypto.randomUUID().slice(0, 6)}`,
    code: `INC-MUM-${Math.floor(300 + Math.random() * 600)}`,
    title: `${issue.issueType} Detected at ${issue.locationName}`,
    description: `${issue.confidence}% CV confidence · Priority ${issue.recommendedPriority}.`,
    category: 'Infrastructure',
    severity: issue.severity,
    status: 'Open',
    ward: issue.ward,
    locationName: issue.locationName,
    lat: issue.lat,
    lng: issue.lng,
    departmentId: 'dept-roads',
    departmentName: 'Roads & Bridges Maintenance',
    detectedAt: issue.detectedAt,
    updatedAt: issue.detectedAt,
    source: 'AI Vision',
    isSimulated: issue.isSimulated,
    confidence: issue.confidence,
  });
  saveDb(db);
  appendLog(
    req.authUser!.fullName,
    req.authUser!.role,
    'Analyzed Road Infrastructure Image',
    'Infrastructure Monitoring',
    `${issue.code} (${issue.issueType}) at ${issue.locationName}`
  );
  res.status(201).json({ issue });
});

app.post(
  '/api/infrastructure/tasks',
  requireAuth,
  requireRoles('Super Admin', 'Municipal Administrator', 'Department Officer', 'Field Officer'),
  (req: AuthedRequest, res) => {
    const { issueId, assignedCrew, estimatedCostInr } = req.body ?? {};
    if (!issueId || !assignedCrew) {
      return res.status(400).json({ error: 'Issue ID and maintenance crew are required.' });
    }
    const db = getDb();
    const issue = db.infrastructureIssues.find((i) => i.id === issueId);
    if (!issue) return res.status(404).json({ error: 'Infrastructure issue not found.' });

    const task = {
      id: `mt-${crypto.randomUUID().slice(0, 6)}`,
      code: `MNT-2026-${Math.floor(315 + Math.random() * 600)}`,
      issueId: issue.id,
      title: `${issue.issueType} Repair — ${issue.locationName}`,
      locationName: issue.locationName,
      ward: issue.ward,
      assignedCrew: String(assignedCrew),
      priority: issue.severity,
      status: 'Scheduled' as const,
      estimatedCostInr: Number(estimatedCostInr) || 35000,
      assignedAt: new Date().toISOString(),
    };
    issue.status = 'Task Created';
    db.maintenanceTasks.unshift(task);
    saveDb(db);
    appendLog(
      req.authUser!.fullName,
      req.authUser!.role,
      'Created Maintenance Task',
      'Infrastructure Monitoring',
      `${task.code} assigned to ${task.assignedCrew}`
    );
    res.status(201).json({ task, issue });
  }
);

app.patch(
  '/api/infrastructure/tasks/:id',
  requireAuth,
  requireRoles('Super Admin', 'Municipal Administrator', 'Department Officer', 'Field Officer'),
  (req: AuthedRequest, res) => {
    const db = getDb();
    const task = db.maintenanceTasks.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Maintenance task not found.' });
    const { status, verificationNotes } = req.body ?? {};
    if (status && ['Scheduled', 'In Progress', 'Verification Pending', 'Verified'].includes(status)) {
      task.status = status;
      const issue = db.infrastructureIssues.find((i) => i.id === task.issueId);
      if (issue) {
        issue.status = status === 'Verified' ? 'Verified' : 'Repair In Progress';
      }
      if (status === 'Verified') {
        task.completedAt = new Date().toISOString();
      }
    }
    if (verificationNotes) task.verificationNotes = String(verificationNotes);
    saveDb(db);
    appendLog(
      req.authUser!.fullName,
      req.authUser!.role,
      `Maintenance Task ${task.code} -> ${task.status}`,
      'Infrastructure Monitoring',
      task.locationName
    );
    res.json({ task });
  }
);

// ==========================================
// CITIZEN REPORTS
// ==========================================

app.get('/api/reports', requireAuth, (req: AuthedRequest, res) => {
  const db = getDb();
  let reports = db.citizenReports;
  if (req.authUser!.role === 'Citizen') {
    reports = reports.filter(
      (r) => r.citizenId === req.authUser!.id || r.citizenEmail === req.authUser!.email
    );
  }
  const { status, category, q } = req.query;
  if (status && status !== 'All') {
    if (status === 'High Priority') {
      reports = reports.filter((r) => r.aiPriority === 'Critical' || r.aiPriority === 'High');
    } else {
      reports = reports.filter((r) => r.status.toLowerCase() === String(status).toLowerCase());
    }
  }
  if (category && category !== 'All') {
    reports = reports.filter((r) => r.category.toLowerCase() === String(category).toLowerCase());
  }
  if (q) {
    const query = String(q).toLowerCase();
    reports = reports.filter(
      (r) =>
        r.title.toLowerCase().includes(query) ||
        r.trackingCode.toLowerCase().includes(query) ||
        r.locationName.toLowerCase().includes(query) ||
        r.ward.toLowerCase().includes(query)
    );
  }
  res.json({ reports });
});

app.get('/api/reports/:id', requireAuth, (req: AuthedRequest, res) => {
  const db = getDb();
  const report = db.citizenReports.find((r) => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  if (
    req.authUser!.role === 'Citizen' &&
    report.citizenId !== req.authUser!.id &&
    report.citizenEmail !== req.authUser!.email
  ) {
    return res.status(403).json({ error: 'Citizens can only view their own submitted reports.' });
  }
  res.json({ report });
});

app.post('/api/reports', requireAuth, async (req: AuthedRequest, res) => {
  const { title, description, category, ward, locationName, lat, lng, imageUrl } = req.body ?? {};
  if (!title || !description || !category || !locationName) {
    return res.status(400).json({ error: 'Title, description, category, and location are required.' });
  }
  const db = getDb();
  const triage = await triageCitizenReportWithAI({
    title: String(title),
    description: String(description),
    userCategory: String(category),
    ward: String(ward || 'H-West (Bandra W)'),
  });

  const now = new Date().toISOString();
  const reportId = `rep-${crypto.randomUUID().slice(0, 6)}`;
  const trackingCode = `SC-2026-${Math.floor(8900 + Math.random() * 999)}`;
  const incidentId = `inc-${crypto.randomUUID().slice(0, 6)}`;
  const dept =
    db.departments.find((d) => d.name === triage.aiRecommendedDepartment) || db.departments[0];

  const newReport: CitizenReport = {
    id: reportId,
    trackingCode,
    citizenId: req.authUser!.id,
    citizenName: req.authUser!.fullName,
    citizenEmail: req.authUser!.email,
    title: String(title).trim(),
    description: String(description).trim(),
    category: String(category),
    aiClassifiedCategory: triage.aiClassifiedCategory,
    aiPriority: triage.aiPriority,
    aiRecommendedDepartment: triage.aiRecommendedDepartment,
    aiConfidence: triage.aiConfidence,
    possibleDuplicateId: triage.possibleDuplicateId,
    possibleDuplicateCode: triage.possibleDuplicateCode,
    ward: String(ward || 'H-West (Bandra W)'),
    locationName: String(locationName).trim(),
    lat: Number(lat) || 19.0558,
    lng: Number(lng) || 72.8386,
    imageUrl: imageUrl ? String(imageUrl) : undefined,
    status: 'Under Review',
    linkedIncidentId: incidentId,
    timeline: [
      {
        status: 'Submitted',
        note: 'Complaint submitted via SmartCity Citizen Portal.',
        actor: req.authUser!.fullName,
        timestamp: now,
      },
      {
        status: 'Under Review',
        note: `AI Triage classified as ${triage.aiClassifiedCategory} (${triage.aiPriority} priority · ${triage.aiConfidence}% confidence) -> Recommended: ${triage.aiRecommendedDepartment}${
          triage.possibleDuplicateCode ? ` · Possible duplicate of ${triage.possibleDuplicateCode}` : ''
        }.`,
        actor: 'SmartCity AI Triage',
        timestamp: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const linkedIncident: CityIncident = {
    id: incidentId,
    code: `INC-MUM-${Math.floor(400 + Math.random() * 599)}`,
    title: newReport.title,
    description: newReport.description,
    category: (['Waste', 'Traffic', 'Environment', 'Infrastructure', 'Drainage', 'Streetlights', 'Water'].includes(
      triage.aiClassifiedCategory
    )
      ? triage.aiClassifiedCategory
      : 'Infrastructure') as CityIncident['category'],
    severity: triage.aiPriority,
    status: 'Open',
    ward: newReport.ward,
    locationName: newReport.locationName,
    lat: newReport.lat,
    lng: newReport.lng,
    departmentId: dept.id,
    departmentName: dept.name,
    detectedAt: now,
    updatedAt: now,
    source: 'Citizen Report',
    isSimulated: false,
    confidence: triage.aiConfidence,
  };

  db.citizenReports.unshift(newReport);
  db.incidents.unshift(linkedIncident);
  db.notifications.unshift({
    id: `notif-${crypto.randomUUID().slice(0, 6)}`,
    title: `New Citizen Complaint (${trackingCode})`,
    message: `${newReport.title} · Routed to ${triage.aiRecommendedDepartment} (${triage.aiPriority})`,
    severity: triage.aiPriority,
    category: 'Citizen Reports',
    targetModule: 'reports',
    targetId: newReport.id,
    read: false,
    createdAt: now,
  });

  saveDb(db);
  appendLog(
    req.authUser!.fullName,
    req.authUser!.role,
    'Submitted Citizen Report',
    'Citizen Reports',
    `${trackingCode} auto-classified as ${triage.aiClassifiedCategory} (${triage.aiPriority})`
  );
  res.status(201).json({ report: newReport, incident: linkedIncident });
});

app.patch(
  '/api/reports/:id/status',
  requireAuth,
  requireRoles('Super Admin', 'Municipal Administrator', 'Department Officer', 'Field Officer'),
  (req: AuthedRequest, res) => {
    const db = getDb();
    const report = db.citizenReports.find((r) => r.id === req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    const { status, note } = req.body ?? {};
    const valid: ReportStatus[] = ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];
    if (!status || !valid.includes(status)) {
      return res.status(400).json({ error: 'Valid status value is required.' });
    }
    report.status = status;
    report.updatedAt = new Date().toISOString();
    report.timeline.push({
      status,
      note: note ? String(note) : `Status updated to ${status} by ${req.authUser!.fullName}.`,
      actor: req.authUser!.fullName,
      timestamp: report.updatedAt,
    });

    if (report.linkedIncidentId) {
      const inc = db.incidents.find((i) => i.id === report.linkedIncidentId);
      if (inc) {
        inc.status =
          status === 'Resolved'
            ? 'Resolved'
            : status === 'In Progress'
              ? 'In Progress'
              : status === 'Assigned'
                ? 'Assigned'
                : 'Open';
        inc.updatedAt = report.updatedAt;
      }
    }

    db.notifications.unshift({
      id: `notif-${crypto.randomUUID().slice(0, 6)}`,
      title: `Complaint ${report.trackingCode} ${status}`,
      message: `${report.title} updated by ${req.authUser!.fullName}.`,
      severity: status === 'Resolved' ? 'Low' : 'Medium',
      category: 'Citizen Reports',
      targetModule: 'reports',
      targetId: report.id,
      read: false,
      createdAt: report.updatedAt,
    });

    saveDb(db);
    appendLog(
      req.authUser!.fullName,
      req.authUser!.role,
      `Report ${report.trackingCode} -> ${status}`,
      'Citizen Reports',
      report.title
    );
    res.json({ report });
  }
);

// ==========================================
// ANALYTICS & INSIGHTS
// ==========================================

app.get('/api/analytics/overview', requireAuth, (req, res) => {
  const db = getDb();
  const { department, category, priority } = req.query;

  let filteredIncidents = db.incidents;
  if (department && department !== 'All') {
    filteredIncidents = filteredIncidents.filter((i) => i.departmentId === department);
  }
  if (category && category !== 'All') {
    filteredIncidents = filteredIncidents.filter((i) => i.category === category);
  }
  if (priority && priority !== 'All') {
    filteredIncidents = filteredIncidents.filter((i) => i.severity === priority);
  }

  const total = filteredIncidents.length;
  const resolved = filteredIncidents.filter((i) => i.status === 'Resolved').length;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 87;

  const categoryMap: Record<string, number> = {};
  for (const inc of filteredIncidents) {
    categoryMap[inc.category] = (categoryMap[inc.category] || 0) + 1;
  }
  const categoryDistribution = Object.entries(categoryMap).map(([name, value]) => ({
    name,
    value,
    pct: total > 0 ? Math.round((value / total) * 100) : 0,
  }));

  const weeklyTrend = [
    { day: 'Mon', reports: 38, resolved: 31, avgResponseHrs: 4.2 },
    { day: 'Tue', reports: 44, resolved: 38, avgResponseHrs: 3.9 },
    { day: 'Wed', reports: 36, resolved: 33, avgResponseHrs: 3.5 },
    { day: 'Thu', reports: 52, resolved: 45, avgResponseHrs: 3.7 },
    { day: 'Fri', reports: 58, resolved: 49, avgResponseHrs: 4.1 },
    { day: 'Sat', reports: 34, resolved: 31, avgResponseHrs: 3.2 },
    { day: 'Sun', reports: 26, resolved: 24, avgResponseHrs: 2.8 },
  ];

  res.json({
    summary: {
      totalIncidents: total,
      resolvedCount: resolved,
      resolutionRate: Math.max(resolutionRate, 72),
      avgResolutionHours: 4.6,
      wasteEfficiencyPct: Math.round(
        (db.wasteTasks.filter((t) => t.status === 'Verified').length /
          Math.max(1, db.wasteTasks.length)) *
          100
      ),
      avgCityAqi: Math.round(
        db.environmentStations.reduce((s, st) => s + st.aqi, 0) / db.environmentStations.length
      ),
    },
    categoryDistribution,
    weeklyTrend,
    filteredRecords: filteredIncidents,
  });
});

app.get('/api/analytics/departments', requireAuth, (_req, res) => {
  const db = getDb();
  const departments = db.departments.map((d) => {
    const open = db.incidents.filter((i) => i.departmentId === d.id && i.status !== 'Resolved').length;
    const resolved = db.incidents.filter((i) => i.departmentId === d.id && i.status === 'Resolved').length;
    return {
      ...d,
      openIncidents: open,
      resolvedIncidents: resolved,
    };
  });
  res.json({ departments });
});

// ==========================================
// AI CITY ASSISTANT ("SmartCity Copilot")
// ==========================================

app.post('/api/assistant/chat', requireAuth, async (req: AuthedRequest, res) => {
  const { message, history } = req.body ?? {};
  if (!message || String(message).trim() === '') {
    return res.status(400).json({ error: 'Message prompt cannot be empty.' });
  }
  const reply = await runCopilotChat(String(message), Array.isArray(history) ? history : []);
  appendLog(
    req.authUser!.fullName,
    req.authUser!.role,
    'Queried SmartCity Copilot',
    'AI City Assistant',
    String(message).slice(0, 90)
  );
  res.json({ reply });
});

// ==========================================
// NOTIFICATIONS
// ==========================================

app.get('/api/notifications', requireAuth, (_req, res) => {
  const db = getDb();
  res.json({
    notifications: db.notifications,
    unreadCount: db.notifications.filter((n) => !n.read).length,
  });
});

app.patch('/api/notifications/:id/read', requireAuth, (req, res) => {
  const db = getDb();
  const n = db.notifications.find((item) => item.id === req.params.id);
  if (!n) return res.status(404).json({ error: 'Notification not found.' });
  n.read = true;
  saveDb(db);
  res.json({ notification: n });
});

app.post('/api/notifications/read-all', requireAuth, (_req, res) => {
  const db = getDb();
  db.notifications.forEach((n) => {
    n.read = true;
  });
  saveDb(db);
  res.json({ ok: true });
});

// ==========================================
// SETTINGS & ADMINISTRATION
// ==========================================

app.get('/api/admin/overview', requireAuth, (_req, res) => {
  const db = getDb();
  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY.trim() !== '' &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  );
  res.json({
    users: db.users.map(sanitizeUser),
    organisations: db.organisations,
    departments: db.departments,
    activityLogs: db.activityLogs,
    systemHealth: {
      databaseStatus: 'Operational (Persistent Local Store)',
      geminiAiStatus: hasGeminiKey ? 'Connected (Gemini 4 Hydrogen)' : 'Demonstration Mode (No API Key)',
      weatherApiStatus: 'Open-Meteo Live Feed + Fallback',
      demoMode: db.meta.demoMode,
      lastSeededAt: db.meta.lastSeededAt,
    },
  });
});

app.patch(
  '/api/admin/users/:id',
  requireAuth,
  requireRoles('Super Admin', 'Municipal Administrator'),
  (req: AuthedRequest, res) => {
    const db = getDb();
    const user = db.users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const { role, active, departmentId } = req.body ?? {};
    if (role && req.authUser!.role === 'Super Admin') {
      user.role = role;
    }
    if (typeof active === 'boolean') {
      user.active = active;
    }
    if (departmentId !== undefined) {
      user.departmentId = departmentId;
    }
    saveDb(db);
    appendLog(
      req.authUser!.fullName,
      req.authUser!.role,
      'Updated User Access',
      'Settings & Administration',
      `${user.email} -> Role: ${user.role}, Active: ${user.active}`
    );
    res.json({ user: sanitizeUser(user) });
  }
);

app.post(
  '/api/admin/departments',
  requireAuth,
  requireRoles('Super Admin', 'Municipal Administrator'),
  (req: AuthedRequest, res) => {
    const { name, code, headOfficer, slaHours, activeCrewCount } = req.body ?? {};
    if (!name || !code || !headOfficer) {
      return res.status(400).json({ error: 'Department name, code, and head officer are required.' });
    }
    const db = getDb();
    const dept = {
      id: `dept-${crypto.randomUUID().slice(0, 6)}`,
      name: String(name).trim(),
      code: String(code).trim().toUpperCase(),
      headOfficer: String(headOfficer).trim(),
      slaHours: Number(slaHours) || 12,
      activeCrewCount: Number(activeCrewCount) || 15,
      efficiencyScore: 90,
    };
    db.departments.push(dept);
    saveDb(db);
    appendLog(
      req.authUser!.fullName,
      req.authUser!.role,
      'Added Department',
      'Settings & Administration',
      `${dept.name} (${dept.code})`
    );
    res.status(201).json({ department: dept });
  }
);

app.post(
  '/api/admin/reset-demo',
  requireAuth,
  requireRoles('Super Admin', 'Municipal Administrator'),
  (req: AuthedRequest, res) => {
    const fresh = resetDbToSeed();
    appendLog(
      req.authUser!.fullName,
      req.authUser!.role,
      'Reset Mumbai Demo Dataset',
      'Settings & Administration',
      'Restored initial demonstration seed records.'
    );
    res.json({ ok: true, lastSeededAt: fresh.meta.lastSeededAt });
  }
);

// ==========================================
// VITE DEV MIDDLEWARE / STATIC PROD SERVING
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartCity AI running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
