# SmartCity AI — Urban Intelligence & City Command Platform

**Innovex 2026 · PS 04 – Smart Cities & Sustainability**  
*Intelligence for a Smarter Tomorrow.*

---

## Overview

SmartCity AI is a full-stack municipal command platform built with React, TypeScript, Tailwind CSS, Express, Leaflet, Recharts, and the `@google/genai` SDK. It transforms urban governance from reactive complaint handling into proactive AI-powered monitoring, computer vision inspection, predictive traffic intelligence, environmental telemetry, and citizen triage.

## Key Modules

1. **Authentication & RBAC (`src/pages/AuthPage.tsx`, `server/auth.ts`)**
   - Split-screen Login, Registration, Forgot Password, and Demo Quick-Sign-In across 5 roles: `Super Admin`, `Municipal Administrator`, `Department Officer`, `Field Officer`, and `Citizen`.
   - Password hashing via Node `crypto.scryptSync` + HMAC-SHA256 signed bearer tokens.
2. **City Command Centre (`src/pages/DashboardPage.tsx`)**
   - Mumbai coastal command hero with live Open-Meteo weather readout, 5 clickable KPI cards, interactive Leaflet city overview, weekly incident trends, department distribution, live activity feed, and priority alerts.
3. **Live City Monitoring (`src/pages/MonitoringPage.tsx`)**
   - Interactive dark-theme Leaflet OpenStreetMap with toggleable layers (`Incidents`, `Traffic Corridors`, `AQI Stations`), category filters, and clickable marker inspector with status updates.
4. **AI Waste Management (`src/pages/WasteManagementPage.tsx`)**
   - Image upload, drag-and-drop, camera capture, and sample inspection using `gemini-4-hydrogen` multimodal bounding-box detection (with automatic clearly labeled `Demonstration CV Mode` fallback when `GEMINI_API_KEY` is absent), sanitation squad dispatch, and verification workflow.
5. **Traffic Intelligence (`src/pages/TrafficIntelligencePage.tsx`, `server/ml.ts`)**
   - Arterial corridor density monitor, multivariate ML congestion forecaster (hour, weekday, weather, historical density), and interactive road-event simulator (`Normal Traffic`, `Heavy Congestion`, `Accident`, `Road Closure`) with emergency green-corridor ETA calculation.
6. **Environment Monitoring (`src/pages/EnvironmentPage.tsx`)**
   - Mumbai sensor station AQI gauge, PM2.5, PM10, NO₂, CO₂, O₃, temperature, humidity, noise dB, 24h trend chart, and active pollution hotspot alerts.
7. **Infrastructure Monitoring (`src/pages/InfrastructurePage.tsx`)**
   - Road defect CV scan for potholes, cracks, drains, and streetlights, plus maintenance work order creation, cost budgeting, and completion verification.
8. **Citizen Reports (`src/pages/CitizenReportsPage.tsx`)**
   - Dual-mode citizen submission portal & municipal triage console featuring AI auto-classification, ward duplicate detection, automatic department routing, and a 6-stage tracking timeline.
9. **Analytics & Insights (`src/pages/AnalyticsPage.tsx`)**
   - Multi-dimensional filters, category distribution donut, weekly performance charts, department SLA table, CSV download, and print-ready PDF export.
10. **SmartCity Copilot (`src/pages/AssistantPage.tsx`, `server/ai.ts`)**
    - Conversational AI assistant using Gemini Function Calling (`get_city_overview`, `query_incidents`, `get_waste_summary`, `get_traffic_corridors`, `get_environment_readings`) to query real persisted records, render inline Recharts visualizations, and link directly to relevant modules.

---

## Setup & Running Locally

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure environment variables** (copy `.env.example` to `.env` if running outside AI Studio)
   - `GEMINI_API_KEY`: Enables live Gemini Vision CV and Gemini Function Calling Copilot. When omitted, the platform automatically runs its clearly labeled `Demonstration Mode` pipelines.
   - `SESSION_SECRET`: Optional HMAC secret for session tokens.
3. **Start development server (Port 3000)**
   ```bash
   npm run dev
   ```
4. **Build for production**
   ```bash
   npm run build
   ```

## Demo Credentials (Mumbai Seed Dataset)

All pre-seeded accounts use password `SmartCity@2026` (or use the one-click role buttons on the login screen):
- **Super Admin**: `admin@smartcity.gov.in`
- **Municipal Administrator**: `commissioner@smartcity.gov.in`
- **Department Officer**: `roads.officer@smartcity.gov.in`
- **Field Officer**: `field.squad@smartcity.gov.in`
- **Citizen**: `citizen@mumbai.in`

## Database & Persistence

- Application state persists atomically in `data/smartcity.json`, pre-seeded with realistic Mumbai municipal departments, incidents, corridors, environmental nodes, and reports.
- Reference PostgreSQL DDL is provided in `database/schema.sql`.
