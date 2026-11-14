import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Sparkles,
  Upload,
  AlertCircle,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest, formatRelativeTime } from '../services/api';
import type { CitizenReport, ReportStatus } from '../types/smartcity';

const STATUS_TABS = ['All', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'High Priority'];

const CATEGORIES = ['Waste', 'Traffic', 'Roads', 'Water', 'Drainage', 'Streetlights', 'Pollution', 'Other'];

const WARDS = [
  { ward: 'H-West (Bandra W)', lat: 19.0558, lng: 72.8386 },
  { ward: 'K-East (Andheri E)', lat: 19.1197, lng: 72.8464 },
  { ward: 'F-North (Sion)', lat: 19.0434, lng: 72.8617 },
  { ward: 'K-West (Andheri W)', lat: 19.1363, lng: 72.8277 },
  { ward: 'M-West (Chembur)', lat: 19.0522, lng: 72.9005 },
];

export function CitizenReportsPage() {
  const { user, notify } = useAuth();
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [selected, setSelected] = useState<CitizenReport | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // New Report Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Waste');
  const [wardIdx, setWardIdx] = useState(0);
  const [locationName, setLocationName] = useState('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Status update note
  const [statusNote, setStatusNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      const res = await apiRequest<{ reports: CitizenReport[] }>(`/api/reports?${params.toString()}`);
      setReports(res.reports);
      if (res.reports.length > 0 && (!selected || !res.reports.some((r) => r.id === selected.id))) {
        setSelected(res.reports[0]);
      }
    } catch (err) {
      notify('Could not load reports', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [statusFilter, searchQuery]);

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !locationName.trim()) {
      notify('Missing fields', 'Please fill title, location, and description.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const w = WARDS[wardIdx] || WARDS[0];
      const res = await apiRequest<{ report: CitizenReport }>('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          ward: w.ward,
          locationName: locationName.trim(),
          lat: w.lat,
          lng: w.lng,
          imageUrl: imageUrl || undefined,
        }),
      });
      setReports((prev) => [res.report, ...prev]);
      setSelected(res.report);
      setModalOpen(false);
      setTitle('');
      setDescription('');
      setLocationName('');
      setImageUrl('');
      notify(
        `Complaint Logged (${res.report.trackingCode})`,
        `AI routed to ${res.report.aiRecommendedDepartment} (${res.report.aiPriority} priority)`,
        'success'
      );
    } catch (err) {
      notify('Submission failed', (err as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (status: ReportStatus) => {
    if (!selected) return;
    setUpdatingStatus(true);
    try {
      const res = await apiRequest<{ report: CitizenReport }>(`/api/reports/${selected.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          note: statusNote.trim() || undefined,
        }),
      });
      setSelected(res.report);
      setReports((prev) => prev.map((r) => (r.id === res.report.id ? res.report : r)));
      setStatusNote('');
      notify('Report status updated', `${res.report.trackingCode} -> ${status}`, 'success');
    } catch (err) {
      notify('Update denied', (err as Error).message, 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const isStaff = user?.role !== 'Citizen';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {isStaff ? 'Citizen Reports & AI Triage' : 'My Civic Complaints'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#91A2B8] mt-1">
            {isStaff
              ? 'AI-classified public grievances, duplicate detection, department routing & resolution timelines'
              : 'Submit civic issues with photo evidence, AI auto-triage, and live tracking timeline'}
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-[#00C8FF] hover:bg-[#00B4E6] text-[#070D18] font-semibold text-xs px-4 py-2.5 w-fit transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Report
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#101D2D] border border-slate-200 dark:border-[#82AAD2]/15 w-fit">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-[#00C8FF] text-[#070D18] font-semibold'
                  : 'text-slate-600 dark:text-[#91A2B8] hover:text-slate-900 dark:hover:text-[#F4F7FC]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#91A2B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracking code, ward, title..."
            className="w-full rounded-xl bg-white dark:bg-[#101D2D] border border-slate-200 dark:border-[#82AAD2]/20 pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-[#00C8FF]"
          />
        </div>
      </div>

      {/* Two-column Split: Complaint Feed + Detailed AI Triage & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-slate-200 dark:bg-[#101D2D] animate-pulse" />
            ))
          ) : reports.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-8 text-center">
              <p className="text-sm font-medium">No reports match this filter</p>
              <button
                onClick={() => setModalOpen(true)}
                className="mt-3 px-4 py-2 rounded-xl bg-[#00C8FF] text-[#070D18] text-xs font-semibold"
              >
                Submit First Complaint
              </button>
            </div>
          ) : (
            reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={`w-full text-left rounded-2xl border p-4 transition-colors flex items-start gap-3 ${
                  selected?.id === r.id
                    ? 'border-[#00C8FF]/55 bg-[#00C8FF]/8 dark:bg-[#14243A]'
                    : 'border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] hover:border-[#00C8FF]/30'
                }`}
              >
                {r.imageUrl && (
                  <img
                    src={r.imageUrl}
                    alt={r.title}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-xl object-cover shrink-0 border border-[#82AAD2]/15"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-[#00C8FF]">{r.trackingCode}</span>
                    <span
                      className={`text-[11px] font-semibold ${
                        r.aiPriority === 'Critical' || r.aiPriority === 'High'
                          ? 'text-[#FF5263]'
                          : 'text-[#FFB547]'
                      }`}
                    >
                      {r.aiPriority}
                    </span>
                  </div>
                  <p className="text-sm font-semibold mt-0.5 truncate">{r.title}</p>
                  <p className="text-xs text-slate-500 dark:text-[#91A2B8] mt-1">
                    {r.ward} · {r.status} · {formatRelativeTime(r.createdAt)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Selected Report Inspector & Timeline */}
        <div className="lg:col-span-7">
          {selected ? (
            <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-xs text-[#00C8FF]">
                    {selected.trackingCode} · Submitted by {selected.citizenName}
                  </span>
                  <h2 className="font-display text-xl font-bold mt-1">{selected.title}</h2>
                  <p className="text-xs text-slate-500 dark:text-[#91A2B8] mt-1">
                    {selected.locationName} · {selected.ward}
                  </p>
                </div>
                <span className="font-mono text-xs font-semibold px-3 py-1 rounded-xl bg-[#00D69A]/15 text-[#00D69A]">
                  {selected.status}
                </span>
              </div>

              <p className="text-sm text-slate-700 dark:text-[#91A2B8] leading-relaxed">
                {selected.description}
              </p>

              {selected.imageUrl && (
                <img
                  src={selected.imageUrl}
                  alt={selected.title}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-56 object-cover rounded-xl border border-[#82AAD2]/15"
                />
              )}

              {/* AI Triage Box */}
              <div className="rounded-xl border border-[#00C8FF]/25 bg-[#00C8FF]/6 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#00C8FF] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    AI Classification & Triage Summary
                  </span>
                  <span className="font-mono text-[#00D69A]">{selected.aiConfidence}% confidence</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div>
                    <span className="text-slate-400 dark:text-[#91A2B8]">Classified Issue:</span>{' '}
                    <strong>{selected.aiClassifiedCategory}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-[#91A2B8]">Priority:</span>{' '}
                    <strong className="text-[#FFB547]">{selected.aiPriority}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-[#91A2B8]">Routed Dept:</span>{' '}
                    <strong>{selected.aiRecommendedDepartment}</strong>
                  </div>
                </div>
                {selected.possibleDuplicateCode && (
                  <p className="text-[#FFB547] flex items-center gap-1.5 pt-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Possible duplicate of existing report {selected.possibleDuplicateCode} in same ward.
                  </p>
                )}
              </div>

              {/* Complaint Tracking Timeline */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-[#91A2B8]">
                  Complaint Tracking Timeline
                </h3>
                <div className="space-y-3 border-l border-slate-200 dark:border-[#82AAD2]/20 ml-2 pl-4">
                  {selected.timeline.map((step, idx) => (
                    <div key={idx} className="relative">
                      <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#00C8FF]" />
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold flex items-center gap-1.5">
                          {step.status === 'Resolved' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#00D69A]" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-[#00C8FF]" />
                          )}
                          {step.status}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 dark:text-[#91A2B8]">
                          {formatRelativeTime(step.timestamp)} · {step.actor}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-[#91A2B8] mt-0.5">{step.note}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Municipal Staff Action Bar */}
              {isStaff && (
                <div className="pt-4 border-t border-slate-100 dark:border-[#82AAD2]/15 space-y-3">
                  <input
                    type="text"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Add officer inspection note before updating status..."
                    className="w-full rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-3.5 py-2 text-xs focus:outline-none focus:border-[#00C8FF]"
                  />
                  <div className="flex flex-wrap gap-2">
                    {(['Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected'] as ReportStatus[]).map(
                      (st) => (
                        <button
                          key={st}
                          disabled={updatingStatus || selected.status === st}
                          onClick={() => handleUpdateStatus(st)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                            selected.status === st
                              ? 'bg-[#00D69A]/15 border-[#00D69A]/40 text-[#00D69A]'
                              : 'border-slate-200 dark:border-[#82AAD2]/20 hover:border-[#00C8FF]/50'
                          }`}
                        >
                          {st}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-10 text-center text-xs text-slate-500 dark:text-[#91A2B8]">
              Select a report to view AI classification and tracking timeline.
            </div>
          )}
        </div>
      </div>

      {/* New Citizen Complaint Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSubmitReport}
            className="w-full max-w-lg rounded-2xl border border-[#82AAD2]/25 bg-[#101D2D] p-6 space-y-4 text-[#F4F7FC] shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Submit Civic Complaint</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-[#91A2B8] hover:text-[#F4F7FC]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-[#91A2B8] mb-1">Issue Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Overflowing drain near Linking Road signal"
                className="w-full rounded-xl bg-[#070D18] border border-[#82AAD2]/20 px-3 py-2 text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#91A2B8] mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl bg-[#070D18] border border-[#82AAD2]/20 px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#91A2B8] mb-1">Mumbai Ward</label>
                <select
                  value={wardIdx}
                  onChange={(e) => setWardIdx(Number(e.target.value))}
                  className="w-full rounded-xl bg-[#070D18] border border-[#82AAD2]/20 px-3 py-2 text-sm"
                >
                  {WARDS.map((w, i) => (
                    <option key={w.ward} value={i}>
                      {w.ward}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#91A2B8] mb-1">Exact Location / Landmark</label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Street name, junction, or nearby landmark"
                className="w-full rounded-xl bg-[#070D18] border border-[#82AAD2]/20 px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-[#91A2B8] mb-1">Detailed Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe severity, duration, and impact on commuters or residents..."
                className="w-full rounded-xl bg-[#070D18] border border-[#82AAD2]/20 px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-[#91A2B8] mb-1">Attach Photograph (Optional)</label>
              <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#82AAD2]/30 bg-[#070D18] p-3 text-xs cursor-pointer hover:border-[#00C8FF]">
                <Upload className="w-4 h-4 text-[#00C8FF]" />
                {imageUrl ? 'Photo Attached (Click to replace)' : 'Upload Photo Evidence'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                />
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 rounded-xl border border-[#82AAD2]/20 py-2.5 text-xs text-[#91A2B8]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl bg-[#00C8FF] text-[#070D18] font-semibold text-xs py-2.5"
              >
                {submitting ? 'Running AI Triage...' : 'Submit & Auto-Classify'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
