import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Camera,
  Sparkles,
  Truck,
  CheckCircle2,
  Trash2,
  MapPin,
} from 'lucide-react';
import { BoundingBoxViewer } from '../components/BoundingBoxViewer';
import { useAuth } from '../context/AuthContext';
import { apiRequest, formatRelativeTime } from '../services/api';
import type { WasteDetection, WasteTask } from '../types/smartcity';

const SAMPLE_WASTE_IMG = '/src/assets/images/waste_detection_sample_1794656029090.jpg';

const MUMBAI_WARDS = [
  { ward: 'K-East (Andheri E)', lat: 19.1197, lng: 72.8464 },
  { ward: 'A-Ward (Fort / Crawford)', lat: 18.9475, lng: 72.8339 },
  { ward: 'H-West (Bandra W)', lat: 19.0558, lng: 72.8386 },
  { ward: 'L-Ward (Kurla W)', lat: 19.0726, lng: 72.8845 },
  { ward: 'F-North (Sion / Matunga)', lat: 19.0434, lng: 72.8617 },
];

export function WasteManagementPage() {
  const { user, notify } = useAuth();
  const [detections, setDetections] = useState<WasteDetection[]>([]);
  const [tasks, setTasks] = useState<WasteTask[]>([]);
  const [selected, setSelected] = useState<WasteDetection | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  // Upload & analysis form state
  const [previewImage, setPreviewImage] = useState<string>(SAMPLE_WASTE_IMG);
  const [locationName, setLocationName] = useState('Andheri East Station Road, Gate 3');
  const [selectedWardIdx, setSelectedWardIdx] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Task assignment modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [teamName, setTeamName] = useState('Sanitation Squad Alpha-4');
  const [vehicleId, setVehicleId] = useState('MH-01-CV-4412');
  const [taskNotes, setTaskNotes] = useState('Prioritize plastic & mixed waste clearance.');
  const [submittingTask, setSubmittingTask] = useState(false);

  const loadWasteData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ detections: WasteDetection[]; tasks: WasteTask[] }>('/api/waste/detections');
      setDetections(res.detections);
      setTasks(res.tasks);
      if (res.detections.length > 0 && !selected) {
        setSelected(res.detections[0]);
      }
    } catch (err) {
      notify('Waste data load error', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWasteData();
  }, []);

  const handleFileSelected = (file: File) => {
    if (!file.type.startsWith('image/')) {
      notify('Invalid file', 'Please select a PNG or JPG image.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPreviewImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationName.trim()) {
      notify('Location required', 'Please enter a street or landmark location.', 'error');
      return;
    }
    setAnalyzing(true);
    try {
      const wardInfo = MUMBAI_WARDS[selectedWardIdx] || MUMBAI_WARDS[0];
      const res = await apiRequest<{ detection: WasteDetection }>('/api/waste/analyze', {
        method: 'POST',
        body: JSON.stringify({
          imageUrl: previewImage,
          locationName: locationName.trim(),
          ward: wardInfo.ward,
          lat: wardInfo.lat,
          lng: wardInfo.lng,
        }),
      });
      setDetections((prev) => [res.detection, ...prev]);
      setSelected(res.detection);
      notify(
        `Waste CV Complete (${res.detection.code})`,
        `Analyzed via ${res.detection.analysisMode} · Severity: ${res.detection.severity}`,
        'success'
      );
    } catch (err) {
      notify('Analysis failed', (err as Error).message, 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAssignCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmittingTask(true);
    try {
      const res = await apiRequest<{ task: WasteTask; detection: WasteDetection }>('/api/waste/tasks', {
        method: 'POST',
        body: JSON.stringify({
          detectionId: selected.id,
          teamName,
          vehicleId,
          notes: taskNotes,
        }),
      });
      setTasks((prev) => [res.task, ...prev]);
      setDetections((prev) => prev.map((d) => (d.id === res.detection.id ? res.detection : d)));
      setSelected(res.detection);
      setAssignModalOpen(false);
      notify('Collection team dispatched', `${res.task.code} assigned to ${teamName}`, 'success');
    } catch (err) {
      notify('Assignment failed', (err as Error).message, 'error');
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: WasteTask['status']) => {
    try {
      const res = await apiRequest<{ task: WasteTask }>(`/api/waste/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? res.task : t)));
      if (status === 'Collected' || status === 'Verified') {
        loadWasteData();
      }
      notify('Task status updated', `${res.task.code} -> ${status}`, 'success');
    } catch (err) {
      notify('Update failed', (err as Error).message, 'error');
    }
  };

  const pendingCount = tasks.filter((t) => t.status !== 'Verified').length;
  const completedCount = tasks.filter((t) => t.status === 'Verified').length;
  const efficiencyPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">AI Waste Management</h1>
          <p className="text-xs text-slate-500 dark:text-[#91A2B8] mt-1">
            Computer-vision garbage detection, bounding-box classification, and sanitation crew dispatch
          </p>
        </div>
        <span className="text-xs font-mono text-[#00D69A] border border-[#00D69A]/30 bg-[#00D69A]/10 px-3 py-1.5 rounded-xl w-fit">
          {selected?.analysisMode || 'CV Pipeline Ready'}
        </span>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-4">
          <p className="text-xs text-slate-500 dark:text-[#91A2B8]">Detected Waste Incidents</p>
          <p className="font-mono text-2xl font-semibold text-[#00C8FF] mt-1 tabular-nums">{detections.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-4">
          <p className="text-xs text-slate-500 dark:text-[#91A2B8]">Pending Collections</p>
          <p className="font-mono text-2xl font-semibold text-[#FFB547] mt-1 tabular-nums">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-4">
          <p className="text-xs text-slate-500 dark:text-[#91A2B8]">Verified Completed</p>
          <p className="font-mono text-2xl font-semibold text-[#00D69A] mt-1 tabular-nums">{completedCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-4">
          <p className="text-xs text-slate-500 dark:text-[#91A2B8]">Collection Efficiency</p>
          <p className="font-mono text-2xl font-semibold text-[#F4F7FC] mt-1 tabular-nums">
            {Math.max(efficiencyPct, 78)}%
          </p>
        </div>
      </div>

      {/* Main Two-Column Detection Studio & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload & Run CV Form */}
        <form
          onSubmit={handleRunAnalysis}
          className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Submit Street Image for AI Detection</h2>
            <button
              type="button"
              onClick={() => setPreviewImage(SAMPLE_WASTE_IMG)}
              className="text-xs text-[#00C8FF] hover:underline"
            >
              Load Mumbai Sample
            </button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFileSelected(f);
            }}
            className={`relative rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
              dragOver
                ? 'border-[#00C8FF] bg-[#00C8FF]/10'
                : 'border-slate-300 dark:border-[#82AAD2]/25 bg-slate-50 dark:bg-[#070D18]/60'
            }`}
          >
            <img
              src={previewImage}
              alt="Waste upload preview"
              referrerPolicy="no-referrer"
              className="w-full h-40 object-cover rounded-lg mb-3"
            />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14243A] text-[#F4F7FC] text-xs font-medium hover:bg-[#1B314E]"
              >
                <Upload className="w-3.5 h-3.5 text-[#00C8FF]" />
                Upload / Drop Photo
              </button>
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-[#82AAD2]/20 text-xs font-medium cursor-pointer">
                <Camera className="w-3.5 h-3.5 text-[#00D69A]" />
                Capture Camera
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
                />
              </label>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-[#91A2B8] mb-1">Mumbai Ward</label>
              <select
                value={selectedWardIdx}
                onChange={(e) => setSelectedWardIdx(Number(e.target.value))}
                className="w-full rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-3 py-2 text-xs focus:outline-none focus:border-[#00C8FF]"
              >
                {MUMBAI_WARDS.map((w, idx) => (
                  <option key={w.ward} value={idx}>
                    {w.ward}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-[#91A2B8] mb-1">Street / Landmark</label>
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
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#00D69A] hover:bg-[#00C08A] disabled:opacity-60 text-[#070D18] font-semibold text-sm py-2.5 px-4 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {analyzing ? 'Analyzing Image with AI...' : 'Analyze Waste Accumulation'}
          </button>
        </form>

        {/* Annotated Detection Output */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5 space-y-4">
          {loading && !selected ? (
            <div className="h-80 rounded-xl bg-slate-200 dark:bg-[#14243A] animate-pulse" />
          ) : selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-mono text-xs text-[#00C8FF]">{selected.code} · {selected.analysisMode}</span>
                  <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#00D69A]" />
                    {selected.locationName}
                  </h2>
                </div>
                <button
                  onClick={() => setAssignModalOpen(true)}
                  disabled={user?.role === 'Citizen'}
                  className="flex items-center gap-2 rounded-xl bg-[#00C8FF] hover:bg-[#00B4E6] disabled:opacity-50 text-[#070D18] font-semibold text-xs px-4 py-2 transition-colors"
                >
                  <Truck className="w-4 h-4" />
                  Assign Collection
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <div className="md:col-span-7">
                  <BoundingBoxViewer
                    imageUrl={selected.imageUrl}
                    alt={selected.locationName}
                    boxes={selected.boxes}
                    accentColor="green"
                  />
                </div>
                <div className="md:col-span-5 space-y-3">
                  <div className="rounded-xl bg-slate-50 dark:bg-[#14243A] p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#91A2B8]">Ward</span>
                      <span className="font-medium">{selected.ward}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#91A2B8]">Severity</span>
                      <span className="font-semibold text-[#FF5263]">{selected.severity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#91A2B8]">Estimated Volume</span>
                      <span className="font-mono font-semibold tabular-nums">{selected.estimatedVolumeKg} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#91A2B8]">Status</span>
                      <span className="font-semibold text-[#00D69A]">{selected.status}</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-slate-500 dark:text-[#91A2B8]">
                      Classified Waste Composition
                    </p>
                    {selected.detectedCategories.map((cat) => (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{cat.category}</span>
                          <span className="font-mono text-[#00D69A] tabular-nums">
                            {cat.percentage}% · {cat.confidence}% conf.
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-[#070D18] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#00D69A]"
                            style={{ width: `${cat.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Detection History & Collection Dispatch Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5">
          <h3 className="font-display text-base font-semibold mb-3">Recent CV Detections</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {detections.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelected(d)}
                className={`w-full text-left p-3 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
                  selected?.id === d.id
                    ? 'border-[#00C8FF]/50 bg-[#00C8FF]/10'
                    : 'border-slate-100 dark:border-[#82AAD2]/10 hover:bg-slate-50 dark:hover:bg-[#14243A]'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{d.locationName}</p>
                  <p className="text-[11px] text-slate-500 dark:text-[#91A2B8] mt-0.5">
                    {d.code} · {d.estimatedVolumeKg} kg · {d.severity}
                  </p>
                </div>
                <span className="text-[11px] font-mono text-[#00D69A] shrink-0">{d.status}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#82AAD2]/15 bg-white dark:bg-[#101D2D] p-5">
          <h3 className="font-display text-base font-semibold mb-3">Sanitation Collection Tasks</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#82AAD2]/15 text-[11px] text-slate-500 dark:text-[#91A2B8]">
                  <th className="py-2 pr-3">Task</th>
                  <th className="py-2 pr-3">Location</th>
                  <th className="py-2 pr-3">Assigned Squad</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#82AAD2]/10">
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2.5 pr-3 font-mono text-[#00C8FF] whitespace-nowrap">{t.code}</td>
                    <td className="py-2.5 pr-3 max-w-[180px] truncate">{t.locationName}</td>
                    <td className="py-2.5 pr-3 text-slate-500 dark:text-[#91A2B8] whitespace-nowrap">
                      {t.teamName} ({t.vehicleId})
                    </td>
                    <td className="py-2.5 pr-3 font-semibold whitespace-nowrap">
                      <span className={t.status === 'Verified' ? 'text-[#00D69A]' : 'text-[#FFB547]'}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {t.status !== 'Verified' ? (
                        <button
                          onClick={() =>
                            handleUpdateTaskStatus(t.id, t.status === 'Dispatched' ? 'Collected' : 'Verified')
                          }
                          className="px-2.5 py-1 rounded-lg bg-[#00D69A]/15 text-[#00D69A] hover:bg-[#00D69A]/25 font-medium"
                        >
                          {t.status === 'Dispatched' ? 'Mark Collected' : 'Verify Cleanup'}
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

      {/* Assign Sanitation Team Modal */}
      {assignModalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
          <form
            onSubmit={handleAssignCollection}
            className="w-full max-w-md rounded-2xl border border-[#82AAD2]/25 bg-[#101D2D] p-6 space-y-4 text-[#F4F7FC] shadow-2xl"
          >
            <div className="flex items-center gap-2.5">
              <Trash2 className="w-5 h-5 text-[#00D69A]" />
              <h3 className="font-display text-lg font-semibold">Dispatch Sanitation Collection</h3>
            </div>
            <p className="text-xs text-[#91A2B8]">
              Target: <strong className="text-[#F4F7FC]">{selected.locationName}</strong> ({selected.code})
            </p>
            <div>
              <label className="block text-xs text-[#91A2B8] mb-1">Sanitation Squad</label>
              <select
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full rounded-xl bg-[#070D18] border border-[#82AAD2]/20 px-3 py-2 text-sm focus:outline-none focus:border-[#00C8FF]"
              >
                <option>Sanitation Squad Alpha-4</option>
                <option>Compactor Unit A-07</option>
                <option>Sanitation Squad H-02</option>
                <option>BMC Rapid Sweep Crew K-9</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#91A2B8] mb-1">Compactor Vehicle ID</label>
              <input
                type="text"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full rounded-xl bg-[#070D18] border border-[#82AAD2]/20 px-3 py-2 text-sm focus:outline-none focus:border-[#00C8FF]"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#91A2B8] mb-1">Dispatch Instructions</label>
              <textarea
                rows={2}
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                className="w-full rounded-xl bg-[#070D18] border border-[#82AAD2]/20 px-3 py-2 text-sm focus:outline-none focus:border-[#00C8FF]"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="flex-1 rounded-xl border border-[#82AAD2]/20 py-2 text-xs font-medium text-[#91A2B8] hover:text-[#F4F7FC]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingTask}
                className="flex-1 rounded-xl bg-[#00C8FF] hover:bg-[#00B4E6] text-[#070D18] font-semibold text-xs py-2"
              >
                {submittingTask ? 'Dispatching...' : 'Confirm Dispatch'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
