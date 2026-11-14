import React, { useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  RotateCcw,
  Save,
  Server,
  Shield,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest, formatRelativeTime } from '../services/api';
import type { ActivityLog, Department, UserProfile, UserRole } from '../types/smartcity';

interface AdminOverview {
  users: UserProfile[];
  departments: Department[];
  activityLogs: ActivityLog[];
  systemHealth: {
    databaseStatus: string;
    geminiAiStatus: string;
    weatherApiStatus: string;
    demoMode: boolean;
    lastSeededAt: string;
  };
}

export function SettingsPage() {
  const { user, theme, toggleTheme, refreshProfile, notify } = useAuth();
  const [adminData, setAdminData] = useState<AdminOverview | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'departments' | 'system'>('profile');

  // Profile form state
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [organisation, setOrganisation] = useState(user?.organisation || '');
  const [designation, setDesignation] = useState(user?.designation || '');
  const [prefs, setPrefs] = useState(
    user?.notificationPrefs || {
      highPriority: true,
      citizenReports: true,
      environmentAlerts: true,
      taskUpdates: true,
    }
  );
  const [savingProfile, setSavingProfile] = useState(false);

  // Add department state
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [headOfficer, setHeadOfficer] = useState('');

  // Log search
  const [logSearch, setLogSearch] = useState('');

  const loadAdminOverview = async () => {
    try {
      const res = await apiRequest<AdminOverview>('/api/admin/overview');
      setAdminData(res);
    } catch (err) {
      notify('Could not load system settings', (err as Error).message, 'error');
    }
  };

  useEffect(() => {
    loadAdminOverview();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiRequest('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName,
          organisation,
          designation,
          notificationPrefs: prefs,
        }),
      });
      await refreshProfile();
      notify('Profile saved', 'Your profile and notification preferences were updated.', 'success');
    } catch (err) {
      notify('Save failed', (err as Error).message, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggleUserActive = async (target: UserProfile) => {
    try {
      await apiRequest(`/api/admin/users/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !target.active }),
      });
      await loadAdminOverview();
      notify('User status updated', `${target.fullName} is now ${!target.active ? 'Active' : 'Suspended'}.`, 'success');
    } catch (err) {
      notify('Permission denied', (err as Error).message, 'error');
    }
  };

  const handleChangeUserRole = async (target: UserProfile, role: UserRole) => {
    try {
      await apiRequest(`/api/admin/users/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      await loadAdminOverview();
      notify('Role updated', `${target.fullName} -> ${role}`, 'success');
    } catch (err) {
      notify('Role update denied', (err as Error).message, 'error');
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim() || !deptCode.trim() || !headOfficer.trim()) return;
    try {
      await apiRequest('/api/admin/departments', {
        method: 'POST',
        body: JSON.stringify({
          name: deptName.trim(),
          code: deptCode.trim(),
          headOfficer: headOfficer.trim(),
        }),
      });
      setDeptName('');
      setDeptCode('');
      setHeadOfficer('');
      await loadAdminOverview();
      notify('Department created', `${deptName} added to municipal registry.`, 'success');
    } catch (err) {
      notify('Failed to add department', (err as Error).message, 'error');
    }
  };

  const handleResetDemo = async () => {
    try {
      await apiRequest('/api/admin/reset-demo', { method: 'POST' });
      await loadAdminOverview();
      notify('Mumbai Demo Reset', 'All demonstration seed records restored cleanly.', 'success');
    } catch (err) {
      notify('Reset denied', (err as Error).message, 'error');
    }
  };

  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Municipal Administrator';
  const filteredLogs = (adminData?.activityLogs || []).filter((l) => {
    const q = logSearch.toLowerCase();
    return (
      !q ||
      l.action.toLowerCase().includes(q) ||
      l.actorName.toLowerCase().includes(q) ||
      l.module.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Settings & Administration</h1>
          <p className="text-xs text-slate-500 dark:text-[#91A2B8] mt-1">
            Profile preferences, RBAC governance, department registry, system health & audit logs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#101D2D] border border-slate-200 dark:border-[#82AAD2]/15 w-fit">
          {(
            [
              { id: 'profile', label: 'Profile & Theme' },
              { id: 'users', label: 'Users & Roles', adminOnly: true },
              { id: 'departments', label: 'Departments', adminOnly: true },
              { id: 'system', label: 'System & Audit Logs' },
            ] as Array<{ id: typeof activeTab; label: string; adminOnly?: boolean }>
          )
            .filter((t) => !t.adminOnly || isAdmin)
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[#00C8FF] text-[#070D18] font-semibold'
                    : 'text-slate-600 dark:text-[#91A2B8] hover:text-slate-900 dark:hover:text-[#F4F7FC]'
                }`}
              >
                {tab.label}
              </button>
            ))}
        </div>
      </div>

      {/* Profile & Theme */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveProfile}
            className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-6 space-y-4"
          >
            <h2 className="font-display text-base font-semibold">Account Profile & Notifications</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-[#91A2B8] mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-[#91A2B8] mb-1">Role (Read-Only)</label>
                <input
                  type="text"
                  value={user?.role || ''}
                  disabled
                  className="w-full rounded-xl bg-slate-100 dark:bg-[#14243A] border border-slate-200 dark:border-[#82AAD2]/15 px-3 py-2 text-sm opacity-80"
                />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-[#91A2B8] mb-1">Organisation</label>
                <input
                  type="text"
                  value={organisation}
                  onChange={(e) => setOrganisation(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-[#91A2B8] mb-1">Designation</label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-[#82AAD2]/10 space-y-2.5 text-xs">
              <p className="font-semibold text-slate-500 dark:text-[#91A2B8]">Notification Preferences</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { key: 'highPriority', label: 'Critical & High-Priority Alerts' },
                  { key: 'citizenReports', label: 'New Citizen Report Triage' },
                  { key: 'environmentAlerts', label: 'AQI & Noise Threshold Alerts' },
                  { key: 'taskUpdates', label: 'Field Crew Dispatch Updates' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2.5 rounded-xl bg-slate-50 dark:bg-[#14243A] px-3 py-2.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={prefs[item.key as keyof typeof prefs]}
                      onChange={(e) =>
                        setPrefs((p) => ({ ...p, [item.key]: e.target.checked }))
                      }
                      className="accent-[#00C8FF]"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="flex items-center gap-2 rounded-xl bg-[#00C8FF] hover:bg-[#00B4E6] text-[#070D18] font-semibold text-xs px-5 py-2.5"
            >
              <Save className="w-4 h-4" />
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-6 space-y-4">
            <h2 className="font-display text-base font-semibold">Display & Theme Preferences</h2>
            <p className="text-xs text-slate-500 dark:text-[#91A2B8]">
              Command centre defaults to dark tactical telemetry mode. Switch between Dark and Light views anytime.
            </p>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-[#14243A] p-4">
              <div>
                <p className="text-sm font-semibold">Current Theme: {theme === 'dark' ? 'Dark Command' : 'Light Civic'}</p>
                <p className="text-xs text-slate-500 dark:text-[#91A2B8]">Persisted automatically across sessions</p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="px-4 py-2 rounded-xl bg-[#00C8FF] text-[#070D18] text-xs font-semibold"
              >
                Switch to {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users & RBAC Management */}
      {activeTab === 'users' && isAdmin && adminData && (
        <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#00C8FF]" />
            <h2 className="font-display text-base font-semibold">Platform Users & Role-Based Access Control</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#82AAD2]/15 text-[11px] text-slate-500 dark:text-[#91A2B8]">
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Organisation</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#82AAD2]/10">
                {adminData.users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 pr-4 font-semibold">{u.fullName}</td>
                    <td className="py-3 pr-4 font-mono text-slate-500 dark:text-[#91A2B8]">{u.email}</td>
                    <td className="py-3 pr-4 text-slate-500 dark:text-[#91A2B8]">{u.organisation}</td>
                    <td className="py-3 pr-4">
                      {user?.role === 'Super Admin' ? (
                        <select
                          value={u.role}
                          onChange={(e) => handleChangeUserRole(u, e.target.value as UserRole)}
                          className="rounded-lg bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-2.5 py-1 text-xs"
                        >
                          <option>Super Admin</option>
                          <option>Municipal Administrator</option>
                          <option>Department Officer</option>
                          <option>Field Officer</option>
                          <option>Citizen</option>
                        </select>
                      ) : (
                        <span>{u.role}</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleToggleUserActive(u)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          u.active
                            ? 'bg-[#00D69A]/15 text-[#00D69A]'
                            : 'bg-[#FF5263]/15 text-[#FF5263]'
                        }`}
                      >
                        {u.active ? 'Active' : 'Suspended'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Departments */}
      {activeTab === 'departments' && isAdmin && adminData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#00C8FF]" />
              <h2 className="font-display text-base font-semibold">Municipal Departments</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {adminData.departments.map((d) => (
                <div
                  key={d.id}
                  className="rounded-xl border border-slate-200 dark:border-[#82AAD2]/15 bg-slate-50 dark:bg-[#14243A] p-4 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[#00C8FF] font-semibold">{d.code}</span>
                    <span className="font-mono text-[#00D69A]">{d.efficiencyScore}% SLA</span>
                  </div>
                  <p className="text-sm font-semibold">{d.name}</p>
                  <p className="text-slate-500 dark:text-[#91A2B8]">
                    Head: {d.headOfficer} · {d.activeCrewCount} crews
                  </p>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleAddDepartment}
            className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5 space-y-3"
          >
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#00D69A]" />
              Add Department
            </h3>
            <input
              type="text"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              placeholder="Department Name"
              className="w-full rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-3 py-2 text-xs"
              required
            />
            <input
              type="text"
              value={deptCode}
              onChange={(e) => setDeptCode(e.target.value)}
              placeholder="Short Code (e.g. WTR)"
              className="w-full rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-3 py-2 text-xs"
              required
            />
            <input
              type="text"
              value={headOfficer}
              onChange={(e) => setHeadOfficer(e.target.value)}
              placeholder="Department Head Officer"
              className="w-full rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-3 py-2 text-xs"
              required
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-[#00D69A] text-[#070D18] font-semibold text-xs py-2.5"
            >
              Register Department
            </button>
          </form>
        </div>
      )}

      {/* System Health & Audit Logs */}
      {activeTab === 'system' && adminData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-4 space-y-1">
              <p className="text-xs text-slate-500 dark:text-[#91A2B8] flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-[#00D69A]" /> Database Engine
              </p>
              <p className="text-sm font-semibold">{adminData.systemHealth.databaseStatus}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-4 space-y-1">
              <p className="text-xs text-slate-500 dark:text-[#91A2B8] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#00C8FF]" /> AI Integration
              </p>
              <p className="text-sm font-semibold">{adminData.systemHealth.geminiAiStatus}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-4 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-slate-500 dark:text-[#91A2B8]">Mumbai Demo Seed</p>
                <p className="text-sm font-semibold">
                  {adminData.systemHealth.demoMode ? 'Demo Mode Active' : 'Production'}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={handleResetDemo}
                  className="flex items-center gap-1.5 rounded-xl border border-[#FFB547]/40 bg-[#FFB547]/10 text-[#FFB547] px-3 py-1.5 text-xs font-semibold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Demo
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold">Activity Audit Logs</h2>
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Filter logs by actor, module, or action..."
                className="w-full sm:w-72 rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-3 py-1.5 text-xs"
              />
            </div>

            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#82AAD2]/15 text-[11px] text-slate-500 dark:text-[#91A2B8]">
                    <th className="py-2 pr-4">Actor</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Module</th>
                    <th className="py-2 pr-4">Action</th>
                    <th className="py-2 pr-4">Details</th>
                    <th className="py-2 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#82AAD2]/10">
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 pr-4 font-semibold whitespace-nowrap">{log.actorName}</td>
                      <td className="py-2.5 pr-4 text-slate-500 dark:text-[#91A2B8] whitespace-nowrap">{log.actorRole}</td>
                      <td className="py-2.5 pr-4 text-[#00C8FF] whitespace-nowrap">{log.module}</td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">{log.action}</td>
                      <td className="py-2.5 pr-4 text-slate-500 dark:text-[#91A2B8] max-w-[280px] truncate">
                        {log.details}
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-400 dark:text-[#91A2B8] whitespace-nowrap">
                        {formatRelativeTime(log.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
