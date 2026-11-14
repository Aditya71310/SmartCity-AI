import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { SidebarLayout, type NavPageId } from './components/SidebarLayout';
import { DashboardPage } from './pages/DashboardPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { WasteManagementPage } from './pages/WasteManagementPage';
import { TrafficIntelligencePage } from './pages/TrafficIntelligencePage';
import { EnvironmentPage } from './pages/EnvironmentPage';
import { InfrastructurePage } from './pages/InfrastructurePage';
import { CitizenReportsPage } from './pages/CitizenReportsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AssistantPage } from './pages/AssistantPage';
import { SettingsPage } from './pages/SettingsPage';
import { SmartCityIntro } from './components/SmartCityIntro';

function AppShell() {
  const { user, loading } = useAuth();
  const [activePage, setActivePage] = useState<NavPageId>('dashboard');

  useEffect(() => {
    if (user?.role === 'Citizen') {
      if (!['reports', 'environment', 'assistant', 'settings'].includes(activePage)) {
        setActivePage('reports');
      }
    }
  }, [user?.role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070D18] flex items-center justify-center text-[#F4F7FC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00C8FF] to-[#00D69A] animate-pulse" />
          <p className="text-xs font-mono text-[#91A2B8]">Initializing SmartCity AI Command...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage onNavigate={setActivePage} />;
      case 'monitoring':
        return <MonitoringPage />;
      case 'waste':
        return <WasteManagementPage />;
      case 'traffic':
        return <TrafficIntelligencePage />;
      case 'environment':
        return <EnvironmentPage />;
      case 'infrastructure':
        return <InfrastructurePage />;
      case 'reports':
        return <CitizenReportsPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'assistant':
        return <AssistantPage onNavigate={setActivePage} />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={setActivePage} />;
    }
  };

  return (
    <SidebarLayout activePage={activePage} onNavigate={setActivePage}>
      {renderPage()}
    </SidebarLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SmartCityIntro />
      <AppShell />
    </AuthProvider>
  );
}
