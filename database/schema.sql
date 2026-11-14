-- SmartCity AI — Reference PostgreSQL Relational Schema
-- Mirrors the persisted application entities for production PostgreSQL / PostGIS deployment.

CREATE TABLE organisations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  city TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  head_officer TEXT NOT NULL,
  sla_hours INTEGER NOT NULL DEFAULT 12,
  active_crew_count INTEGER NOT NULL DEFAULT 10,
  efficiency_score INTEGER NOT NULL DEFAULT 90
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Super Admin', 'Municipal Administrator', 'Department Officer', 'Field Officer', 'Citizen')),
  organisation TEXT NOT NULL,
  designation TEXT NOT NULL,
  department_id TEXT REFERENCES departments(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  ward TEXT NOT NULL,
  location_name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  department_id TEXT REFERENCES departments(id),
  assigned_to TEXT,
  source TEXT NOT NULL,
  is_simulated BOOLEAN NOT NULL DEFAULT TRUE,
  confidence INTEGER,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE waste_detections (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  image_url TEXT NOT NULL,
  location_name TEXT NOT NULL,
  ward TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  detected_categories JSONB NOT NULL,
  boxes JSONB NOT NULL,
  severity TEXT NOT NULL,
  estimated_volume_kg INTEGER NOT NULL,
  status TEXT NOT NULL,
  analysis_mode TEXT NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE waste_tasks (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  detection_id TEXT REFERENCES waste_detections(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE traffic_records (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  ward TEXT NOT NULL,
  length_km DOUBLE PRECISION NOT NULL,
  lanes INTEGER NOT NULL,
  current_density INTEGER NOT NULL,
  congestion_pct INTEGER NOT NULL,
  avg_speed_kmph INTEGER NOT NULL,
  expected_travel_min INTEGER NOT NULL,
  status TEXT NOT NULL,
  coordinates JSONB NOT NULL,
  alternate_routes JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE environmental_readings (
  id TEXT PRIMARY KEY,
  station_name TEXT NOT NULL,
  ward TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  aqi INTEGER NOT NULL,
  pm25 INTEGER NOT NULL,
  pm10 INTEGER NOT NULL,
  no2 INTEGER NOT NULL,
  co2 INTEGER NOT NULL,
  o3 INTEGER NOT NULL,
  temperature_c DOUBLE PRECISION NOT NULL,
  humidity_pct INTEGER NOT NULL,
  noise_db INTEGER NOT NULL,
  alert_active BOOLEAN NOT NULL DEFAULT FALSE,
  hourly_trend JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE infrastructure_issues (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  image_url TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  location_name TEXT NOT NULL,
  ward TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  boxes JSONB NOT NULL,
  confidence INTEGER NOT NULL,
  severity TEXT NOT NULL,
  recommended_priority TEXT NOT NULL,
  status TEXT NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE maintenance_tasks (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  issue_id TEXT REFERENCES infrastructure_issues(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assigned_crew TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  estimated_cost_inr INTEGER NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE citizen_reports (
  id TEXT PRIMARY KEY,
  tracking_code TEXT UNIQUE NOT NULL,
  citizen_id TEXT REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  ai_classified_category TEXT NOT NULL,
  ai_priority TEXT NOT NULL,
  ai_recommended_department TEXT NOT NULL,
  possible_duplicate_id TEXT,
  ward TEXT NOT NULL,
  location_name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL,
  linked_incident_id TEXT REFERENCES incidents(id),
  timeline JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  target_module TEXT NOT NULL,
  target_id TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  details TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_predictions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  target_name TEXT NOT NULL,
  summary TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_incidents_category ON incidents(category);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_reports_citizen ON citizen_reports(citizen_id);
CREATE INDEX idx_notifications_read ON notifications(read);
