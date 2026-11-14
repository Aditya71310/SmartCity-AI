import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import type { CityIncident, Department } from '../types/smartcity';

interface AnalyticsOverview {
  summary: {
    totalIncidents: number;
    resolvedCount: number;
    resolutionRate: number;
    avgResolutionHours: number;
    wasteEfficiencyPct: number;
    avgCityAqi: number;
  };
  categoryDistribution: Array<{ name: string; value: number; pct: number }>;
  weeklyTrend: Array<{ day: string; reports: number; resolved: number; avgResponseHrs: number }>;
  filteredRecords: CityIncident[];
}

interface DeptMetric extends Department {
  openIncidents: number;
  resolvedIncidents: number;
}

const PIE_COLORS = ['#00C8FF', '#00D69A', '#FFB547', '#FF5263', '#818CF8', '#38BDF8'];

export function AnalyticsPage() {
  const { notify } = useAuth();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [departments, setDepartments] = useState<DeptMetric[]>([]);
  const [deptFilter, setDeptFilter] = useState('All');
  const [catFilter, setCatFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (deptFilter !== 'All') params.set('department', deptFilter);
      if (catFilter !== 'All') params.set('category', catFilter);
      if (priorityFilter !== 'All') params.set('priority', priorityFilter);

      const [ov, depts] = await Promise.all([
        apiRequest<AnalyticsOverview>(`/api/analytics/overview?${params.toString()}`),
        apiRequest<{ departments: DeptMetric[] }>('/api/analytics/departments'),
      ]);
      setOverview(ov);
      setDepartments(depts.departments);
    } catch (err) {
      notify('Analytics error', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [deptFilter, catFilter, priorityFilter]);

  const handleDownloadCsv = () => {
    if (!overview) return;
    const rows = [
      ['Code', 'Title', 'Category', 'Severity', 'Status', 'Ward', 'Department', 'Source', 'DetectedAt'],
      ...overview.filteredRecords.map((r) => [
        r.code,
        `"${r.title.replace(/"/g, '""')}"`,
        r.category,
        r.severity,
        r.status,
        `"${r.ward}"`,
        `"${r.departmentName}"`,
        r.source,
        r.detectedAt,
      ]),
    ];
    const csv = rows.map((line) => line.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smartcity_mumbai_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify('CSV exported', `Downloaded ${overview.filteredRecords.length} incident records.`, 'success');
  };

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Analytics & Insights</h1>
          <p className="text-xs text-slate-500 dark:text-[#91A2B8] mt-1">
            Departmental SLA performance, incident distribution, and exportable executive city reports
          </p>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            onClick={handleDownloadCsv}
            disabled={!overview}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#82AAD2]/25 bg-white dark:bg-[#101D2D] hover:border-[#00C8FF] px-3.5 py-2 text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5 text-[#00C8FF]" />
            Download CSV
          </button>
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 rounded-xl bg-[#00C8FF] hover:bg-[#00B4E6] text-[#070D18] font-semibold px-3.5 py-2 text-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Export PDF Report
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-4 no-print">
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-3 py-1.5 text-xs"
        >
          <option value="All">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-3 py-1.5 text-xs"
        >
          <option value="All">All Categories</option>
          <option value="Waste">Waste</option>
          <option value="Traffic">Traffic</option>
          <option value="Environment">Environment</option>
          <option value="Infrastructure">Infrastructure</option>
          <option value="Drainage">Drainage</option>
          <option value="Streetlights">Streetlights</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-3 py-1.5 text-xs"
        >
          <option value="All">All Priorities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        {(deptFilter !== 'All' || catFilter !== 'All' || priorityFilter !== 'All') && (
          <button
            onClick={() => {
              setDeptFilter('All');
              setCatFilter('All');
              setPriorityFilter('All');
            }}
            className="text-xs text-[#00C8FF] hover:underline"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Summary KPI Row */}
      {loading || !overview ? (
        <div className="h-32 rounded-2xl bg-slate-200 dark:bg-[#101D2D] animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-4">
              <p className="text-xs text-slate-500 dark:text-[#91A2B8]">Filtered Incidents</p>
              <p className="font-mono text-2xl font-bold text-[#00C8FF] mt-1 tabular-nums">
                {overview.summary.totalIncidents}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-4">
              <p className="text-xs text-slate-500 dark:text-[#91A2B8]">Resolution Rate</p>
              <p className="font-mono text-2xl font-bold text-[#00D69A] mt-1 tabular-nums">
                {overview.summary.resolutionRate}%
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-4">
              <p className="text-xs text-slate-500 dark:text-[#91A2B8]">Avg Response Time</p>
              <p className="font-mono text-2xl font-bold text-[#FFB547] mt-1 tabular-nums">
                {overview.summary.avgResolutionHours} hrs
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-4">
              <p className="text-xs text-slate-500 dark:text-[#91A2B8]">City Avg AQI</p>
              <p className="font-mono text-2xl font-bold mt-1 tabular-nums">
                {overview.summary.avgCityAqi}
              </p>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5">
              <h2 className="font-display text-base font-semibold mb-4">Report Distribution by Category</h2>
              <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-4">
                <div className="sm:col-span-7">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={overview.categoryDistribution}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={56}
                        outerRadius={84}
                        paddingAngle={3}
                      >
                        {overview.categoryDistribution.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#101D2D',
                          borderColor: 'rgba(130,170,210,0.25)',
                          borderRadius: 10,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="sm:col-span-5 space-y-2 text-xs">
                  {overview.categoryDistribution.map((c, idx) => (
                    <div key={c.name} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                        />
                        {c.name}
                      </span>
                      <span className="font-mono font-semibold tabular-nums">{c.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5">
              <h2 className="font-display text-base font-semibold mb-4">Weekly Reports vs. Resolved Volume</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={overview.weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(130,170,210,0.12)" />
                  <XAxis dataKey="day" stroke="#91A2B8" fontSize={11} />
                  <YAxis stroke="#91A2B8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#101D2D',
                      borderColor: 'rgba(130,170,210,0.25)',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="reports" name="Reported" fill="#00C8FF" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" name="Resolved" fill="#00D69A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Department SLA Performance Matrix */}
          <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5">
            <h2 className="font-display text-base font-semibold mb-4">Department Performance & SLA Efficiency</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#82AAD2]/15 text-[11px] text-slate-500 dark:text-[#91A2B8]">
                    <th className="py-2 pr-4">Department</th>
                    <th className="py-2 pr-4">Head Officer</th>
                    <th className="py-2 pr-4">SLA Target</th>
                    <th className="py-2 pr-4">Active Crews</th>
                    <th className="py-2 pr-4">Open Queue</th>
                    <th className="py-2 pr-4">Resolved</th>
                    <th className="py-2 text-right">Efficiency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#82AAD2]/10">
                  {departments.map((d) => (
                    <tr key={d.id}>
                      <td className="py-3 pr-4 font-semibold">
                        <span className="font-mono text-[#00C8FF] mr-2">{d.code}</span>
                        {d.name}
                      </td>
                      <td className="py-3 pr-4 text-slate-500 dark:text-[#91A2B8]">{d.headOfficer}</td>
                      <td className="py-3 pr-4 font-mono tabular-nums">{d.slaHours}h</td>
                      <td className="py-3 pr-4 font-mono tabular-nums">{d.activeCrewCount}</td>
                      <td className="py-3 pr-4 font-mono text-[#FFB547] tabular-nums">{d.openIncidents}</td>
                      <td className="py-3 pr-4 font-mono text-[#00D69A] tabular-nums">{d.resolvedIncidents}</td>
                      <td className="py-3 text-right font-mono font-semibold text-[#00D69A] tabular-nums">
                        {d.efficiencyScore}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
