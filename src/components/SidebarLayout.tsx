import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Trash2,
  Car,
  Wind,
  Construction,
  FileWarning,
  BarChart3,
  Bot,
  Settings,
  Search,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sun,
  Moon,
  CheckCheck,
  Play,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest, formatRelativeTime } from '../services/api';
import { triggerSmartCityIntroReplay } from './SmartCityIntro';
import type { AppNotification, CityIncident } from '../types/smartcity';

export type NavPageId =
  | 'dashboard'
  | 'monitoring'
  | 'waste'
  | 'traffic'
  | 'environment'
  | 'infrastructure'
  | 'reports'
  | 'analytics'
  | 'assistant'
  | 'settings';

interface SidebarLayoutProps {
  activePage: NavPageId;
  onNavigate: (page: NavPageId) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  id: NavPageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  citizenAllowed?: boolean;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'monitoring', label: 'Live City Monitoring', icon: MapPin },
  { id: 'waste', label: 'Waste Management', icon: Trash2 },
  { id: 'traffic', label: 'Traffic Intelligence', icon: Car },
  { id: 'environment', label: 'Environment Monitoring', icon: Wind, citizenAllowed: true },
  { id: 'infrastructure', label: 'Infrastructure Monitoring', icon: Construction },
  { id: 'reports', label: 'Citizen Reports', icon: FileWarning, citizenAllowed: true },
  { id: 'analytics', label: 'Analytics & Insights', icon: BarChart3 },
  { id: 'assistant', label: 'AI City Assistant', icon: Bot, citizenAllowed: true },
  { id: 'settings', label: 'Settings', icon: Settings, citizenAllowed: true },
];

