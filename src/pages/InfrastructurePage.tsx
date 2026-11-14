import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Construction,
  MapPin,
  Sparkles,
  Upload,
  Wrench,
} from 'lucide-react';
import { BoundingBoxViewer } from '../components/BoundingBoxViewer';
import { useAuth } from '../context/AuthContext';
import { apiRequest, formatRelativeTime } from '../services/api';
import type { InfrastructureIssue, MaintenanceTask } from '../types/smartcity';

const SAMPLE_ROAD_IMG = '/src/assets/images/pothole_road_sample_1794656029505.jpg';

const WARDS = [
  { ward: 'F-North (Sion)', lat: 19.0434, lng: 72.8617 },
  { ward: 'S-Ward (Powai)', lat: 19.1235, lng: 72.9059 },
  { ward: 'F-South (Dadar / Hindmata)', lat: 19.0096, lng: 72.8421 },
  { ward: 'K-West (Andheri W)', lat: 19.1363, lng: 72.8277 },
];

export function InfrastructurePage() {
  const { user, notify } = useAuth();
  const [issues, setIssues] = useState<InfrastructureIssue[]>([]);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [selected, setSelected] = useState<InfrastructureIssue | null>(null);
  const [loading, setLoading] = useState(true);

  // Upload & analysis state
  const [previewImage, setPreviewImage] = useState(SAMPLE_ROAD_IMG);
  const [locationName, setLocationName] = useState('Sion - Dharavi Link Road Eastbound');
  const [wardIdx, setWardIdx] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Maintenance task modal state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [assignedCrew, setAssignedCrew] = useState('Rapid Asphalt Crew R-04');
  const [estimatedCostInr, setEstimatedCostInr] = useState(38000);
  const [submittingTask, setSubmittingTask] = useState(false);

  const loadIssues = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ issues: InfrastructureIssue[]; tasks: MaintenanceTask[] }>(
        '/api/infrastructure/issues'
      );
      setIssues(res.issues);
      setTasks(res.tasks);
      if (res.issues.length > 0 && !selected) setSelected(res.issues[0]);
    } catch (err) {
      notify('Infrastructure load error', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, []);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      notify('Invalid file', 'Please upload an image file.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setPreviewImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationName.trim()) return;
    setAnalyzing(true);
    try {
      const w = WARDS[wardIdx] || WARDS[0];
      const res = await apiRequest<{ issue: InfrastructureIssue }>('/api/infrastructure/analyze', {
        method: 'POST',
        body: JSON.stringify({
          imageUrl: previewImage,
          locationName: locationName.trim(),
          ward: w.ward,
          lat: w.lat,
          lng: w.lng,
        }),
      });
      setIssues((prev) => [res.issue, ...prev]);
      setSelected(res.issue);
      notify(
        `Defect Detected (${res.issue.code})`,
        `${res.issue.issueType} (${res.issue.confidence}% conf.) · ${res.issue.analysisMode}`,
        'success'
      );
    } catch (err) {
      notify('Inspection failed', (err as Error).message, 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmittingTask(true);
    try {
      const res = await apiRequest<{ task: MaintenanceTask; issue: InfrastructureIssue }>(
        '/api/infrastructure/tasks',
        {
          method: 'POST',
          body: JSON.stringify({
            issueId: selected.id,
            assignedCrew,
            estimatedCostInr,
          }),
        }
      );
      setTasks((prev) => [res.task, ...prev]);
      setIssues((prev) => prev.map((i) => (i.id === res.issue.id ? res.issue : i)));
      setSelected(res.issue);
      setTaskModalOpen(false);
      notify('Maintenance task scheduled', `${res.task.code} assigned to ${assignedCrew}`, 'success');
    } catch (err) {
      notify('Task creation failed', (err as Error).message, 'error');
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleAdvanceTask = async (task: MaintenanceTask) => {
    const nextStatus: MaintenanceTask['status'] =
      task.status === 'Scheduled'
        ? 'In Progress'
        : task.status === 'In Progress'
          ? 'Verification Pending'
          : 'Verified';
    try {
      const res = await apiRequest<{ task: MaintenanceTask }>(`/api/infrastructure/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          verificationNotes: nextStatus === 'Verified' ? 'Surface integrity inspected and approved.' : undefined,
        }),
      });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? res.task : t)));
      if (nextStatus === 'Verified') loadIssues();
      notify('Maintenance updated', `${res.task.code} -> ${nextStatus}`, 'success');
    } catch (err) {
      notify('Update failed', (err as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Infrastructure Monitoring</h1>
          <p className="text-xs text-slate-500 dark:text-[#91A2B8] mt-1">
            AI road & public asset defect detection, maintenance priority scoring & field repair verification
          </p>
        </div>
        <span className="text-xs font-mono text-[#FFB547] border border-[#FFB547]/30 bg-[#FFB547]/10 px-3 py-1.5 rounded-xl w-fit">
          {selected?.analysisMode || 'Road CV Ready'}
        </span>
      </div>

      {/* Inspection Studio + Result Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleAnalyze}
          className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Upload Road / Asset Image</h2>
            <button
              type="button"
              onClick={() => setPreviewImage(SAMPLE_ROAD_IMG)}
              className="text-xs text-[#00C8FF] hover:underline"
            >
              Load Pothole Sample
            </button>
          </div>

          <div className="rounded-xl border-2 border-dashed border-slate-300 dark:border-[#82AAD2]/25 bg-slate-50 dark:bg-[#070D18]/60 p-4 text-center">
            <img
              src={previewImage}
              alt="Road inspection preview"
              referrerPolicy="no-referrer"
              className="w-full h-40 object-cover rounded-lg mb-3"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#14243A] text-[#F4F7FC] text-xs font-medium hover:bg-[#1B314E]"
            >
              <Upload className="w-3.5 h-3.5 text-[#00C8FF]" />
              Select Road Image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-[#91A2B8] mb-1">Mumbai Ward</label>
              <select
                value={wardIdx}
                onChange={(e) => setWardIdx(Number(e.target.value))}
                className="w-full rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-3 py-2 text-xs focus:outline-none focus:border-[#00C8FF]"
              >
                {WARDS.map((w, i) => (
                  <option key={w.ward} value={i}>
                    {w.ward}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-[#91A2B8] mb-1">Road Segment</label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-3 py-2 text-xs focus:outline-none focus:border-[#00C8FF]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={analyzing}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#00C8FF] hover:bg-[#00B4E6] disabled:opacity-60 text-[#070D18] font-semibold text-sm py-2.5 px-4 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {analyzing ? 'Scanning Pavement Defects...' : 'Run Infrastructure CV Scan'}
          </button>
        </form>

        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5 space-y-4">
          {loading && !selected ? (
            <div className="h-80 rounded-xl bg-slate-200 dark:bg-[#14243A] animate-pulse" />
          ) : selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-mono text-xs text-[#FF5263] font-semibold">
                    {selected.code} · {selected.issueType} ({selected.confidence}% confidence)
                  </span>
                  <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#00C8FF]" />
                    {selected.locationName}
                  </h2>
                </div>
                <button
                  onClick={() => setTaskModalOpen(true)}
                  disabled={user?.role === 'Citizen'}
                  className="flex items-center gap-2 rounded-xl bg-[#00C8FF] hover:bg-[#00B4E6] disabled:opacity-50 text-[#070D18] font-semibold text-xs px-4 py-2"
                >
                  <Wrench className="w-4 h-4" />
                  Create Maintenance Task
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <div className="md:col-span-7">
                  <BoundingBoxViewer
                    imageUrl={selected.imageUrl}
                    alt={selected.locationName}
                    boxes={selected.boxes}
                    accentColor="red"
                  />
                </div>
                <div className="md:col-span-5 space-y-3 text-xs">
                  <div className="rounded-xl bg-slate-50 dark:bg-[#14243A] p-4 space-y-2.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#91A2B8]">Ward</span>
                      <span className="font-medium">{selected.ward}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#91A2B8]">Defect Class</span>
                      <span className="font-semibold">{selected.issueType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#91A2B8]">Severity</span>
                      <span className="font-semibold text-[#FF5263]">{selected.severity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#91A2B8]">Recommended SLA</span>
                      <span className="font-mono text-[#FFB547]">{selected.recommendedPriority}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#91A2B8]">Status</span>
                      <span className="font-semibold text-[#00D69A]">{selected.status}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Issues List + Maintenance History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5">
          <h3 className="font-display text-base font-semibold mb-3">Detected Structural Defects</h3>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {issues.map((iss) => (
              <button
                key={iss.id}
                onClick={() => setSelected(iss)}
                className={`w-full text-left p-3 rounded-xl border transition-colors flex items-center justify-between gap-2 ${
                  selected?.id === iss.id
                    ? 'border-[#00C8FF]/50 bg-[#00C8FF]/10'
                    : 'border-slate-100 dark:border-[#82AAD2]/10 hover:bg-slate-50 dark:hover:bg-[#14243A]'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{iss.locationName}</p>
                  <p className="text-[11px] text-slate-500 dark:text-[#91A2B8] mt-0.5">
                    {iss.code} · {iss.issueType} · {iss.confidence}% conf.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-[#FFB547] shrink-0">{iss.status}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5">
          <h3 className="font-display text-base font-semibold mb-3">Maintenance Work Orders</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#82AAD2]/15 text-[11px] text-slate-500 dark:text-[#91A2B8]">
                  <th className="py-2 pr-3">Work Order</th>
                  <th className="py-2 pr-3">Location</th>
                  <th className="py-2 pr-3">Assigned Crew</th>
                  <th className="py-2 pr-3">Est. Cost</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Workflow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#82AAD2]/10">
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2.5 pr-3 font-mono text-[#00C8FF] whitespace-nowrap">{t.code}</td>
                    <td className="py-2.5 pr-3 max-w-[170px] truncate">{t.locationName}</td>
                    <td className="py-2.5 pr-3 text-slate-500 dark:text-[#91A2B8] whitespace-nowrap">{t.assignedCrew}</td>
                    <td className="py-2.5 pr-3 font-mono tabular-nums whitespace-nowrap">
                      ₹{t.estimatedCostInr.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold whitespace-nowrap">{t.status}</td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {t.status !== 'Verified' ? (
                        <button
                          onClick={() => handleAdvanceTask(t)}
                          className="px-2.5 py-1 rounded-lg bg-[#00C8FF]/15 text-[#00C8FF] hover:bg-[#00C8FF]/25 font-medium"
                        >
                          {t.status === 'Scheduled'
                            ? 'Start Repair'
                            : t.status === 'In Progress'
                              ? 'Submit Check'
                              : 'Verify Done'}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#00D69A]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {formatRelativeTime(t.completedAt || t.assignedAt)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Maintenance Task Modal */}
      {taskModalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateTask}
            className="w-full max-w-md rounded-2xl border border-[#82AAD2]/25 bg-[#101D2D] p-6 space-y-4 text-[#F4F7FC] shadow-2xl"
          >
            <div className="flex items-center gap-2.5">
              <Construction className="w-5 h-5 text-[#FFB547]" />
              <h3 className="font-display text-lg font-semibold">Schedule Maintenance Task</h3>
            </div>
            <p className="text-xs text-[#91A2B8]">
              {selected.issueType} at <strong className="text-[#F4F7FC]">{selected.locationName}</strong>
            </p>
            <div>
              <label className="block text-xs text-[#91A2B8] mb-1">Field Engineering Crew</label>
              <select
                value={assignedCrew}
                onChange={(e) => setAssignedCrew(e.target.value)}
                className="w-full rounded-xl bg-[#070D18] border border-[#82AAD2]/20 px-3 py-2 text-sm"
              >
                <option>Rapid Asphalt Crew R-04</option>
                <option>Resurfacing Crew S-01</option>
                <option>De-silting Crew F-03</option>
                <option>Electrical Maintenance Van E-11</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#91A2B8] mb-1">Estimated Repair Budget (INR)</label>
              <input
                type="number"
                min={1000}
                step={500}
                value={estimatedCostInr}
                onChange={(e) => setEstimatedCostInr(Number(e.target.value))}
                className="w-full rounded-xl bg-[#070D18] border border-[#82AAD2]/20 px-3 py-2 text-sm font-mono"
                required
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                className="flex-1 rounded-xl border border-[#82AAD2]/20 py-2 text-xs text-[#91A2B8]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingTask}
                className="flex-1 rounded-xl bg-[#00C8FF] text-[#070D18] font-semibold text-xs py-2"
              >
                {submittingTask ? 'Scheduling...' : 'Create Work Order'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