export function SidebarLayout({ activePage, onNavigate, children }: SidebarLayoutProps) {
  const { user, logout, theme, toggleTheme, selectedCity, setSelectedCity, notify } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CityIncident[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [clockText, setClockText] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockText(
        now.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 30000);
    return () => clearInterval(timer);
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await apiRequest<{ notifications: AppNotification[]; unreadCount: number }>(
        '/api/notifications'
      );
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // ignore initial poll error
    }
  };

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 25000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await apiRequest<{ incidents: CityIncident[] }>(
          `/api/city/incidents?q=${encodeURIComponent(searchQuery.trim())}`
        );
        setSearchResults(res.incidents.slice(0, 5));
        setShowSearchDropdown(true);
      } catch {
        setSearchResults([]);
      }
    }, 180);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const handleMarkRead = async (n: AppNotification) => {
    try {
      await apiRequest(`/api/notifications/${n.id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
      setUnreadCount((c) => Math.max(0, c - (n.read ? 0 : 1)));
      if (n.targetModule) {
        onNavigate(n.targetModule as NavPageId);
        setNotifOpen(false);
      }
    } catch (err) {
      notify('Could not update notification', (err as Error).message, 'error');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch (err) {
      notify('Action failed', (err as Error).message, 'error');
    }
  };

  const visibleNavItems =
    user?.role === 'Citizen' ? NAV_ITEMS.filter((item) => item.citizenAllowed) : NAV_ITEMS;

  const mapCategoryToPage = (category: string): NavPageId => {
    const c = category.toLowerCase();
    if (c === 'waste') return 'waste';
    if (c === 'traffic') return 'traffic';
    if (c === 'environment') return 'environment';
    if (c === 'infrastructure') return 'infrastructure';
    return 'monitoring';
  };

  return (
    <div className="min-h-screen flex bg-[#F3F6FA] dark:bg-[#070D18] text-slate-900 dark:text-[#F4F7FC]">
      {/* Mobile Sidebar Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Persistent Collapsible Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col border-r border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#091321] transition-all duration-200 ${
          collapsed ? 'w-[76px]' : 'w-[256px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo Area */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-[#82AAD2]/15 shrink-0">
          <button
            onClick={() => onNavigate(user?.role === 'Citizen' ? 'reports' : 'dashboard')}
            className="flex items-center gap-2.5 min-w-0 text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00C8FF] to-[#00D69A] flex items-center justify-center text-[#070D18] font-bold text-sm shrink-0">
              SC
            </div>
            {!collapsed && (
              <span className="font-display font-bold text-lg tracking-tight whitespace-nowrap truncate">
                SmartCity <span className="text-[#00C8FF]">AI</span>
              </span>
            )}
          </button>

          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 dark:text-[#91A2B8] hover:text-slate-900 dark:hover:text-[#F4F7FC] hover:bg-slate-100 dark:hover:bg-[#14243A]"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 text-slate-500 dark:text-[#91A2B8]"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileOpen(false);
                }}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-[#00C8FF]/12 text-[#00A3D9] dark:text-[#00C8FF] border border-[#00C8FF]/30 shadow-sm'
                    : 'text-slate-600 dark:text-[#91A2B8] hover:text-slate-900 dark:hover:text-[#F4F7FC] hover:bg-slate-100 dark:hover:bg-[#101D2D] border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#00C8FF]' : ''}`} />
                {!collapsed && <span className="truncate whitespace-nowrap">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Demo Indicator & User Quick Logout */}
        <div className="p-3 border-t border-slate-200 dark:border-[#82AAD2]/15 space-y-2 shrink-0">
          {!collapsed && (
            <div className="rounded-xl bg-slate-100 dark:bg-[#101D2D] border border-slate-200 dark:border-[#82AAD2]/15 px-3 py-2">
              <p className="text-[11px] font-medium text-[#00A3D9] dark:text-[#00C8FF]">
                Mumbai Demo Environment
              </p>
              <p className="text-[11px] text-slate-500 dark:text-[#91A2B8] truncate">
                {user?.role} · Simulated Feed Active
              </p>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center justify-center lg:justify-start gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-[#91A2B8] hover:text-[#FF5263] hover:bg-[#FF5263]/10 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between gap-4 px-4 sm:px-6 border-b border-slate-200 dark:border-[#82AAD2]/15 bg-white/90 dark:bg-[#091321]/90 backdrop-blur-md">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-[#91A2B8] hover:bg-slate-100 dark:hover:bg-[#101D2D]"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 dark:text-[#91A2B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowSearchDropdown(true)}
                onBlur={() => setTimeout(() => setShowSearchDropdown(false), 180)}
                placeholder="Search incidents, wards, reports, assets..."
                className="w-full rounded-xl bg-slate-100 dark:bg-[#101D2D] border border-slate-200 dark:border-[#82AAD2]/15 pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 dark:text-[#F4F7FC] placeholder:text-slate-400 dark:placeholder:text-[#91A2B8] focus:outline-none focus:border-[#00C8FF]"
              />
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-slate-200 dark:border-[#82AAD2]/25 bg-white dark:bg-[#101D2D] shadow-2xl overflow-hidden z-50">
                  {searchResults.map((inc) => (
                    <button
                      key={inc.id}
                      onMouseDown={() => {
                        onNavigate(mapCategoryToPage(inc.category));
                        setSearchQuery('');
                        setShowSearchDropdown(false);
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-100 dark:hover:bg-[#14243A] border-b last:border-b-0 border-slate-100 dark:border-[#82AAD2]/10"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold truncate">{inc.title}</span>
                        <span className="text-[11px] font-mono text-[#00C8FF] shrink-0">{inc.code}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-[#91A2B8] mt-0.5">
                        {inc.ward} · {inc.category} · {inc.severity}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* City Selector */}
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              aria-label="Select city"
              className="hidden sm:block rounded-xl bg-slate-100 dark:bg-[#101D2D] border border-slate-200 dark:border-[#82AAD2]/15 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-[#F4F7FC] focus:outline-none focus:border-[#00C8FF]"
            >
              <option value="Mumbai">Mumbai (Demo Grid)</option>
              <option value="Navi Mumbai">Navi Mumbai Node</option>
              <option value="Thane">Thane Metropolitan</option>
            </select>

            {/* Date & Time */}
            <span className="hidden xl:inline-block font-mono text-xs text-slate-500 dark:text-[#91A2B8] tabular-nums whitespace-nowrap">
              {clockText} IST
            </span>

            {/* Replay Intro Sequence */}
            <button
              type="button"
              onClick={triggerSmartCityIntroReplay}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-[#82AAD2]/15 bg-slate-100 dark:bg-[#101D2D] text-slate-600 dark:text-[#91A2B8] hover:text-[#00C8FF] hover:border-[#00C8FF]/40 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
              aria-label="Replay opening intro"
              title="Replay Opening Intro"
            >
              <Play className="w-3.5 h-3.5 text-[#00C8FF]" />
              <span className="hidden md:inline">Intro</span>
            </button>

            {/* Theme Switch */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-200 dark:border-[#82AAD2]/15 bg-slate-100 dark:bg-[#101D2D] text-slate-600 dark:text-[#91A2B8] hover:text-[#00C8FF]"
              aria-label="Toggle dark or light mode"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications Drawer Trigger */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-2 rounded-xl border border-slate-200 dark:border-[#82AAD2]/15 bg-slate-100 dark:bg-[#101D2D] text-slate-600 dark:text-[#91A2B8] hover:text-[#00C8FF]"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF5263] text-white text-[10px] font-mono font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/25 bg-white dark:bg-[#101D2D] shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-[#82AAD2]/15">
                    <span className="text-sm font-semibold">Alert Centre ({unreadCount} unread)</span>
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-[#00C8FF] hover:underline flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-[#82AAD2]/10">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-slate-500 dark:text-[#91A2B8]">No alerts available.</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleMarkRead(n)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#14243A] transition-colors ${
                            !n.read ? 'bg-[#00C8FF]/5' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs font-semibold ${
                                n.severity === 'Critical'
                                  ? 'text-[#FF5263]'
                                  : n.severity === 'High'
                                    ? 'text-[#FFB547]'
                                    : 'text-[#00C8FF]'
                              }`}
                            >
                              {n.severity} · {n.category}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 dark:text-[#91A2B8]">
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs font-medium mt-1">{n.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-[#91A2B8] mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Trigger */}
            <button
              onClick={() => onNavigate('settings')}
              className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-xl border border-slate-200 dark:border-[#82AAD2]/15 bg-slate-100 dark:bg-[#101D2D] hover:border-[#00C8FF]/40 transition-colors"
            >
              <img
                src={user?.avatarUrl || '/src/assets/images/admin_avatar_portrait_1794656029576.jpg'}
                alt={user?.fullName || 'User'}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-lg object-cover"
              />
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold leading-tight truncate max-w-[120px]">
                  {user?.fullName}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-[#91A2B8] leading-tight truncate max-w-[120px]">
                  {user?.role}
                </p>
              </div>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
